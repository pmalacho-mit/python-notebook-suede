<script lang="ts" module>
  import { executable, type Cell, type Status } from "../model/cell.svelte";
  import type { Notebook } from "../model/notebook.svelte";
  import Code from "./Code.svelte";
  import Markdown from "./Markdown.svelte";
  import Raw from "./Raw.svelte";

  export type Props = {
    notebook: Notebook;
    cell: Cell;
    fontSize?: number;
  };
</script>

<script lang="ts">
  let { notebook, cell, fontSize = 14 }: Props = $props();

  let element = $state<HTMLElement>();

  const code = $derived(executable(cell) ? cell : undefined);
  const selected = $derived(notebook.selected === cell);

  const reveal = () =>
    element?.scrollIntoView({ behavior: "smooth", block: "nearest" });

  const toggleRun = () =>
    code?.busy ? code.interrupt() : code && notebook.run(code);

  const stopping: Partial<Record<Status, string>> = {
    queued: "Stop this cell before it starts",
    running: "Stop this cell",
    interrupting: "Stopping — Python stops at its next chance to",
  };
</script>

<div
  bind:this={element}
  class="cell"
  class:selected
  data-testid="cell"
  data-cell-type={cell.type}
  data-cell-id={cell.id}
  data-cell-status={code?.status ?? "idle"}
>
  <aside class="gutter">
    {#if code}
      <div class="count" data-testid="execution-count">
        In [{code.executionCount ?? " "}]
      </div>
      <button
        class="run"
        class:busy={code.busy}
        class:stopping={code.status === "interrupting"}
        data-testid="run-cell"
        aria-label={code.busy ? "interrupt this cell" : "run this cell"}
        title={stopping[code.status] ??
          "Run this cell (Ctrl+Enter, or Shift+Enter to go on)"}
        onclick={toggleRun}
      ></button>
    {/if}
  </aside>

  <div class="body">
    <header>
      <button
        class="kind"
        data-testid="select-cell"
        title="Select this cell"
        onclick={() => notebook.select(cell)}
      >
        {cell.type}
      </button>
      <div class="actions">
        {#if code}
          <button
            aria-label="run all cells above this one"
            title="Run all cells above this one"
            onclick={() => notebook.runBefore(cell)}
          >
            ⇧
          </button>
          <button
            aria-label="run all cells below this one"
            title="Run all cells below this one"
            onclick={() => notebook.runAfter(cell)}
          >
            ⇩
          </button>
        {/if}
        <button
          aria-label="move this cell up"
          title="Move this cell up"
          disabled={cell.index === 0}
          onclick={() => notebook.move(cell, cell.index - 1)}
        >
          ↑
        </button>
        <button
          aria-label="move this cell down"
          title="Move this cell down"
          disabled={cell.index === notebook.cells.length - 1}
          onclick={() => notebook.move(cell, cell.index + 1)}
        >
          ↓
        </button>
        <button
          aria-label="delete this cell"
          title="Delete this cell (undo with Z)"
          data-testid="delete-cell"
          onclick={() => notebook.remove(cell)}
        >
          ✕
        </button>
      </div>
    </header>

    {#if code}
      <Code cell={code} {fontSize} {reveal} />
    {:else if cell.type === "markdown"}
      <Markdown {cell} />
    {:else}
      <Raw {cell} />
    {/if}
  </div>
</div>

<style>
  .cell {
    display: flex;
    flex-direction: row;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    overflow: hidden;
    background: white;
    position: relative;
  }

  .cell.selected::before {
    content: "";
    position: absolute;
    left: 0;
    top: 10px;
    bottom: 10px;
    width: 4px;
    background: #3b82f6;
    border-radius: 999px;
  }

  .gutter {
    width: 68px;
    flex: none;
    background: #f9fafb;
    border-right: 1px solid #e5e7eb;
    padding: 0.6rem 0.4rem;
    text-align: center;
    font-size: 0.7rem;
    color: #6b7280;
  }

  .count {
    display: inline-block;
    padding: 0.1rem 0.35rem;
    border-radius: 6px;
    background: #f3f4f6;
    border: 1px solid #e5e7eb;
    color: #374151;
    margin-bottom: 0.5rem;
    white-space: nowrap;
  }

  .run {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    border: 1px solid #d1d5db;
    background: white;
    position: relative;
    cursor: pointer;
  }

  .run::after {
    content: "";
    position: absolute;
    top: 8px;
    left: 11px;
    border-top: 6px solid transparent;
    border-bottom: 6px solid transparent;
    border-left: 10px solid #374151;
  }

  .run.stopping {
    opacity: 0.5;
  }

  .run.busy::after {
    top: 9px;
    left: 9px;
    border: none;
    width: 10px;
    height: 10px;
    background: #374151;
  }

  .body {
    flex: 1;
    min-width: 0;
  }

  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.35rem 0.75rem;
    border-bottom: 1px solid #e5e7eb;
    font-size: 0.7rem;
    color: #6b7280;
  }

  .kind {
    background: none;
    border: none;
    padding: 0;
    font: inherit;
    color: inherit;
    text-transform: capitalize;
    cursor: pointer;
  }

  .actions {
    display: flex;
    gap: 4px;
  }

  .actions button {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    border: 1px solid #d1d5db;
    background: #f9fafb;
    color: #374151;
    font-size: 0.75rem;
    line-height: 1;
    cursor: pointer;
  }

  .actions button:hover:not(:disabled) {
    background: #e5e7eb;
  }

  .actions button:disabled {
    opacity: 0.35;
    cursor: default;
  }
</style>
