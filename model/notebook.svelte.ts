import type { YNotebook } from "@jupyter/ydoc";
import type { INotebookContent } from "@jupyterlab/nbformat";
import type { Kernel } from "../../python-notebook-suede.python-web-kernel-suede";
import { execute } from "../execution/run";
import { labelsFor } from "../execution/traceback";
import { Cell, CodeCell, cellFor, executable } from "./cell.svelte";
import { MemoryNotebook } from "./memory";
import { SharedNotebook } from "./shared";
import type { CellStore, CellType, NotebookStore, Unsubscribe } from "./store";
import { join } from "../utils";

let opened = 0;

const DEFAULT_NAME = "notebook.ipynb";

/**
 * Cells appear as files beside their notebook, so two notebooks sharing a
 * directory must not share cell ids — which two views of one shared document
 * do. Absent a directory of the caller's own, each notebook gets one.
 */
const ownDirectory = () => ({ path: `notebook-${++opened}` });

const highestCount = (store: NotebookStore) =>
  store.cells.reduce(
    (highest, cell) =>
      cell.type === "code" ? Math.max(highest, cell.executionCount ?? 0) : highest,
    0,
  );

export type NotebookOptions = {
  store: NotebookStore;
  /** Without one, the notebook displays but does not run. */
  kernel?: Kernel;
  /** The directory the notebook file lives in, and its cells beside it. */
  parent?: { path: string };
  /** The notebook's file name, which may change while it is open. */
  name?: string;
  readonly?: boolean;
};

type Derived = Omit<NotebookOptions, "store">;

export class Notebook {
  readonly store: NotebookStore;
  readonly kernel?: Kernel;
  readonly parent: { path: string };

  name = $state(DEFAULT_NAME);
  readonly = $state(false);
  cells = $state<Cell[]>([]);
  selected = $state<Cell | undefined>();

  /** Whether a cell's editor has the keyboard, and so owns undo. */
  editing = $state(false);

  undoable = $state(false);
  redoable = $state(false);

  private readonly adopted = new Map<CellStore, Cell>();
  private readonly stop: Unsubscribe;
  private executions: number;

  constructor({
    store,
    kernel,
    parent,
    name = DEFAULT_NAME,
    readonly = false,
  }: NotebookOptions) {
    this.store = store;
    this.kernel = kernel;
    this.parent = parent ?? ownDirectory();
    this.name = name;
    this.readonly = readonly;
    this.executions = highestCount(store);
    this.absorb();
    this.stop = store.observe(() => this.absorb());
  }

  /** Where the notebook file itself is, which follows its name. */
  get path() {
    return join(this.parent.path, this.name);
  }

  get code() {
    return this.cells.filter(executable);
  }

  /** The ordered files the language server analyses as one namespace. */
  get files() {
    return this.code.map((cell) => cell.file);
  }

  at(index: number): Cell | undefined {
    return this.cells[index];
  }

  add(type: CellType, at = this.cells.length) {
    this.store.insert(at, { type });
    return this.cells[at];
  }

  addBelow(cell: Cell, type: CellType) {
    return this.add(type, cell.index + 1);
  }

  remove(cell: Cell) {
    const index = cell.index;
    if (index < 0) return;
    if (this.selected === cell) this.selected = this.at(index + 1) ?? this.at(index - 1);
    this.store.remove(index);
  }

  move(cell: Cell, to: number) {
    const from = cell.index;
    if (from < 0 || to < 0 || to >= this.cells.length || to === from) return;
    this.store.move(from, to);
  }

  select(cell: Cell | undefined) {
    this.selected = cell;
  }

  /**
   * Takes back the last change to which cells there are and in what order.
   * Text is not this to take back: while an editor has the keyboard it
   * answers for undo itself, and this is reached only from outside one.
   */
  undo() {
    this.store.undo();
  }

  redo() {
    this.store.redo();
  }

  /** The next cell of `type` in `step`'s direction, for keyboard navigation. */
  neighbour(from: Cell, step: 1 | -1, type?: CellType) {
    for (let i = from.index + step; i >= 0 && i < this.cells.length; i += step) {
      const cell = this.cells[i];
      if (type === undefined || cell.type === type) return cell;
    }
    return undefined;
  }

  run(cell: CodeCell) {
    return execute(this.kernelOrThrow(), cell, () => ++this.executions);
  }

  runAll() {
    this.code.forEach((cell) => this.run(cell));
  }

  runBefore(cell: Cell) {
    this.code.filter((code) => code.index < cell.index).forEach((code) => this.run(code));
  }

  runAfter(cell: Cell) {
    this.code.filter((code) => code.index > cell.index).forEach((code) => this.run(code));
  }

  interrupt() {
    this.code.forEach((cell) => cell.interrupt());
  }

  /** What a traceback should say instead of where the cells were written. */
  labels() {
    return labelsFor(this.cells);
  }

  toJSON(): INotebookContent {
    return this.store.toJSON();
  }

  dispose() {
    this.stop();
    this.adopted.forEach((cell) => cell.dispose());
    this.adopted.clear();
  }

  private kernelOrThrow() {
    if (!this.kernel)
      throw new Error("This notebook was opened without a kernel to run it");
    return this.kernel;
  }

  private absorb() {
    const cells = this.store.cells.map((store) => this.adopt(store));
    this.discardAllBut(cells);
    this.cells = cells;
    this.undoable = this.store.canUndo();
    this.redoable = this.store.canRedo();
  }

  private adopt(store: CellStore) {
    const existing = this.adopted.get(store);
    if (existing) return existing;
    const cell = cellFor(this, store);
    this.adopted.set(store, cell);
    return cell;
  }

  private discardAllBut(kept: Cell[]) {
    const surviving = new Set(kept);
    for (const [store, cell] of this.adopted) {
      if (surviving.has(cell)) continue;
      cell.dispose();
      this.adopted.delete(store);
    }
  }

  static memory(content: Partial<INotebookContent> = {}, options: Derived = {}) {
    return new Notebook({ ...options, store: MemoryNotebook.from(content) });
  }

  static shared(notebook: YNotebook, options: Derived = {}) {
    return new Notebook({ ...options, store: new SharedNotebook(notebook) });
  }
}
