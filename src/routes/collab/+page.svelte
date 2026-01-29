<script lang="ts">
  import { resolve } from "$app/paths";
  import Notebook, { Model } from "../../../release/Notebook.svelte";
  import { harness } from "../../suede/testyjs-suede";

  const { is, indexedSrc } = harness.iframe();
  const { ydoc } = harness.doc({ guid: "collab-notebook" });

  let frames = $state<HTMLIFrameElement[]>(
    Array.from({ length: 1 }, () => null!),
  );
</script>

{#if is}
  {#await fetch(resolve(`./part1.ipynb` as any)) then response}
    {#await response.json() then ipynbText}
      <Notebook
        model={Model.FromSerialized(
          {
            ydoc,
            file: { name: "example.ipynb", path: "example.ipynb" },
          },
          ipynbText,
        )}
      />
    {/await}
  {/await}
{:else}
  <div style:display="flex" style:flex-direction="row" style:height="100vh">
    {#each frames as _, index}
      {@const src = indexedSrc(index)}
      <iframe
        {src}
        bind:this={frames[index]}
        title="frame {index}"
        style:border="1px solid black"
        style:height="100%"
        style:width="100%"
      ></iframe>
    {/each}
  </div>
{/if}
