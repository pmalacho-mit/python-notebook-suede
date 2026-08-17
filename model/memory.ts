import type {
  ICell,
  IMarkdownCell,
  INotebookContent,
  IOutput,
  IRawCell,
  MultilineString,
} from "@jupyterlab/nbformat";
import { nanoid } from "nanoid";
import { Announcer } from "./announce";
import { History } from "./history";
import type {
  CellStore,
  CellType,
  CodeCellStore,
  NewCell,
  NotebookStore,
  ProseCellStore,
} from "./store";

const NBFORMAT = 4;
const NBFORMAT_MINOR = 5;

/** nbformat writes a cell's text as either one string or a list of lines. */
const joined = (source: MultilineString | undefined) =>
  Array.isArray(source) ? source.join("") : (source ?? "");

const typeOf = (cell: ICell): CellType =>
  cell.cell_type === "code" || cell.cell_type === "markdown"
    ? cell.cell_type
    : "raw";

abstract class MemoryCell extends Announcer {
  readonly id = nanoid();

  private text: string;

  constructor(source: string) {
    super();
    this.text = source;
  }

  get source() {
    return this.text;
  }

  set source(value: string) {
    if (value === this.text) return;
    this.text = value;
    this.announce();
  }

  abstract toJSON(): ICell;
}

class MemoryProse extends MemoryCell implements ProseCellStore {
  constructor(
    readonly type: "markdown" | "raw",
    source: string,
  ) {
    super(source);
  }

  toJSON = (): IMarkdownCell | IRawCell => ({
    id: this.id,
    cell_type: this.type,
    source: this.source,
    metadata: {},
  });
}

class MemoryCode extends MemoryCell implements CodeCellStore {
  readonly type = "code" as const;

  private count: number | null = null;
  private produced: IOutput[] = [];

  get outputs() {
    return this.produced;
  }

  get executionCount() {
    return this.count;
  }

  set executionCount(value: number | null) {
    if (value === this.count) return;
    this.count = value;
    this.announce();
  }

  append = (output: IOutput) => {
    this.produced = [...this.produced, output];
    this.announce();
  };

  clear = () => {
    if (this.produced.length === 0) return;
    this.produced = [];
    this.announce();
  };

  toJSON = (): ICell => ({
    id: this.id,
    cell_type: "code",
    source: this.source,
    metadata: {},
    execution_count: this.count,
    outputs: this.produced,
  });
}

type Held = MemoryCode | MemoryProse;

const created = ({ type, source = "" }: NewCell): Held =>
  type === "code" ? new MemoryCode(source) : new MemoryProse(type, source);

const restored = (cell: ICell): Held => {
  const rebuilt = created({ type: typeOf(cell), source: joined(cell.source) });
  if (!(rebuilt instanceof MemoryCode)) return rebuilt;
  rebuilt.executionCount = (cell.execution_count as number | null) ?? null;
  (cell.outputs as IOutput[] | undefined)?.forEach(rebuilt.append);
  return rebuilt;
};

/**
 * A notebook that lives nowhere but here. Everything a shared notebook can do
 * except be edited by someone else at the same time.
 */
export class MemoryNotebook extends Announcer implements NotebookStore {
  private held: Held[] = [];

  private readonly history = new History<Held[]>();

  private metadata: INotebookContent["metadata"] = {};

  get cells(): readonly CellStore[] {
    return this.held;
  }

  insert = (index: number, cell: NewCell) =>
    this.changing((held) => held.toSpliced(index, 0, created(cell)));

  remove = (index: number) => this.changing((held) => held.toSpliced(index, 1));

  move = (from: number, to: number) =>
    this.changing((held) => {
      const without = held.toSpliced(from, 1);
      return without.toSpliced(to, 0, held[from]);
    });

  undo = () => this.restore(this.history.undo(this.held));

  redo = () => this.restore(this.history.redo(this.held));

  canUndo = () => this.history.canUndo();

  canRedo = () => this.history.canRedo();

  /** Every change replaces the list rather than editing it, so the list the
   *  history kept is still the list that was there. */
  private changing(rearrange: (held: Held[]) => Held[]) {
    this.history.record(this.held);
    this.held = rearrange(this.held);
    this.announce();
  }

  private restore(held: Held[] | undefined) {
    if (!held) return;
    this.held = held;
    this.announce();
  }

  toJSON = (): INotebookContent => ({
    cells: this.held.map((cell) => cell.toJSON()),
    metadata: this.metadata,
    nbformat: NBFORMAT,
    nbformat_minor: NBFORMAT_MINOR,
  });

  static from(content: Partial<INotebookContent> = {}) {
    const notebook = new MemoryNotebook();
    notebook.held = (content.cells ?? []).map(restored);
    notebook.metadata = content.metadata ?? {};
    return notebook;
  }
}
