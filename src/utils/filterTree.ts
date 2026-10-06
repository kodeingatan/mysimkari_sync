/** Date-range filtering for the sidebar file tree.
 *
 * Nodes match by modification date (`mtime`, YYYY-MM-DD) inside the inclusive
 * range. A file matches on its own `mtime`; a folder matches on its own
 * `mtime` or when at least one descendant matches, so matching files always
 * keep their parent folders visible.
 */

export interface DateFilterableNode {
  type: string;
  mtime?: string;
  children?: DateFilterableNode[];
}

function normalizeDay(value: string | undefined): string {
  return (value || "").slice(0, 10);
}

/** Filter a file tree by an inclusive date range. Empty `from`/`to` means open-ended. */
export function filterTreeByDateRange<
  T extends { type: string; mtime?: string; children?: T[] },
>(nodes: T[], from?: string, to?: string): T[] {
  let lo = normalizeDay(from);
  let hi = normalizeDay(to);
  // Forgiving UX: a swapped range still filters instead of matching nothing.
  if (lo && hi && lo > hi) [lo, hi] = [hi, lo];
  if (!lo && !hi) return nodes;

  const inRange = (mtime?: string): boolean => {
    const day = normalizeDay(mtime);
    if (!day) return false;
    if (lo && day < lo) return false;
    if (hi && day > hi) return false;
    return true;
  };

  const result: T[] = [];
  for (const node of nodes) {
    if (node.type === "folder") {
      const children = filterTreeByDateRange(node.children ?? [], lo, hi);
      // Folder shows when it was itself modified in range, or when it
      // contains a match. Children are always filtered by the same range.
      if (children.length > 0 || inRange(node.mtime)) {
        result.push({ ...node, children });
      }
    } else if (inRange(node.mtime)) {
      result.push(node);
    }
  }
  return result;
}

/** Count files (not folders) in a tree. Used for the "N file cocok" hint. */
export function countFiles<T extends { type: string; children?: T[] }>(nodes: T[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.type === "folder") count += countFiles(node.children ?? []);
    else count += 1;
  }
  return count;
}
