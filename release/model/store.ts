import type { INotebookContent, IOutput } from "@jupyterlab/nbformat";
import type * as Y from "yjs";

export type CellType = "code" | "markdown" | "raw";

export type NewCell = { type: CellType; source?: string };

export type Unsubscribe = () => void;

type Held = {
  readonly id: string;
  source: string;
  /**
   * The shared text behind `source`, when the cell has one. Its presence is
   * what lets an editor bind to the cell rather than copy it, and its absence
   * is the whole of what a notebook without a backing document lacks.
   */
  readonly sourceSync?: Y.Text;
  /** Fires on every change to this cell, whoever made it. */
  observe: (listen: () => void) => Unsubscribe;
};

export type CodeCellStore = Held & {
  readonly type: "code";
  executionCount: number | null;
  readonly outputs: readonly IOutput[];
  append: (output: IOutput) => void;
  clear: () => void;
};

/** Everything a notebook shows but never runs. */
export type ProseCellStore = Held & { readonly type: "markdown" | "raw" };

export type CellStore = CodeCellStore | ProseCellStore;

/**
 * Where a notebook's cells actually live. Every read goes back to the owner,
 * so a notebook held in a shared document and one held in a plain object are
 * the same thing to everything above this line.
 */
export type NotebookStore = {
  readonly cells: readonly CellStore[];
  insert: (index: number, cell: NewCell) => void;
  remove: (index: number) => void;
  move: (from: number, to: number) => void;
  toJSON: () => INotebookContent;
  /** Fires whenever the list of cells changes. */
  observe: (listen: () => void) => Unsubscribe;
  /**
   * Takes back the last change to the list of cells — which cells there are
   * and in what order. What is inside a cell is the editor's to undo, and a
   * shared store's is only ever this reader's own changes.
   */
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
};

export const runnable = (cell: CellStore): cell is CodeCellStore =>
  cell.type === "code";
