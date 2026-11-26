'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  Controls,
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
import { computeDagreLayout } from '@/lib/graph/layout';
import PersonNode from '@/components/graph/PersonNode';
import SidePanel from '@/components/graph/SidePanel';
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
  const [selectedNode, setSelectedNode] = useState<GraphNodeData | null>(null);

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
            style: { stroke: '#6b7280' },
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
            stroke: isInactive ? '#d1d5db' : '#9ca3af',
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
    setIsLoading(true);
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

  /**
   * Handles node click to open the SidePanel.
   */
  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      const graphNode = graphNodes.find((n) => n.id === node.id);
      if (graphNode) {
        setSelectedNode(graphNode);
      }
    },
    [graphNodes]
  );

  /**
   * Navigates to a specific node (centers on it).
   */
  const handleNavigateToNode = useCallback(
    (nodeId: string) => {
      reactFlowInstance.fitView({
        nodes: [{ id: nodeId }],
        duration: 300,
      });

      // Also select that node in the side panel
      const graphNode = graphNodes.find((n) => n.id === nodeId);
      if (graphNode) {
        setSelectedNode(graphNode);
      }
    },
    [reactFlowInstance, graphNodes]
  );

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
    setSelectedNode(null);
  }, []);

  // Memoize the empty state check
  const isEmpty = useMemo(
    () => !isLoading && !error && graphNodes.length === 0,
    [isLoading, error, graphNodes.length]
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-indigo-600" />
          <p className="mt-3 text-sm text-gray-500">Loading family tree...</p>
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
            className="mt-3 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
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
          <p className="text-sm text-gray-500">
            {isAdmin
              ? 'No family members yet. Add a person to get started.'
              : 'No family members in this tree yet.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        nodesDraggable={true}
        panOnDrag={true}
        zoomOnScroll={true}
        zoomOnPinch={true}
        minZoom={0.1}
        maxZoom={4}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        proOptions={{ hideAttribution: true }}
        style={{ background: '#f8fafc' }}
      >
        <Controls className="bg-white! shadow-md! rounded-lg! border! border-gray-200!" />
      </ReactFlow>

      {/* Side Panel */}
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
