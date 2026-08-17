<script lang="ts" module>
  import { asHtml } from "../markdown";
  import type { Cell } from "../model/cell.svelte";

  export type Props = { cell: Cell };
</script>

<script lang="ts">
  let { cell }: Props = $props();

  let html = $state("");

  $effect(() => {
    const rendered = asHtml(cell.source);
    if (typeof rendered === "string") return void (html = rendered);
    let current = true;
    rendered.then((value) => current && (html = value));
    return () => (current = false);
  });
</script>

<div class="prose" data-testid="markdown">
  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
  {@html html}
</div>

<style>
  .prose {
    padding: 0.75rem 1rem;
    font-size: 0.9375rem;
    line-height: 1.6;
  }

  .prose :global(h1) {
    font-size: 1.75em;
    font-weight: 700;
    margin: 0.4em 0;
    border-bottom: 2px solid #e5e7eb;
    padding-bottom: 0.2em;
  }

  .prose :global(h2) {
    font-size: 1.4em;
    font-weight: 600;
    margin: 0.5em 0 0.3em;
    border-bottom: 1px solid #e5e7eb;
    padding-bottom: 0.2em;
  }

  .prose :global(h3) {
    font-size: 1.2em;
    font-weight: 600;
    margin: 0.4em 0;
  }

  .prose :global(p) {
    margin: 0.6em 0;
  }

  .prose :global(ul),
  .prose :global(ol) {
    margin: 0.5em 0;
    padding-left: 1.75em;
  }

  .prose :global(ul) {
    list-style: disc;
  }

  .prose :global(ol) {
    list-style: decimal;
  }

  .prose :global(code) {
    background: #f3f4f6;
    padding: 0.15em 0.35em;
    border-radius: 3px;
    font-family: ui-monospace, "Consolas", "Monaco", monospace;
    font-size: 0.9em;
  }

  .prose :global(pre) {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    padding: 0.75rem;
    overflow-x: auto;
  }

  .prose :global(pre code) {
    background: transparent;
    padding: 0;
  }

  .prose :global(blockquote) {
    margin: 0.75em 0;
    padding: 0.4em 0.9em;
    border-left: 4px solid #d1d5db;
    background: #f9fafb;
    color: #4b5563;
  }

  .prose :global(a) {
    color: #2563eb;
  }

  .prose :global(table) {
    border-collapse: collapse;
    width: 100%;
    font-size: 0.875rem;
  }

  .prose :global(th),
  .prose :global(td) {
    border: 1px solid #e5e7eb;
    padding: 0.4em 0.6em;
    text-align: left;
  }

  .prose :global(th) {
    background: #f9fafb;
  }

  .prose :global(img) {
    max-width: 100%;
  }
</style>
