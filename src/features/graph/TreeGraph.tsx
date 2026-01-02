
import { FamilyGraph } from "@/shared/types/domain";

type Props = {
  graph?: FamilyGraph;
};

export function TreeGraph({ graph }: Props) {
  console.log({graph, a: graph.relationships});
  const people = Object.values(graph.people);
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
    <svg width={800} height={600} style={{ border: "1px solid #ccc" }}>
      {people.map((person, index) => (
      <g key={person.id}>
        {parentRelationships.map((rel, index) => {
          const parentPos = positions[rel.from];
          const childPos = positions[rel.to];

            if (!parentPos || !childPos) return null;

            return (
              <line
                key={index}
                x1={parentPos.x}
                y1={parentPos.y}
                x2={childPos.x}
                y2={childPos.y}
                stroke="#6b7280"
                strokeWidth={2}
              />
            );
        })}
        <circle
          cx={100 + index * 150}
          cy={200}
          r={25}
          fill="#e5e7eb"
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
    ))}
    </svg>
  );
}
