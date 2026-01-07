"use client";

import { useMemo, useState } from "react";
import { FamilyGraph, PersonId } from "@/shared/types/domain";
import { useUser } from "@/shared/context/UserContext";
import { canWrite } from "@/shared/types/permissions";

type Props = {
  graph: FamilyGraph;
  roleOverride?: "viewer" | "editor";
};

export function TreeGraph({ graph, roleOverride }: Props) {
  const people = Object.values(graph.people);
  const { role: contextRole } = useUser();
  const role = roleOverride ?? contextRole;
  const writable = canWrite(role);

  const [selectedId, setSelectedId] = useState<PersonId | null>(null);

  const positions = useMemo(() => {
    return people.reduce<Record<PersonId, { x: number; y: number }>>(
      (acc, person, index) => {
        acc[person.id] = {
          x: 150 + index * 150,
          y: person.birthDate?.startsWith("19") ? 150 : 300,
        };
        return acc;
      },
      {} as Record<PersonId, { x: number; y: number }>
    );
  }, [people]);

  const parentRelationships = graph.relationships.filter(
    (r) => r.type === "parent"
  );

  const handleArrowNavigation = (key: string) => {
    if (!selectedId) return;

    const index = people.findIndex((p) => p.id === selectedId);

    if (key === "ArrowRight") {
      setSelectedId(people[index + 1]?.id ?? selectedId);
    }

    if (key === "ArrowLeft") {
      setSelectedId(people[index - 1]?.id ?? selectedId);
    }
  };

  return (
    <>
      <svg
        width={800}
        height={600}
        style={{ border: "1px solid #ccc" }}
        role="group"
        aria-label="Family tree graph"
      >
        <defs>
          <filter id="focus-ring">
            <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#2563eb" />
          </filter>
        </defs>
        {/* 🔹 1. Render lines FIRST */}
        {parentRelationships.map((rel, index) => {
          const parentPos = positions[rel.from];
          const childPos = positions[rel.to];

          if (!parentPos || !childPos) return null;

          const isRelated =
            selectedId && (rel.from === selectedId || rel.to === selectedId);

          return (
            <line
              key={index}
              x1={parentPos.x}
              y1={parentPos.y}
              x2={childPos.x}
              y2={childPos.y}
              stroke={isRelated ? "#2563eb" : "#9ca3af"}
              strokeWidth={isRelated ? 3 : 1}
            />
          );
        })}

        {/* 🔹 2. Render nodes */}
        {people.map((person) => {
          const pos = positions[person.id];
          const isSelected = selectedId === person.id;

          return (
            <g
              key={person.id}
              aria-selected={isSelected}
              tabIndex={0}
              role="button"
              aria-label={`Person ${person.firstName}`}
              onClick={() => {
                if (!writable) return;
                setSelectedId(person.id);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedId(person.id);
                }
                if (e.key.startsWith("Arrow")) {
                  handleArrowNavigation(e.key);
                }
              }}
              style={{
                cursor: writable ? "pointer" : "not-allowed",
                opacity: writable ? 1 : 0.6,
                outline: "none",
              }}
            >
              <circle
                cx={pos.x}
                cy={pos.y}
                r={isSelected ? 28 : 24}
                fill={isSelected ? "#93c5fd" : "#e5e7eb"}
                stroke="#111827"
                filter={isSelected ? "url(#focus-ring)" : undefined}
              />
              <text x={pos.x} y={pos.y + 4} textAnchor="middle" fontSize="12">
                {person.firstName}
              </text>
            </g>
          );
        })}
      </svg>
      <div aria-live="polite" style={{ marginTop: 12 }}>
        {selectedId && `Selected ${graph.people[selectedId].firstName}`}
      </div>
    </>
  );
}
