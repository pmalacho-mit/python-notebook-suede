<script lang="ts" module>
  import type { YMarkdownCell, CellChange } from "../python-yjs-suede";
  import { marked } from "marked";

  const normalizeMarkdown = (text: string) =>
    text.replace(/^(#{1,6})([^\s#])/gm, "$1 $2");

  export type Props = {
    cell: YMarkdownCell;
  };

  const render = ({ source }: YMarkdownCell) =>
    marked(normalizeMarkdown(source));
</script>

<script lang="ts">
  let { cell }: Props = $props();

  let html = $state<string>("");

  /* svelte-ignore state_referenced_locally */
  const initial = render(cell);

  typeof initial === "string"
    ? (html = initial)
    : initial.then((value) => (html = value));

  const set = (_: YMarkdownCell, { sourceChange }: CellChange) => {
    if (sourceChange && sourceChange.length > 0) {
      const result = render(cell);
      typeof result === "string"
        ? (html = result)
        : result.then((value) => (html = value));
    }
  };

  $effect(() => {
    const { changed } = cell;
    changed.connect(set);
    return () => changed.disconnect(set);
  });
</script>

<div class="cell">
  <div class="cell-row">
    <div class="cell-body">
      <div class="cell-toolbar">Markdown</div>
      <div class="editor">
        {@html html}
      </div>
    </div>
  </div>
</div>

<style>
  /* ========== Cells ========== */
  .cell {
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    overflow: hidden;
    background: white;
  }

  .cell-row {
    display: flex;
    flex-direction: row;
  }

  .cell-body {
    flex: 1;
  }

  .cell-toolbar {
    padding: 0.5rem 1rem;
    border-bottom: 1px solid #e5e7eb;
    font-size: 0.75rem;
    color: #6b7280;
    display: flex;
    justify-content: space-between;
  }

  .editor {
    padding: 1rem;
    font-size: 0.875rem;
    line-height: 1.6;
    background: white;
  }

  /* ========== Markdown Code Blocks ========== */
  .editor :global(code) {
    background: #f3f4f6;
    padding: 0.2em 0.4em;
    border-radius: 3px;
    font-family: "Consolas", "Monaco", "Courier New", monospace;
    font-size: 0.9em;
    color: #1f2937;
  }

  .editor :global(pre) {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    padding: 1rem;
    overflow-x: auto;
    margin: 0.5rem 0;
  }

  .editor :global(pre code) {
    background: transparent;
    padding: 0;
    border-radius: 0;
    font-size: 0.875rem;
    line-height: 1.5;
    display: block;
  }

  /* ========== Markdown Headers ========== */
  .editor :global(h1) {
    font-size: 2em;
    font-weight: 700;
    margin: 0.67em 0;
    line-height: 1.2;
    color: #111827;
    border-bottom: 2px solid #e5e7eb;
    padding-bottom: 0.3em;
  }

  .editor :global(h2) {
    font-size: 1.5em;
    font-weight: 600;
    margin: 0.75em 0 0.5em;
    line-height: 1.3;
    color: #111827;
    border-bottom: 1px solid #e5e7eb;
    padding-bottom: 0.3em;
  }

  .editor :global(h3) {
    font-size: 1.25em;
    font-weight: 600;
    margin: 0.5em 0;
    line-height: 1.4;
    color: #1f2937;
  }

  .editor :global(h4) {
    font-size: 1.1em;
    font-weight: 600;
    margin: 0.5em 0;
    line-height: 1.4;
    color: #374151;
  }

  .editor :global(h5) {
    font-size: 1em;
    font-weight: 600;
    margin: 0.5em 0;
    line-height: 1.5;
    color: #4b5563;
  }

  .editor :global(h6) {
    font-size: 0.9em;
    font-weight: 600;
    margin: 0.5em 0;
    line-height: 1.5;
    color: #6b7280;
  }

  /* ========== Markdown Lists ========== */
  .editor :global(ul),
  .editor :global(ol) {
    margin: 0.5em 0;
    padding-left: 2em;
  }

  .editor :global(ul) {
    list-style-type: disc;
  }

  .editor :global(ul ul) {
    list-style-type: circle;
  }

  .editor :global(ul ul ul) {
    list-style-type: square;
  }

  .editor :global(ol) {
    list-style-type: decimal;
  }

  .editor :global(li) {
    margin: 0.25em 0;
    line-height: 1.6;
  }

  .editor :global(li::marker) {
    color: #6b7280;
  }

  .editor :global(li > p) {
    margin: 0.25em 0;
  }

  /* ========== Markdown Blockquotes ========== */
  .editor :global(blockquote) {
    margin: 1em 0;
    padding: 0.5em 1em;
    border-left: 4px solid #d1d5db;
    background: #f9fafb;
    color: #4b5563;
    font-style: italic;
  }

  .editor :global(blockquote > p) {
    margin: 0.5em 0;
  }

  /* ========== Markdown Links ========== */
  .editor :global(a) {
    color: #2563eb;
    text-decoration: none;
    border-bottom: 1px solid transparent;
    transition: border-color 0.2s;
  }

  .editor :global(a:hover) {
    border-bottom-color: #2563eb;
  }

  /* ========== Markdown Tables ========== */
  .editor :global(table) {
    border-collapse: collapse;
    width: 100%;
    margin: 1em 0;
    font-size: 0.875rem;
  }

  .editor :global(th),
  .editor :global(td) {
    border: 1px solid #e5e7eb;
    padding: 0.5em 0.75em;
    text-align: left;
  }

  .editor :global(th) {
    background: #f9fafb;
    font-weight: 600;
    color: #374151;
  }

  .editor :global(tr:nth-child(even)) {
    background: #f9fafb;
  }

  /* ========== Markdown Horizontal Rule ========== */
  .editor :global(hr) {
    border: none;
    border-top: 2px solid #e5e7eb;
    margin: 1.5em 0;
  }

  /* ========== Markdown Paragraphs ========== */
  .editor :global(p) {
    margin: 0.75em 0;
    line-height: 1.6;
  }

  /* ========== Markdown Text Formatting ========== */
  .editor :global(strong) {
    font-weight: 600;
    color: #111827;
  }

  .editor :global(em) {
    font-style: italic;
  }

  .editor :global(del) {
    text-decoration: line-through;
    color: #6b7280;
  }

  /* ========== Markdown Images ========== */
  .editor :global(img) {
    max-width: 100%;
    height: auto;
    border-radius: 6px;
    margin: 0.5em 0;
  }
</style>
