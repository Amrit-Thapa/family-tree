import { mockFamilyTree } from "@/features/trees/mock";
import { TreeGraph } from "@/features/graph/TreeGraph";

export default function TreePage() {
  return (
    <div>
      <TreeGraph graph={mockFamilyTree} />
    </div>
  );
}
