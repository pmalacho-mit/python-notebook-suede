import {
  YCodeCell,
  YNotebook,
  type NotebookChange,
  type YCellType,
} from "@jupyter/ydoc";
import type { IOutput } from "@jupyterlab/nbformat";
import type {
  CellStore,
  CellType,
  CodeCellStore,
  NewCell,
  NotebookStore,
  ProseCellStore,
} from "./store";

const typeOf = (cell: YCellType): CellType =>
  cell.cell_type === "code" || cell.cell_type === "markdown"
    ? cell.cell_type
    : "raw";

class SharedCell {
  constructor(private readonly held: YCellType) {}

  get id() {
    return this.held.id;
  }

  get source() {
    return this.held.source;
  }

  set source(value: string) {
    if (value !== this.held.source) this.held.source = value;
  }

  get sourceSync() {
    return this.held.ysource;
  }

  observe = (listen: () => void) => {
    const relay = () => listen();
    this.held.changed.connect(relay);
    return () => this.held.changed.disconnect(relay);
  };
}

class SharedProse extends SharedCell implements ProseCellStore {
  constructor(
    cell: YCellType,
    readonly type: "markdown" | "raw",
  ) {
    super(cell);
  }
}

class SharedCode extends SharedCell implements CodeCellStore {
  readonly type = "code" as const;

  constructor(private readonly code: YCodeCell) {
    super(code);
  }

  get executionCount() {
    return this.code.execution_count;
  }

  set executionCount(value: number | null) {
    this.code.execution_count = value;
  }

  get outputs(): readonly IOutput[] {
    return this.code.outputs;
  }

  append = (output: IOutput) => {
    const end = this.code.outputs.length;
    this.code.updateOutputs(end, end, [output]);
  };

  clear = () => this.code.clearOutputs();
}

const wrapped = (cell: YCellType): CellStore =>
  cell instanceof YCodeCell
    ? new SharedCode(cell)
    : new SharedProse(cell, typeOf(cell) as "markdown" | "raw");

const changesCells = (change: NotebookChange) => change.cellsChange !== undefined;

/**
 * A notebook held in a Yjs document, so that two people editing it at once
 * converge instead of overwriting one another.
 */
export class SharedNotebook implements NotebookStore {
  private readonly wrappers = new WeakMap<YCellType, CellStore>();

  constructor(readonly notebook: YNotebook) {}

  get cells(): readonly CellStore[] {
    return this.notebook.cells.map((cell) => this.wrap(cell));
  }

  insert = (index: number, { type, source = "" }: NewCell) =>
    void this.notebook.insertCell(index, { cell_type: type, source });

  remove = (index: number) => this.notebook.deleteCell(index);

  move = (from: number, to: number) => this.notebook.moveCell(from, to);

  toJSON = () => this.notebook.toJSON();

  /**
   * Yjs tracks only what this reader did, and only what was transacted through
   * the document — which is the cell list, since a bound editor writes text
   * under an origin of its own. So this takes back a deletion without taking
   * back a collaborator's typing.
   */
  undo = () => this.notebook.undo();

  redo = () => this.notebook.redo();

  canUndo = () => this.notebook.canUndo();

  canRedo = () => this.notebook.canRedo();

  observe = (listen: () => void) => {
    const relay = (_: YNotebook, change: NotebookChange) =>
      changesCells(change) ? listen() : undefined;
    this.notebook.changed.connect(relay);
    return () => this.notebook.changed.disconnect(relay);
  };

  /** One wrapper per shared cell, so that a cell keeps its identity. */
  private wrap(cell: YCellType) {
    const existing = this.wrappers.get(cell);
    if (existing) return existing;
    const wrapper = wrapped(cell);
    this.wrappers.set(cell, wrapper);
    return wrapper;
  }
}
