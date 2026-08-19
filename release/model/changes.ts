import type { Cell } from "./cell.svelte";

export type Move = { cell: Cell; from: number; to: number };

/** What became of a notebook's cells, whoever or whatever caused it. */
export type CellsChange = {
  added: readonly Cell[];
  removed: readonly Cell[];
  moved: readonly Move[];
};

export const NOCHANGES: CellsChange = { added: [], removed: [], moved: [] };

const absentFrom = (these: readonly Cell[], those: ReadonlySet<Cell>) =>
  these.filter((cell) => !those.has(cell));

const reordering = (before: readonly Cell[], after: readonly Cell[]): Move[] =>
  before
    .map((cell, from) => ({ cell, from, to: after.indexOf(cell) }))
    .filter(({ from, to }) => from !== to);

/**
 * Comparing the two lists is enough because a cell that stays keeps the same
 * wrapper throughout. One that leaves and comes back — an undone deletion —
 * is wrapped afresh, and reads here as a removal and then an addition, which
 * is what happened; what it brings back with it is its store, and so its text
 * and its outputs.
 */
export const between = (
  before: readonly Cell[],
  after: readonly Cell[],
): CellsChange => {
  const added = absentFrom(after, new Set(before));
  const removed = absentFrom(before, new Set(after));
  // A reorder is only a reorder when nothing came or went: an insert or a
  // delete shifts every index after it, and none of that is a move.
  const settled = added.length === 0 && removed.length === 0;
  return { added, removed, moved: settled ? reordering(before, after) : [] };
};

export const nothingIn = ({ added, removed, moved }: CellsChange) =>
  added.length === 0 && removed.length === 0 && moved.length === 0;
