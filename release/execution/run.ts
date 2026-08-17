import type { IOutput } from "@jupyterlab/nbformat";
import type { Kernel } from "../../python-notebook-suede.python-web-kernel-suede";
import { Output } from "../../python-notebook-suede.python-web-kernel-suede";
import type { CodeCell } from "../model/cell.svelte";
import { relabelled } from "./traceback";

const wentWrong = (output: IOutput) =>
  Output.is(output, "error") ||
  (Output.is(output, "stream") && output.name === "stderr");

/**
 * Runs one cell, writing what it produces into the cell as it arrives rather
 * than when it finishes, and bringing a cell that failed into view.
 */
export const execute = (
  kernel: Kernel,
  cell: CodeCell,
  nextExecutionCount: () => number,
) => {
  const labels = cell.notebook.labels();

  const receive = (output: IOutput) => {
    cell.received(relabelled(output, labels));
    if (wentWrong(output)) cell.notebook.select(cell);
  };

  return cell.queue(() =>
    kernel.run({
      code: cell.source,
      // Where the editor keeps a cell is its own business — one directory per
      // notebook, so two open at once cannot collide. The interpreter runs it
      // in the working directory it already has.
      path: cell.file.name,
      on: {
        start: () => cell.started(),
        output: receive,
        complete: () => cell.completed(nextExecutionCount()),
      },
    }),
  );
};
