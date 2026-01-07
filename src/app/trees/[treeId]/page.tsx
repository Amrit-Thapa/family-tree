import { mockFamilyTree } from "@/features/trees/mock";
import { TreeGraph } from "@/features/graph/TreeGraph";
import { Role } from "@/shared/types/permissions";

type Props = {
  searchParams?: {
    role?: Role;
  };
};

export default async function TreePage({ searchParams }: Props) {
  const resolvedSearchParams = await searchParams;

  const effectiveRole: Role =
    resolvedSearchParams?.role === "viewer" ? "viewer" : "editor";

  return <TreeGraph graph={mockFamilyTree} roleOverride={effectiveRole} />;
}
