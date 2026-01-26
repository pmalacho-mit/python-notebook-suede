<script lang="ts" module>
  export type CellEntry = {
    type: "code" | "markdown";
    content: string;
  };

  /**
   * Extract markdown + python code cells from an .ipynb file.
   * - Preserves original cell order
   * - Normalizes cell.source (string | string[]) → string
   * - Treats all code cells as python (standard Jupyter assumption)
   */
  export function parseIpynb(ipynb: string | unknown): CellEntry[] {
    const notebook = typeof ipynb === "string" ? JSON.parse(ipynb) : ipynb;

    if (
      !notebook ||
      typeof notebook !== "object" ||
      !Array.isArray((notebook as any).cells)
    ) {
      throw new Error("Invalid ipynb: missing cells array");
    }

    const entries: CellEntry[] = [];

    for (const cell of (notebook as any).cells) {
      if (!cell || typeof cell !== "object") continue;

      const { cell_type, source } = cell as any;

      if (cell_type !== "markdown" && cell_type !== "code") continue;

      const content =
        typeof source === "string"
          ? source
          : Array.isArray(source)
            ? source.join("")
            : "";

      if (!content.trim()) continue;

      entries.push({
        type: cell_type === "markdown" ? "markdown" : "code",
        content,
      });
    }

    return entries;
  }
</script>

<script lang="ts">
  import { resolve } from "$app/paths";
  import Notebook, { Model } from "../../release/Notebook.svelte";
  let selection = $state<"part1" | "part2" | "homework1">();
</script>

<div>
  <select bind:value={selection}>
    <option value="part1">Intro Part 1</option>
    <option value="part2">Intro Part 2</option>
    <option value="homework1">Homework 1</option>
  </select>
</div>

<div style="background: #f3f4f6; padding: 1rem; margin-top: 1rem;">
  {#if selection}
    {#await fetch(resolve(`/${selection}.ipynb` as any)) then response}
      {#await response.text() then ipynbText}
        <Notebook
          model={new Model({
            cells: parseIpynb(ipynbText),
            realpath: `${selection}.ipynb`,
          })}
        />
      {:catch error}
        <p style="color: red;">
          Error reading notebook content: {error.message}
        </p>
      {/await}
    {:catch error}
      <p style="color: red;">Error loading notebook: {error.message}</p>
    {/await}
  {/if}
</div>
