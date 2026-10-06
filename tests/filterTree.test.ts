import { describe, expect, it } from "vitest";
import { countFiles, filterTreeByDateRange } from "../src/utils/filterTree";

type Node = {
  name: string;
  type: string;
  mtime?: string;
  children?: Node[];
};

const tree: Node[] = [
  {
    name: "folderA",
    type: "folder",
    children: [
      { name: "jan.pdf", type: "file", mtime: "2026-01-10" },
      { name: "feb.pdf", type: "file", mtime: "2026-02-15" },
      {
        name: "nested",
        type: "folder",
        children: [{ name: "mar.pdf", type: "file", mtime: "2026-03-20" }],
      },
    ],
  },
  {
    name: "empty",
    type: "folder",
    children: [{ name: "old.pdf", type: "file", mtime: "2025-12-01" }],
  },
  { name: "root.pdf", type: "file", mtime: "2026-02-01" },
];

describe("filterTreeByDateRange", () => {
  it("returns the original tree when no range is set", () => {
    expect(filterTreeByDateRange(tree)).toBe(tree);
    expect(filterTreeByDateRange(tree, "", "")).toBe(tree);
  });

  it("keeps matching files and drops the rest", () => {
    const result = filterTreeByDateRange(tree, "2026-02-01", "2026-02-28");
    expect(result.map((n) => n.name).sort()).toEqual(["folderA", "root.pdf"]);
    const folderA = result.find((n) => n.name === "folderA")!;
    expect(folderA.children!.map((n) => n.name)).toEqual(["feb.pdf"]);
  });

  it("keeps parent folders of nested matches", () => {
    const result = filterTreeByDateRange(tree, "2026-03-01", "2026-03-31");
    expect(result.map((n) => n.name)).toEqual(["folderA"]);
    const nested = result[0].children!.find((n) => n.name === "nested")!;
    expect(nested.children!.map((n) => n.name)).toEqual(["mar.pdf"]);
  });

  it("drops folders with no matching descendants", () => {
    const result = filterTreeByDateRange(tree, "2026-01-01", "2026-01-31");
    expect(result.map((n) => n.name)).toEqual(["folderA"]);
    expect(result[0].children!.map((n) => n.name)).toEqual(["jan.pdf"]);
  });

  it("supports open-ended ranges", () => {
    const fromOnly = filterTreeByDateRange(tree, "2026-03-01", "");
    expect(fromOnly.map((n) => n.name)).toEqual(["folderA"]);

    const toOnly = filterTreeByDateRange(tree, "", "2025-12-31");
    expect(toOnly.map((n) => n.name)).toEqual(["empty"]);
  });

  it("treats boundaries as inclusive and swaps inverted ranges", () => {
    const exact = filterTreeByDateRange(tree, "2026-02-01", "2026-02-01");
    expect(exact.map((n) => n.name)).toEqual(["root.pdf"]);

    const swapped = filterTreeByDateRange(tree, "2026-02-28", "2026-02-01");
    expect(swapped.map((n) => n.name).sort()).toEqual(["folderA", "root.pdf"]);
  });

  it("keeps folders modified in range even without matching children", () => {
    const nodes: Node[] = [
      {
        name: "touched",
        type: "folder",
        mtime: "2026-02-10",
        children: [{ name: "old.pdf", type: "file", mtime: "2025-01-01" }],
      },
      {
        name: "stale",
        type: "folder",
        mtime: "2025-01-01",
        children: [{ name: "older.pdf", type: "file", mtime: "2025-01-01" }],
      },
    ];
    const result = filterTreeByDateRange(nodes, "2026-02-01", "2026-02-28");
    expect(result.map((n) => n.name)).toEqual(["touched"]);
    expect(result[0].children).toEqual([]);
  });

  it("excludes files without a date when filtering", () => {
    const nodes: Node[] = [{ name: "nodate.pdf", type: "file" }];
    expect(filterTreeByDateRange(nodes, "2026-01-01", "2026-12-31")).toEqual([]);
  });
});

describe("countFiles", () => {
  it("counts files recursively, ignoring folders", () => {
    expect(countFiles(tree)).toBe(5);
    const filtered = filterTreeByDateRange(tree, "2026-02-01", "2026-02-28");
    expect(countFiles(filtered)).toBe(2);
  });
});
