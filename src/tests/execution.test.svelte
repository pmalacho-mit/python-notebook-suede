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
  name="a cell busy in Python stops when asked"
  body={async (harness) => {
    const { notebook } = harness.set(
      new Pocket(["total = 0\nfor _ in range(10**9):\n    total += 1"]),
    );
    await rendered(harness.container, 1);

    const [cell] = notebook.code;
    const started = Date.now();
    const job = notebook.run(cell);

    await until(
      "the cell to be running",
      () => cell.status === "running",
      KERNEL_TIMEOUT_MS,
    );
    cell.interrupt();
    await job.result;

    const elapsed = Date.now() - started;
    harness.note(`Stopped after ${elapsed}ms; a billion iterations would not.`);
    harness.expect(elapsed).toBeLessThan(20_000);
    harness.expect(outputText(frames(harness.container)[0])).toContain(
      "KeyboardInterrupt",
    );
  }}
>
  {#snippet vest(pocket: Pocket)}
    <Notebook.Component notebook={pocket.notebook} />
  {/snippet}
</Sweater>

<Sweater
  name="a cell asleep in Python does not, and holds up the cells behind it"
  body={async (harness) => {
    const { notebook } = harness.set(
      new Pocket(["import time\ntime.sleep(3)", "print('after')"]),
    );
    await rendered(harness.container, 2);

    const [sleeping, next] = notebook.code;
    const started = Date.now();
    const asleep = notebook.run(sleeping);
    const behind = notebook.run(next);

    await until(
      "the cell to be running",
      () => sleeping.status === "running",
      KERNEL_TIMEOUT_MS,
    );
    sleeping.interrupt();

    // Asked, not done: the cell says so rather than claiming to have stopped.
    harness.expect(sleeping.status).toBe("interrupting");
    harness.expect(sleeping.busy).toBe(true);

    await asleep.result;
    harness.expect(sleeping.status).toBe("idle");

    const elapsed = Date.now() - started;
    harness.note(`Asked to stop at once; slept on for ${elapsed}ms.`);
    harness.expect(elapsed).toBeGreaterThan(2_000);

    // One interpreter, one namespace, one cell at a time: what was queued
    // behind the sleep could not start until the sleep gave up the thread.
    await behind.result;
    harness.expect(outputText(frames(harness.container)[1])).toContain("after");
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
