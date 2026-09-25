// A chapter's two-level cell structure as a tree: upper-level groups (senior
// cells) with their cells, each with a member count. A cell whose parent is
// missing is shown at the top level rather than dropped.

export type CellLike = { id: string; parentId?: string | null; name: string };

export type CellNode<C extends CellLike> = C & { memberCount: number; children: CellNode<C>[] };

export function buildCellTree<C extends CellLike>(cells: readonly C[], memberCellIds: readonly (string | null | undefined)[]): CellNode<C>[] {
  const counts = new Map<string, number>();
  for (const id of memberCellIds) if (id) counts.set(id, (counts.get(id) ?? 0) + 1);

  const ids = new Set(cells.map((c) => c.id));
  const byName = (a: CellLike, b: CellLike) => a.name.localeCompare(b.name, undefined, { numeric: true });
  const node = (c: C): CellNode<C> => ({
    ...c,
    memberCount: counts.get(c.id) ?? 0,
    children: cells
      .filter((child) => child.parentId === c.id)
      .sort(byName)
      .map((child) => ({ ...child, memberCount: counts.get(child.id) ?? 0, children: [] })),
  });
  return cells
    .filter((c) => !c.parentId || !ids.has(c.parentId))
    .sort(byName)
    .map(node);
}

// Members in a group, counting its cells too.
export function totalMembers(node: CellNode<CellLike>): number {
  return node.memberCount + node.children.reduce((s, c) => s + c.memberCount, 0);
}
