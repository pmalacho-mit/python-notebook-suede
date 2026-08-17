<script lang="ts" module>
  import { Sweater } from "../../sweater-vest-suede";
  import { Notebook, kernelFor } from "../../release";
  import {
    KERNEL_TIMEOUT_MS,
    frames,
    outputText,
    until,
    write,
  } from "./support";

  /** One interpreter for the file: booting Python is the slow part. */
  const kernel = kernelFor();

  class Pocket {
    notebook: Notebook.Model;

    constructor(sources: string[]) {
      this.notebook = Notebook.Model.memory({}, { kernel });
      write(this.notebook, sources);
    }
  }

  const rendered = (within: HTMLElement, count: number) =>
    until(`${count} cells to render`, () => frames(within).length === count);

  const settled = (notebook: Notebook.Model) =>
    until(
      "every cell to finish running",
      () => notebook.code.every((cell) => !cell.busy),
      KERNEL_TIMEOUT_MS,
    );
</script>

<Sweater config category="Execution" orientation="vertical" mode="serial" />

<Sweater
  name="running a cell shows what Python printed and numbers the execution"
  body={async (harness) => {
    const { notebook } = harness.set(new Pocket(["print('hello from python')"]));
    await rendered(harness.container, 1);

    const [cell] = notebook.code;
    await notebook.run(cell).result;

    await until(
      "the output to appear",
      () => outputText(frames(harness.container)[0]).includes("hello from python"),
      KERNEL_TIMEOUT_MS,
    );

    harness.expect(cell.executionCount).toBe(1);
    harness.expect(cell.status).toBe("idle");
    harness.capture("png");
  }}
>
  {#snippet vest(pocket: Pocket)}
    <Notebook.Component notebook={pocket.notebook} />
  {/snippet}
</Sweater>

<Sweater
  name="cells share one namespace, so a later cell sees an earlier one's names"
  body={async (harness) => {
    const { notebook } = harness.set(
      new Pocket(["greeting = 'hello'", "print(greeting.upper())"]),
    );
    await rendered(harness.container, 2);

    notebook.runAll();
    await settled(notebook);

    const [, second] = frames(harness.container);
    await until(
      "the second cell's output",
      () => outputText(second).includes("HELLO"),
      KERNEL_TIMEOUT_MS,
    );

    harness.expect(notebook.code.map((cell) => cell.executionCount)).toEqual([1, 2]);
    harness.capture("png");
  }}
>
  {#snippet vest(pocket: Pocket)}
    <Notebook.Component notebook={pocket.notebook} />
  {/snippet}
</Sweater>

<Sweater
  name="a failing cell reports the cell it failed in, not the file it was written to"
  body={async (harness) => {
    const { notebook } = harness.set(
      new Pocket(["x = 1", "raise ValueError('deliberate')"]),
    );
    await rendered(harness.container, 2);

    notebook.runAll();
    await settled(notebook);

    const [, second] = frames(harness.container);
    const failure = await until(
      "the failure to be reported",
      () => outputText(second).includes("deliberate") && outputText(second),
      KERNEL_TIMEOUT_MS,
    );

    harness.expect(failure).toContain("ValueError");
    harness.expect(failure).toContain("Cell [2]");
    harness.expect(failure).not.toContain(".py");
    harness.note(failure);
    harness.capture("png");
  }}
>
  {#snippet vest(pocket: Pocket)}
    <Notebook.Component notebook={pocket.notebook} />
  {/snippet}
</Sweater>

<Sweater
  name="outputs are kept in the notebook, so they survive being serialised"
  body={async (harness) => {
    const { notebook } = harness.set(new Pocket(["1 + 1"]));
    await rendered(harness.container, 1);

    notebook.runAll();
    await settled(notebook);

    const saved = await until(
      "the result to reach the notebook",
      () => notebook.toJSON().cells[0].outputs as unknown[],
      KERNEL_TIMEOUT_MS,
    );

    harness.expect(JSON.stringify(saved)).toContain("2");
    harness.expect(notebook.toJSON().cells[0].execution_count).toBe(1);
  }}
>
  {#snippet vest(pocket: Pocket)}
    <Notebook.Component notebook={pocket.notebook} />
  {/snippet}
</Sweater>
