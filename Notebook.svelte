<script lang="ts">
  import Code from "./Code.svelte";
  import Markdown from "./Markdown.svelte";
  import { Notebook as Model, type SupportedCell } from "./models.svelte";
  import { WithEvents } from "../with-events-suede";

  let { model }: { model: Model } = $props();

  let selectedIndex = $state<number | undefined>();
  let container = $state<HTMLElement>();

  const search = (type: SupportedCell, direction: 1 | -1) => {
    if (selectedIndex === undefined) return;
    let i = selectedIndex + direction;
    while (i >= 0 && i < model.cellProxies.length) {
      if (model.cellProxies[i].type === type) return i;
      i += direction;
    }
    return model.cellProxies[i]?.type === type ? i : selectedIndex;
  };

  $effect(() =>
    WithEvents.Collect(model.cellProxies).subscribe({
      "request select": (_, index) => (selectedIndex = index),
      "request select next": (type, _, index) =>
        (selectedIndex = type === "any" ? index + 1 : search(type, 1)),
      "request select previous": (type, _, index) =>
        (selectedIndex = type === "any" ? index - 1 : search(type, -1)),
      keydown: (event, _, index) =>
        model.events.fire("cell keydown", index, event),
    }),
  );

  const getRunID = () => ++model.runID;

  const wrappers = new Array<HTMLElement>();

  const scrollTo = (index: number) =>
    wrappers[index]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
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

  export const getModel = () => model;

  const runRange = (start: number, end?: number) => {
    end ??= model.cellProxies.length;
    for (let i = start; i < end; i++) {
      const proxy = model.cellProxies[i];
      if (proxy.type === "code") proxy.fire("run");
    }
  };

  $effect(() =>
    WithEvents.Collect(model.cellProxies).subscribe({
      "cell executed": (outputs, runID, _, index) =>
        model.events.fire("cell executed", index, outputs, runID),
    }),
  );
</script>

<div style:height="100%" style:width="100%" style:overflow="hidden">
  <div
    bind:this={container}
    style:height="100%"
    style:padding="1rem"
    style:gap="1rem"
    style:overflow-y="auto"
  >
    {#each model.cellProxies as proxy, index}
      {@const cell = getCell(index, proxy.id)}
      <div bind:this={wrappers[index]}>
        {#if cell.cell_type === "code"}
          {@const selected = selectedIndex === index}
          {@const reveal = () => scrollTo(index)}
          {@const runAbove = () => runRange(0, index)}
          {@const runBelow = () => runRange(index + 1)}
          <Code
            notebook={model}
            {proxy}
            {cell}
            {getRunID}
            {selected}
            {reveal}
            {index}
            {runAbove}
            {runBelow}
          />
        {:else if cell.cell_type === "markdown"}
          <Markdown {cell} />
        {/if}
      </div>
    {/each}
  </div>
</div>
