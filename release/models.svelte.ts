import { WithEvents } from "../with-events-suede";
import {
  type YCodeCell,
  type YMarkdownCell,
  type NotebookChange,
  YNotebook,
  type ISharedCell,
  type YCellType,
} from "../python-yjs-suede";
import type { Output, Kernel } from "../python-web-kernel-suede";

export type SupportedCell = (YCodeCell | YMarkdownCell)["cell_type"];

export namespace Events {
  export type Cell = {
    "cell selected": [];
    "request select": [];
    "request select next": [type: SupportedCell | "any"];
    "request select previous": [type: SupportedCell | "any"];
    run: [];
    "cell executed": [outputs: Output.Any[], execution_count: number];
    keydown: [event: KeyboardEvent];
  };

  export type Notebook = {
    "cell executed": [
      cellIndex: number,
      outputs: Output.Any[],
      execution_count: number,
    ];
    "cell keydown": [cellIndex: number, event: KeyboardEvent];
  };
}

const isSupportedCell = (
  cell: ISharedCell | YCellType,
): cell is (ISharedCell | YCellType) & { cell_type: SupportedCell } =>
  cell.cell_type === ("code" satisfies SupportedCell) ||
  cell.cell_type === ("markdown" satisfies SupportedCell);

export class CellProxy extends WithEvents<Events.Cell> {
  id = $state<string>("");
  type = $state<SupportedCell>("code");

  constructor(id: string, type: SupportedCell) {
    super();
    this.id = id;
    this.type = type;
  }
}

export class Notebook extends YNotebook {
  readonly kernel: Kernel;
  readonly events = new WithEvents<Events.Notebook>();

  runID = $state<number>(0);
  cellProxies = $state<CellProxy[]>([]);

  readonly file: {
    name: string;
    path: string;
    readonly?: boolean;
  };

  get name() {
    return this.file.name;
  }

  get path() {
    return this.file.path;
  }

  get readonly() {
    return this.file.readonly ?? false;
  }

  readonly listener: Parameters<YNotebook["changed"]["connect"]>[0];

  constructor(
    args: ConstructorParameters<typeof YNotebook>[0] &
      Pick<Notebook, "file" | "kernel">,
  ) {
    super(args);
    this.file = args.file;
    this.kernel = args.kernel;
    this.listener = this.onChange.bind(this);
    this.changed.connect(this.listener);
    this.cellProxies = this.cells.map((cell) => {
      if (!isSupportedCell(cell))
        throw new Error(`Unsupported cell type: ${cell.cell_type}`);
      return new CellProxy(cell.id, cell.cell_type);
    });

    this.runID = Math.max(
      ...this.cells.map((c) =>
        c.cell_type === "code" ? (c.execution_count ?? 0) : 0,
      ),
    );
  }

  onChange(_: YNotebook, change: NotebookChange) {
    const { cellProxies: cellIDs } = this;
    let cellIndex = 0;
    change?.cellsChange?.forEach(({ retain, delete: _delete, insert }) => {
      if (retain !== undefined) cellIndex += retain;
      if (_delete) cellIDs.splice(cellIndex, _delete);
      if (insert) {
        const proxies = insert
          .filter(isSupportedCell)
          .map(({ id, cell_type }) => new CellProxy(id, cell_type));
        cellIDs.splice(cellIndex, 0, ...proxies);
        cellIndex += insert.length;
      }
    });
  }

  dispose() {
    super.dispose();
    this.changed.disconnect(this.listener);
  }

  static FromSerialized(
    construct: ConstructorParameters<typeof Notebook>[0],
    serialized: Parameters<YNotebook["fromJSON"]>[0],
  ) {
    const notebook = new Notebook(construct);
    notebook.fromJSON(serialized);
    return notebook;
  }
}
