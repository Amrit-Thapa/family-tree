'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  Handle,
  Position,
  MarkerType,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type { MembershipRole } from '@/lib/types/membership';
import type {
  GraphNodeData,
  GraphRelationshipData,
} from '@/lib/services/graph.service';
import { computeDagreLayout, GRAPH_COLORS } from '@/lib/graph/layout';
import { getFocusFamily, pickDefaultFocus } from '@/lib/graph/family-focus';
import PersonNode from '@/components/graph/PersonNode';
import SidePanel from '@/components/graph/SidePanel';
import FocusView from '@/components/graph/FocusView';
import PersonSearch from '@/components/graph/PersonSearch';
import type { PersonNodeData } from '@/components/graph/PersonNode';

// --- Types ---

export interface FamilyTreeGraphProps {
  treeId: string;
  currentUserId: string;
  role: MembershipRole;
}

// --- Junction Node (invisible coupling point between spouses and children) ---

function JunctionNode() {
  return (
    <>
      <Handle type="target" position={Position.Top} className="opacity-0! w-0! h-0!" />
      <div className="w-[2px] h-[2px]" />
      <Handle type="source" position={Position.Bottom} className="opacity-0! w-0! h-0!" />
    </>
  );
}

// --- Constants ---

const nodeTypes = { person: PersonNode, junction: JunctionNode };

type ViewMode = 'focus' | 'tree';
const VIEW_STORAGE_KEY = 'familyTree.view';

function readStoredView(): ViewMode {
  try {
    return window.localStorage.getItem(VIEW_STORAGE_KEY) === 'tree' ? 'tree' : 'focus';
  } catch {
    return 'focus';
  }
}

// --- Internal Graph Component (needs ReactFlowProvider wrapper) ---

function FamilyTreeGraphInner({
  treeId,
  currentUserId,
  role,
}: FamilyTreeGraphProps) {
  const reactFlowInstance = useReactFlow();

  // Data state
  const [graphNodes, setGraphNodes] = useState<GraphNodeData[]>([]);
  const [graphRelationships, setGraphRelationships] = useState<
    GraphRelationshipData[]
  >([]);

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>(readStoredView);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);

  const isAdmin = role === 'admin';

  /**
   * Transforms API graph data into React Flow nodes.
   */
  const transformNodes = useCallback(
    (apiNodes: GraphNodeData[]): Node[] => {
      return apiNodes.map((node) => ({
        id: node.id,
        type: 'person',
        position: { x: 0, y: 0 }, // Will be computed by dagre
        data: {
          firstName: node.firstName,
          lastName: node.lastName,
          profilePhotoUrl: node.profilePhotoUrl,
          linkedUserId: node.linkedUserId,
          isCurrentUser: node.linkedUserId === currentUserId,
          gender: node.gender,
        } satisfies PersonNodeData,
      }));
    },
    [currentUserId]
  );

  /**
   * Transforms API relationships into React Flow edges.
   * The layout function will later restyle and reroute these edges,
   * but we tag them with isSpouse data for the layout to use.
   */
  const transformEdges = useCallback(
    (relationships: GraphRelationshipData[]): Edge[] => {
      return relationships.map((rel) => {
        if (rel.type === 'father' || rel.type === 'mother') {
          return {
            id: rel.id,
            source: rel.fromNodeId,
            target: rel.toNodeId,
            type: 'smoothstep',
            data: { isSpouse: false },
            markerEnd: {
              type: MarkerType.ArrowClosed,
            },
            style: { stroke: GRAPH_COLORS.branch },
          };
        }
        // spouse: tagged for layout to handle positioning
        const isInactive = rel.spouseStatus === 'divorced' || rel.spouseStatus === 'separated';
        return {
          id: rel.id,
          source: rel.fromNodeId,
          target: rel.toNodeId,
          type: 'straight',
          data: { isSpouse: true, spouseStatus: rel.spouseStatus },
          style: {
            strokeDasharray: '5 5',
            stroke: isInactive ? GRAPH_COLORS.spouseInactive : GRAPH_COLORS.spouse,
          },
        };
      });
    },
    []
  );

  /**
   * Fetches graph data from the API and computes layout.
   */
  const fetchGraphData = useCallback(async () => {
    setError(null);

    try {
      const res = await fetch(`/api/trees/${treeId}/graph`);

      if (!res.ok) {
        throw new Error('Failed to load graph data');
      }

      const data = (await res.json()) as {
        nodes: GraphNodeData[];
        relationships: GraphRelationshipData[];
      };

      setGraphNodes(data.nodes);
      setGraphRelationships(data.relationships);

      // Transform to React Flow format
      const rfNodes = transformNodes(data.nodes);
      const rfEdges = transformEdges(data.relationships);

      // Compute dagre layout
      const { nodes: layoutedNodes, edges: layoutedEdges } =
        computeDagreLayout(rfNodes, rfEdges);

      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
    } catch {
      setError('Could not load the family tree graph. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [treeId, transformNodes, transformEdges, setNodes, setEdges]);

  /**
   * Refreshes graph data and re-computes layout.
   */
  const refreshGraph = useCallback(async () => {
    await fetchGraphData();
  }, [fetchGraphData]);

  // Fetch data on mount
  useEffect(() => {
    fetchGraphData();
  }, [fetchGraphData]);

  // Derived: the person in the middle of the Family view (falls back to
  // "me" or the best-connected person if the chosen one was deleted)
  const nodeById = useMemo(() => new Map(graphNodes.map((n) => [n.id, n])), [graphNodes]);
  const defaultFocusId = useMemo(
    () => pickDefaultFocus(graphNodes, graphRelationships, currentUserId),
    [graphNodes, graphRelationships, currentUserId]
  );
  const activeFocusId = focusId && nodeById.has(focusId) ? focusId : defaultFocusId;
  const focusNode = activeFocusId ? nodeById.get(activeFocusId) ?? null : null;
  const focusFamily = useMemo(
    () => (activeFocusId ? getFocusFamily(activeFocusId, graphRelationships, graphNodes) : null),
    [activeFocusId, graphRelationships, graphNodes]
  );
  const myNodeId = useMemo(
    () => graphNodes.find((n) => n.linkedUserId === currentUserId)?.id ?? null,
    [graphNodes, currentUserId]
  );
  const selectedNode = selectedId ? nodeById.get(selectedId) ?? null : null;

  /** Moves the Family view to someone, remembering where we came from. */
  const focusOn = useCallback(
    (nodeId: string) => {
      if (nodeId === activeFocusId) return;
      if (activeFocusId) setHistory((h) => [...h.slice(-30), activeFocusId]);
      setFocusId(nodeId);
    },
    [activeFocusId]
  );

  const goBack = useCallback(() => {
    if (history.length === 0) return;
    setFocusId(history[history.length - 1]);
    setHistory(history.slice(0, -1));
  }, [history]);

  const changeView = useCallback((next: ViewMode) => {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      // Private mode etc. — the choice just won't be remembered
    }
  }, []);

  /** Centres the whole-tree canvas on someone at a readable zoom. */
  const centreOn = useCallback(
    (nodeId: string) => {
      reactFlowInstance.fitView({ nodes: [{ id: nodeId }], duration: 300, maxZoom: 1.1 });
    },
    [reactFlowInstance]
  );

  /** Tapping a card in the whole tree: open their details and focus them. */
  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      if (!nodeById.has(node.id)) return;
      focusOn(node.id);
      setSelectedId(node.id);
    },
    [nodeById, focusOn]
  );

  /** Clicking a name inside the details panel. */
  const handleNavigateToNode = useCallback(
    (nodeId: string) => {
      focusOn(nodeId);
      setSelectedId(nodeId);
      if (view === 'tree') centreOn(nodeId);
    },
    [focusOn, view, centreOn]
  );

  /** Picking someone from search. */
  const handleSearchPick = useCallback(
    (nodeId: string) => {
      focusOn(nodeId);
      if (view === 'tree') {
        centreOn(nodeId);
        setSelectedId(nodeId);
      }
    },
    [focusOn, view, centreOn]
  );

  // Whole-tree canvas: ring the focused person, and open zoomed in on them
  // and their closest family rather than shrinking the whole tree to fit
  const displayNodes = useMemo(
    () =>
      nodes.map((n) =>
        n.id === activeFocusId && n.type === 'person' ? { ...n, data: { ...n.data, isFocused: true } } : n
      ),
    [nodes, activeFocusId]
  );
  const initialFitNodes = useMemo(() => {
    if (!activeFocusId || !focusFamily) return undefined;
    const ids = [
      activeFocusId,
      focusFamily.father?.node.id,
      focusFamily.mother?.node.id,
      ...focusFamily.partners.map((p) => p.node.id),
      ...focusFamily.children.map((c) => c.node.id),
    ].filter((id): id is string => Boolean(id));
    // React Flow only reads this when the canvas opens; later moves use centreOn
    return ids.map((id) => ({ id }));
  }, [activeFocusId, focusFamily]);

  /**
   * Handles relationship creation from the SidePanel.
   */
  const handleRelationshipCreated = useCallback(
    (_rel: GraphRelationshipData) => {
      refreshGraph();
    },
    [refreshGraph]
  );

  /**
   * Handles relationship deletion from the SidePanel.
   */
  const handleRelationshipDeleted = useCallback(
    (_relId: string) => {
      refreshGraph();
    },
    [refreshGraph]
  );

  /**
   * Closes the SidePanel.
   */
  const handleCloseSidePanel = useCallback(() => {
    setSelectedId(null);
  }, []);

  // Memoize the empty state check
  const isEmpty = useMemo(
    () => !isLoading && !error && graphNodes.length === 0,
    [isLoading, error, graphNodes.length]
  );

  // Loading state (first load only, so refreshes don't blank the view)
  if (isLoading && graphNodes.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-stone-200 border-t-brand-600" />
          <p className="mt-3 text-sm text-stone-500">Gathering the family… 🌳</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={refreshGraph}
            className="mt-3 rounded-full bg-brand-500 px-4 py-2 text-sm font-bold text-white hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 shadow-[0_3px_0_0_var(--color-brand-700)] disabled:shadow-none"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Empty state
  if (isEmpty) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-stone-500">
            {isAdmin
              ? 'No family members yet. Add a person to get started.'
              : 'No family members in this tree yet.'}
          </p>
        </div>
      </div>
    );
  }

  const toggleButton = (mode: ViewMode, label: string, icon: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={view === mode}
      onClick={() => changeView(mode)}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-bold transition-colors sm:flex-none ${
        view === mode ? 'bg-white text-brand-700 shadow-sm' : 'text-stone-500 hover:text-stone-800'
      }`}
    >
      <span aria-hidden="true">{icon}</span>
      {label}
    </button>
  );

  const iconButton =
    'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-stone-200 bg-white text-base transition-colors hover:border-brand-300 disabled:opacity-40 disabled:hover:border-stone-200';

  return (
    <div className="relative flex h-full w-full flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b-2 border-stone-100 bg-white/80 p-2 sm:p-3">
        <div role="tablist" aria-label="Tree view" className="flex w-full rounded-full bg-stone-100 p-1 sm:w-auto">
          {toggleButton('focus', 'Family', '🎯')}
          {toggleButton('tree', 'Whole tree', '🌳')}
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {view === 'focus' && (
            <button type="button" onClick={goBack} disabled={history.length === 0} className={iconButton} aria-label="Back to previous person" title="Back">
              ←
            </button>
          )}
          <PersonSearch nodes={graphNodes} onPick={handleSearchPick} className="min-w-0 flex-1 sm:max-w-sm" />
          {myNodeId && (
            <button
              type="button"
              onClick={() => (view === 'tree' ? (focusOn(myNodeId), centreOn(myNodeId)) : focusOn(myNodeId))}
              disabled={view === 'focus' && activeFocusId === myNodeId}
              className={iconButton}
              aria-label="Go to me"
              title="Go to me"
            >
              🙋
            </button>
          )}
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        {view === 'focus' && focusNode && focusFamily ? (
          <FocusView
            person={focusNode}
            family={focusFamily}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            onFocus={focusOn}
            onOpenDetails={setSelectedId}
          />
        ) : (
          <ReactFlow
            nodes={displayNodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={handleNodeClick}
            nodeTypes={nodeTypes}
            nodesDraggable={false}
            nodesConnectable={false}
            panOnDrag={true}
            zoomOnScroll={true}
            zoomOnPinch={true}
            minZoom={0.1}
            maxZoom={4}
            fitView
            // minZoom keeps names readable on phones even if the family is wide
            fitViewOptions={{ padding: 0.2, minZoom: 0.6, maxZoom: 1, nodes: initialFitNodes }}
            proOptions={{ hideAttribution: true }}
            forceColorMode="light"
            style={{ background: '#fffdf8' }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={22}
              size={2}
              color="#eadfce"
              bgColor="#fffdf8"
            />
            <Controls
              showInteractive={false}
              className="bg-white! shadow-md! rounded-2xl! border! border-stone-200! overflow-hidden"
            />
          </ReactFlow>
        )}
      </div>

      {/* Details panel (bottom sheet on phones) */}
      <SidePanel
        node={selectedNode}
        relationships={graphRelationships}
        allNodes={graphNodes}
        isAdmin={isAdmin}
        treeId={treeId}
        currentUserId={currentUserId}
        onClose={handleCloseSidePanel}
        onNavigateToNode={handleNavigateToNode}
        onRelationshipCreated={handleRelationshipCreated}
        onRelationshipDeleted={handleRelationshipDeleted}
        onPersonUpdated={refreshGraph}
        onPersonDeleted={refreshGraph}
      />
    </div>
  );
}

// --- Exported Component (wrapped with ReactFlowProvider) ---

/**
 * FamilyTreeGraph is the main graph visualization component.
 * It fetches graph data, computes dagre layout, and renders an interactive
 * React Flow canvas with person nodes and relationship edges.
 *
 * Features:
 * - Pan on drag, zoom on scroll/pinch (min 0.1, max 4)
 * - Fit view on initial render
 * - Zoom-in, zoom-out, fit-to-view control buttons
 * - Node dragging (positions revert on reload)
 * - Node click opens SidePanel with person details
 * - Empty state when no nodes exist
 * - Error state with retry button on fetch failure
 * - Current user's node highlighted with isCurrentUser flag
 */
export default function FamilyTreeGraph(props: FamilyTreeGraphProps) {
  return (
    <ReactFlowProvider>
      <FamilyTreeGraphInner {...props} />
    </ReactFlowProvider>
  );
}
