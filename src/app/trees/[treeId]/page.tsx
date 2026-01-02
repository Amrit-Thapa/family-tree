import { mockFamilyTree } from "@/features/trees/mock";

export default function TreePage() {
  return (
    <div>
      <h1>Family Tree</h1>
      <ul>
        {Object.values(mockFamilyTree.people).map((person) => (
          <li key={person.id}>
            {person.firstName} {person.lastName}
          </li>
        ))}
      </ul>
    </div>
  );
}
