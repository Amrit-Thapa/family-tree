import { mockFamilyTree } from "@/features/trees/mock";
import { TreeGraph } from "@/features/graph/TreeGraph";

const TreePage = () => {
  return (
    <div>
      <TreeGraph graph={mockFamilyTree} />
    </div>
  );
};

export default TreePage;
