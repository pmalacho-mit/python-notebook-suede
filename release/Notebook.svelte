<script lang="ts" module>
  import Frame from "./cell/Frame.svelte";
  import Insert from "./cell/Insert.svelte";
  import { chainedCells } from "./editor/chain";
  import type { Notebook } from "./model/notebook.svelte";

  export type Props = {
    notebook: Notebook;
    fontSize?: number;
  };

  const pressed = (event: KeyboardEvent) => event.key.toLowerCase();

  /** How a notebook has always spelled it, and how the platform does. */
  const undoes = (event: KeyboardEvent) =>
    pressed(event) === "z" && !event.shiftKey;

  const redoes = (event: KeyboardEvent) =>
    (pressed(event) === "z" && event.shiftKey) || pressed(event) === "y";
</script>

<script lang="ts">
  import { tick } from "svelte";

  let { notebook, fontSize = 14 }: Props = $props();

  const chain = chainedCells(() => notebook.files);

  $effect(chain.register);
  $effect(() => chain.settle());

  let root = $state<HTMLElement>();

  /** Two notebooks on a page each answer for what happens inside them. */
  const happenedHere = ({ target }: Event) =>
    target instanceof Node && root?.contains(target) === true;

  /**
   * A control that removes or disables itself takes the keyboard down with it,
   * and the browser hands it back to the document — where the notebook's own
   * shortcuts no longer reach. Deleting a cell and undoing it is one gesture,
   * so the notebook keeps the keyboard rather than making the reader click to
   * give it back.
   */
  const keepTheKeyboard = () => {
    if (!root || root.contains(document.activeElement)) return;
    root.focus();
  };

  /** Captured, so the target is read before what was clicked can be removed. */
  const onclickcapture = (event: MouseEvent) => {
    if (happenedHere(event)) void tick().then(keepTheKeyboard);
  };

  const take = (event: KeyboardEvent, run: () => void) => {
    event.preventDefault();
    run();
  };

  /** An editor with the keyboard undoes its own text; nothing here overrides it. */
  const onkeydown = (event: KeyboardEvent) => {
    if (notebook.editing || !happenedHere(event)) return;
    if (undoes(event)) take(event, () => notebook.undo());
    else if (redoes(event)) take(event, () => notebook.redo());
  };
</script>

<svelte:window {onkeydown} {onclickcapture} />

<div bind:this={root} class="notebook" data-testid="notebook" tabindex="-1">
  <div class="toolbar">
    <button
      data-testid="run-all"
      title="Run every cell, in order"
      onclick={() => notebook.runAll()}
    >
      Run all
    </button>
    <button
      data-testid="interrupt"
      title="Stop whatever is running"
      onclick={() => notebook.interrupt()}
    >
      Interrupt
    </button>
    <span class="divider"></span>
    <button
      data-testid="undo"
      title="Undo the last change to the cells (Z)"
      disabled={!notebook.undoable}
      onclick={() => notebook.undo()}
    >
      Undo
    </button>
    <button
      data-testid="redo"
      title="Redo the last undone change to the cells (Shift+Z)"
      disabled={!notebook.redoable}
      onclick={() => notebook.redo()}
    >
      Redo
    </button>
  </div>

  <div class="cells" data-testid="cells">
    {#each notebook.cells as cell, index (cell.id)}
      <Insert {notebook} at={index} />
      <Frame {notebook} {cell} {fontSize} />
    {/each}
    <Insert {notebook} at={notebook.cells.length} />
  </div>
</div>

<style>
  .notebook {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    background: #f3f4f6;
  }

  .toolbar {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid #e5e7eb;
    background: white;
  }

  .divider {
    width: 1px;
    align-self: stretch;
    background: #e5e7eb;
  }

  .toolbar button {
    font-size: 0.8125rem;
    padding: 0.25rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    background: white;
    color: #374151;
    cursor: pointer;
  }

  .toolbar button:hover:not(:disabled) {
    background: #f3f4f6;
  }

  .toolbar button:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .cells {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 0.5rem 1rem 2rem;
  }
</style>
