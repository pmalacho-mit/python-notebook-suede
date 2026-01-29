<script lang="ts" module>
  import { WithEvents } from "../with-events-suede";
  import {
    type YCodeCell,
    type YMarkdownCell,
    type NotebookChange,
    YNotebook,
    type ISharedCell,
  } from "../python-yjs-suede";

  type SupportedCellType = (YCodeCell | YMarkdownCell)["cell_type"];

  export type ICellEvents = {
    "cell selected": [];
    "request select": [];
    "request select next": [type: SupportedCellType | "any"];
    "request select previous": [type: SupportedCellType | "any"];
  };

  const isSupportedCell = (
    cell: ISharedCell,
  ): cell is ISharedCell & { cell_type: SupportedCellType } =>
    cell.cell_type === ("code" satisfies SupportedCellType) ||
    cell.cell_type === ("markdown" satisfies SupportedCellType);

  export class CellProxy extends WithEvents<ICellEvents> {
    id = $state<string>("");
    type = $state<SupportedCellType>("code");

    constructor(id: string, type: SupportedCellType) {
      super();
      this.id = id;
      this.type = type;
    }
  }

  export class Model extends YNotebook {
    readonly kernel: PythonKernel;
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
        Pick<Model, "file"> &
        Partial<Pick<Model, "kernel">>,
    ) {
      super(args);
      this.file = args.file;
      this.kernel =
        args.kernel ?? new PythonKernel(PythonKernel.DefaultEnvironment());
      this.listener = this.onChange.bind(this);
      this.changed.connect(this.listener);
    }

    onChange(_: YNotebook, change: NotebookChange) {
      const { cellProxies: cellIDs } = this;
      let cellIndex = 0;
      change.cellsChange?.forEach(({ retain, delete: _delete, insert }) => {
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
      construct: ConstructorParameters<typeof Model>[0],
      serialized: Parameters<YNotebook["fromJSON"]>[0],
    ) {
      const notebook = new Model(construct);
      console.log(notebook.ydoc);
      notebook.fromJSON(serialized);
      return notebook;
    }
  }
</script>

<script lang="ts">
  import Code from "./CodeCell.svelte";
  import Markdown from "./Markdown.svelte";
  import PythonKernel from "./PythonKernel";

  let { model }: { model: Model } = $props();

  let selectedIndex = $state<number | undefined>();
  let container = $state<HTMLElement>();

  const search = (type: SupportedCellType, direction: 1 | -1) => {
    if (selectedIndex === undefined) return;
    let i = selectedIndex + direction;
    while (i >= 0 && i < model.cellProxies.length) {
      if (model.cellProxies[i].type === type) return i;
      i += direction;
    }
  };

  $effect(() =>
    WithEvents.Collect(model.cellProxies).subscribe({
      "request select": (_, index) => (selectedIndex = index),
      "request select next": (type, _, index) =>
        (selectedIndex = type === "any" ? index + 1 : search(type, 1)),
      "request select previous": (type, _, index) =>
        (selectedIndex = type === "any" ? index - 1 : search(type, -1)),
    }),
  );

  const getRunID = () => ++model.runID;

  const wrappers = new Array<HTMLElement>();

  const scrollTo = (index: number) =>
    wrappers[index]?.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });

  $effect(() => {
    wrappers.length = model.cellProxies.length;
  });

  const getCell = (index: number, id: string) => {
    const cell = model.getCell(index);
    if (cell.id !== id)
      throw new Error(`Cell ID mismatch: expected ${id}, got ${cell.id}`);
    return cell;
  };
</script>

<div
  bind:this={container}
  style:height="100%"
  style:padding="1rem"
  style:gap="1rem"
  style:overflow="auto"
>
  {#each model.cellProxies as proxy, index}
    {@const cell = getCell(index, proxy.id)}
    <div bind:this={wrappers[index]}>
      {#if cell.cell_type === "code"}
        {@const selected = selectedIndex === index}
        {@const reveal = () => scrollTo(index)}
        <Code
          notebook={model}
          {proxy}
          {cell}
          {getRunID}
          {selected}
          {reveal}
          {index}
        />
      {:else if cell.cell_type === "markdown"}
        <Markdown {cell} />
      {/if}
    </div>
  {/each}
</div>
