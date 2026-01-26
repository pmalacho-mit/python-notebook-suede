<script lang="ts" module>
  import { WithEvents } from "../with-events-suede";
  type Cell = {
    type: "code" | "markdown";
    content: string;
  };

  export class CellEvents extends WithEvents<{
    "cell selected": [];
    "request select": [];
    "request select next": [type: Cell["type"] | "any"];
    "request select previous": [type: Cell["type"] | "any"];
  }> {}

  class CodeCell extends CodeModel implements Cell {
    readonly type = "code";
    readonly events = new CellEvents();
  }

  class MarkdownCell implements Cell {
    readonly type = "markdown";
    readonly events = new CellEvents();

    content = $state("");
    constructor(content: string) {
      this.content = content;
    }
  }

  export class Model {
    runID = $state<number>(0);
    cells = $state<(CodeCell | MarkdownCell)[]>([]);
    name = $state<string>("");

    readonly psuedoParent = {
      path: "",
    };

    constructor({ runID, cells, name }: Partial<Model> = {}) {
      this.runID = runID ?? this.runID;
      this.name = name ?? this.name;

      this.cells = (cells ?? []).map(({ type, content }, index) =>
        type === "code"
          ? new CodeCell({
              content,
              parent: this.psuedoParent,
              name: `${this.name}.${index}.py`,
            })
          : new MarkdownCell(content),
      );
    }
  }

  const runtime = {
    input: (x: string) => prompt(x)!,
    fs: {
      root: "/home/pyodide",
      get(opts: { path: string }) {
        console.log("fs.get invoked with:", opts);
        return { ok: true as const, data: null };
      },
      put(opts: { path: string; value: string | null }) {
        console.log("fs.put invoked with:", opts);
        return { ok: true as const, data: undefined };
      },
      delete(opts: { path: string }) {
        console.log("fs.delete invoked with:", opts);
        return { ok: true as const, data: undefined };
      },
      move(opts: { path: string; newPath: string }) {
        console.log("fs.move invoked with:", opts);
        return { ok: true as const, data: undefined };
      },
      listDirectory(opts: { path: string }) {
        console.log("fs.listDirectory invoked with:", opts);
        return { ok: true as const, data: [] };
      },
      stat: (opts: { path: string }) =>
        console.log("fs.stat invoked with:", opts),
    },
  };
</script>

<script lang="ts">
  import Code, { Model as CodeModel } from "./CodeCell.svelte";
  import Markdown from "./Markdown.svelte";
  import PythonKernel from "./PythonKernel";

  const kernel = new PythonKernel(runtime);

  let { model }: { model: Model } = $props();

  let selectedIndex = $state<number | null>(null);

  $effect(() =>
    WithEvents.Collect(model.cells.map(({ events }) => events)).subscribe({
      "request select": (_, index) => (selectedIndex = index),
      "request select next": (type, _, index) => {
        if (type === "any") return (selectedIndex = index + 1);
        let i = index + 1;
        while (i < model.cells.length) {
          if (model.cells[i].type === type) {
            selectedIndex = i;
            return;
          }
          i++;
        }
      },
      "request select previous": (type, _, index) => {
        if (type === "any") return (selectedIndex = index - 1);
        let i = index - 1;
        while (i >= 0) {
          if (model.cells[i].type === type) {
            selectedIndex = i;
            return;
          }
          i--;
        }
      },
    }),
  );

  const getRunID = () => ++model.runID;
</script>

<div style="padding: 1rem; display: flex; flex-direction: column; gap: 1rem;">
  {#each model.cells as cell, index}
    {#if cell.type === "code"}
      {@const selected = selectedIndex === index}
      <Code model={cell} {kernel} {getRunID} {selected} />
    {:else if cell.type === "markdown"}
      <Markdown content={cell.content} />
    {/if}
  {/each}
</div>
