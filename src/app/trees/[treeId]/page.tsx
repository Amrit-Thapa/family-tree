import { mockFamilyTree } from "@/features/trees/mock";
import { TreeGraph } from "@/features/graph/TreeGraph";
import { Role } from "@/shared/types/permissions";

type Props = {
  searchParams?: {
    role?: Role;
  };
};

export default function TreePage({ searchParams }: Props) {
  const effectiveRole: Role =
    searchParams?.role === "viewer" ? "viewer" : "editor";

  return (
    <div>
      <TreeGraph graph={mockFamilyTree} roleOverride={effectiveRole} />
    </div>
  );
}
