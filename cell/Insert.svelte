<script lang="ts" module>
  import type { Notebook } from "../model/notebook.svelte";

  export type Props = { notebook: Notebook; at: number };
</script>

<script lang="ts">
  let { notebook, at }: Props = $props();
</script>

<div class="insert">
  <button
    data-testid="add-code"
    title="Insert a code cell here"
    onclick={() => notebook.select(notebook.add("code", at))}
  >
    + Code
  </button>
  <button
    data-testid="add-markdown"
    title="Insert a markdown cell here"
    onclick={() => notebook.add("markdown", at)}
  >
    + Markdown
  </button>
</div>

<style>
  .insert {
    display: flex;
    gap: 0.5rem;
    justify-content: center;
    padding: 0.25rem;
    opacity: 0.35;
    transition: opacity 0.15s ease;
  }

  .insert:hover,
  .insert:focus-within {
    opacity: 1;
  }

  button {
    font-size: 0.75rem;
    padding: 0.15rem 0.6rem;
    border: 1px solid #d1d5db;
    border-radius: 999px;
    background: white;
    color: #374151;
    cursor: pointer;
  }

  button:hover {
    background: #f3f4f6;
  }
</style>
