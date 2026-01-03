"use client";
import { useState } from "react";
import { PersonId } from "@/shared/types/domain";
import { FamilyGraph } from "@/shared/types/domain";

type Props = {
  graph: FamilyGraph;
};

export function TreeGraph({ graph }: Props) {
  const people = Object.values(graph.people);
  const [selectedId, setSelectedId] = useState<PersonId | null>(null);

  const positions = people.reduce<Record<string, { x: number; y: number }>>(
    (acc, person, index) => {
      acc[person.id] = {
        x: 150 + index * 150,
        y: person.birthDate?.startsWith("19") ? 150 : 300,
      };
      return acc;
    },
    {}
  );

  const parentRelationships = graph.relationships.filter(
    (r) => r.type === "parent"
  );

  return (
    <>
      <svg width={800} height={600} style={{ border: "1px solid #ccc" }}>
        {people.map((person, index) => {
          const isSelected = selectedId === person.id;
          return (
            <g
              key={person.id}
              onClick={() => setSelectedId(person.id)}
              className="cursor-pointer"
            >
              {parentRelationships.map((rel, index) => {
                const parentPos = positions[rel.from];
                const childPos = positions[rel.to];
                const isRelated =
                  selectedId &&
                  (rel.from === selectedId || rel.to === selectedId);

                if (!parentPos || !childPos) return null;

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
              <circle
                cx={100 + index * 150}
                cy={200}
                r={isSelected ? 28 : 24}
                fill={isSelected ? "#93c5fd" : "#e5e7eb"}
                stroke="#111827"
              />
              <text
                x={100 + index * 150}
                y={205}
                textAnchor="middle"
                fontSize="12"
              >
                {person.firstName}
              </text>
            </g>
          );
        })}
      </svg>
      {selectedId && (
        <div>
          <h2>Selected Person</h2>
          <p>{graph.people[selectedId].firstName}</p>
        </div>
      )}
    </>
  );
}
