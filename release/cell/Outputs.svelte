<script lang="ts" module>
  import type { IOutput } from "@jupyterlab/nbformat";
  import {
    Output,
    snippets,
  } from "../../python-notebook-suede.python-web-kernel-suede";

  const wentWrong = (output: IOutput) =>
    Output.is(output, "error") ||
    (Output.is(output, "stream") && output.name === "stderr");

  export type Props = { outputs: readonly IOutput[] };
</script>

<script lang="ts">
  let { outputs }: Props = $props();
</script>

{#if outputs.length > 0}
  <div class="outputs" data-testid="outputs">
    {#each outputs as output, index (index)}
      <div class="output" class:failed={wentWrong(output)}>
        {@render snippets.output.any(output)}
      </div>
    {/each}
  </div>
{/if}

<style>
  .outputs {
    border-top: 1px solid #e5e7eb;
    padding: 0.75rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .output {
    border-left: 4px solid #a7f3d0;
    border-radius: 8px;
    padding: 0.5rem 0.75rem;
    overflow-x: auto;
    font-family: ui-monospace, "Consolas", "Monaco", monospace;
    font-size: 0.8125rem;
  }

  .output.failed {
    border-left-color: #fecaca;
    color: #991b1b;
  }

  .output :global(pre) {
    margin: 0;
    white-space: pre-wrap;
  }

  .output :global(img) {
    max-width: 100%;
  }
</style>
