import type { IOutput } from "@jupyterlab/nbformat";
import type { Run } from "../../python-notebook-suede.python-web-kernel-suede";
import type { Editor } from "../../python-notebook-suede.python-monaco-suede";
import type { Notebook } from "./notebook.svelte";
import type { CellStore, CodeCellStore, Unsubscribe } from "./store";
import { runnable } from "./store";
import { join } from "../utils";

export type Status = "idle" | "queued" | "running" | "interrupting";

const withoutExtension = (name: string) => name.replace(/\.[^./]+$/, "");

/**
 * A cell as the Monaco editor wants it: a file. Nothing is copied — every
 * read reaches the cell, so the editor and the store never disagree.
 */
class CellFile implements Editor.Model {
  constructor(private readonly cell: Cell) {}

  /** Names the notebook it belongs to, so that anything reporting a path —
   *  a language server, a stack trace, a profiler — says where to look. */
  get name() {
    return `${withoutExtension(this.cell.notebook.name)}-cell-${this.cell.id}.py`;
  }

  /**
   * A sibling of the notebook file rather than a child of it, so that a cell
   * imports what sits beside the notebook the way a script in that directory
   * would.
   */
  get path() {
    return join(this.cell.notebook.parent.path, this.name);
  }

  get readonly() {
    return this.cell.notebook.readonly;
  }

  get sourceSync() {
    return this.cell.store.sourceSync;
  }

  get source() {
    return this.cell.source;
  }

  /**
   * A shared cell's text reaches the store through the editor's binding to it,
   * which is the only writer that knows what changed. Taking the editor's
   * whole document as well would let a value it was opened with delete text
   * that arrived from someone else in the meantime.
   */
  set source(value: string) {
    if (this.sourceSync) return;
    this.cell.write(value);
  }
}

export class Cell {
  readonly file = new CellFile(this);

  source = $state("");

  private stop?: Unsubscribe;

  constructor(
    readonly notebook: Notebook,
    readonly store: CellStore,
  ) {}

  get id() {
    return this.store.id;
  }

  get type() {
    return this.store.type;
  }

  get index() {
    return this.notebook.cells.indexOf(this);
  }

  write(source: string) {
    this.store.source = source;
  }

  /** Begins mirroring the store. Separate from construction so that a
   * subclass has finished initialising before its first read. */
  connect() {
    this.absorb();
    this.stop = this.store.observe(() => this.absorb());
    return this;
  }

  dispose() {
    this.stop?.();
  }

  protected absorb() {
    this.source = this.store.source;
  }
}

export class CodeCell extends Cell {
  outputs = $state.raw<readonly IOutput[]>([]);
  executionCount = $state<number | null>(null);
  status = $state<Status>("idle");

  private job?: Run.Job;

  constructor(
    notebook: Notebook,
    private readonly code: CodeCellStore,
  ) {
    super(notebook, code);
  }

  get busy() {
    return this.status !== "idle";
  }

  /** Clears what the last run left behind before the next one is started. */
  queue(run: () => Run.Job) {
    this.code.clear();
    this.executionCount = null;
    this.status = "queued";
    return (this.job = run());
  }

  started() {
    this.status = "running";
  }

  received(output: IOutput) {
    this.code.append(output);
  }

  completed(executionCount: number) {
    this.code.executionCount = executionCount;
    this.status = "idle";
  }

  /**
   * Python is asked to stop; whether it can is up to what it is doing. A cell
   * blocked in `time.sleep` is not running bytecode, and the interpreter only
   * looks between one bytecode and the next — so this reports that it was
   * asked, and the run itself reports when it ended.
   */
  interrupt() {
    if (!this.busy) return;
    this.job?.interrupt();
    this.status = "interrupting";
  }

  protected absorb() {
    super.absorb();
    this.outputs = this.code.outputs;
    this.executionCount = this.code.executionCount;
  }
}

export const cellFor = (notebook: Notebook, store: CellStore) =>
  runnable(store)
    ? new CodeCell(notebook, store).connect()
    : new Cell(notebook, store).connect();

export const executable = (cell: Cell): cell is CodeCell =>
  cell instanceof CodeCell;
