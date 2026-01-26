<script lang="ts" module>
</script>

<script lang="ts">
  import { marked } from "marked";

  let { content }: { content: string } = $props();
</script>

<div class="cell">
  <div class="cell-row">
    <div class="cell-body">
      <div class="cell-toolbar">Markdown</div>
      <div class="editor">
        {@html marked(content)}
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
</style>
