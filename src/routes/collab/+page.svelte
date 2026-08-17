<script lang="ts" module>
  import { YNotebook } from "@jupyter/ydoc";
  import { Notebook, kernelFor } from "../../../release";
  import { load } from "$lib/samples";
  import { connect } from "$lib/sync";
  import { harness } from "../../suede/testyjs-suede";

  const ROOM = "collab-notebook";
  const PEERS = 2;

  /** One peer seeds the room; the rest take what the server already has. */
  const join = async (index: number) => {
    const shared = new YNotebook();
    const { synced } = connect(shared, ROOM);
    await synced;
    if (index === 0 && shared.cells.length === 0)
      shared.fromJSON(await load("part1"));
    return Notebook.Model.shared(shared, {
      kernel: kernelFor(),
      parent: { path: "notebooks" },
      name: "part1.ipynb",
    });
  };
</script>

<script lang="ts">
  const { is, indexedSrc, index } = harness.iframe();
</script>

{#if is}
  {#await join(index)}
    <p>Connecting…</p>
  {:then notebook}
    <Notebook.Component {notebook} />
  {:catch error}
    <p class="error">{error.message}</p>
  {/await}
{:else}
  <div class="peers">
    {#each Array.from({ length: PEERS }, (_, at) => at) as at (at)}
      <iframe src={indexedSrc(at)} title="peer {at + 1}"></iframe>
    {/each}
  </div>
{/if}

<style>
  .peers {
    display: flex;
    height: 100vh;
  }

  iframe {
    flex: 1;
    height: 100%;
    border: 0;
    border-right: 1px solid #d1d5db;
  }

  .error {
    color: #991b1b;
    padding: 1rem;
  }
</style>
