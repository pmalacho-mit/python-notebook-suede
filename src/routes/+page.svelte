<script lang="ts">
  import { Notebook, kernelFor } from "../../release";
  import { load, samples, type Sample } from "$lib/samples";

  const kernel = kernelFor();

  let choice = $state<Sample>("part1");

  const opened = $derived(
    load(choice).then((content) =>
      Notebook.Model.memory(content, {
        kernel,
        parent: { path: "notebooks" },
        name: `${choice}.ipynb`,
      }),
    ),
  );
</script>

<div class="page">
  <header>
    <label for="sample">Notebook</label>
    <select id="sample" bind:value={choice}>
      {#each Object.entries(samples) as [value, label] (value)}
        <option {value}>{label}</option>
      {/each}
    </select>
  </header>

  <main>
    {#await opened}
      <p>Loading…</p>
    {:then notebook}
      {#key notebook}
        <Notebook.Component {notebook} />
      {/key}
    {:catch error}
      <p class="error">{error.message}</p>
    {/await}
  </main>
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }

  header {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    padding: 0.5rem 1rem;
    border-bottom: 1px solid #e5e7eb;
  }

  main {
    flex: 1;
    min-height: 0;
  }

  .error {
    color: #991b1b;
    padding: 1rem;
  }
</style>
