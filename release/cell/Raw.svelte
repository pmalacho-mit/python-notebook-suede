<script lang="ts" module>
  import type { Cell } from "../model/cell.svelte";

  export type Props = { cell: Cell };
</script>

<script lang="ts">
  let { cell }: Props = $props();
</script>

<pre class="raw" data-testid="raw">{cell.source}</pre>

<style>
  .raw {
    margin: 0;
    padding: 0.75rem 1rem;
    white-space: pre-wrap;
    font-family: ui-monospace, "Consolas", "Monaco", monospace;
    font-size: 0.8125rem;
    color: #4b5563;
  }
</style>
