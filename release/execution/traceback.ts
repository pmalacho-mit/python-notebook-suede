import type { IOutput } from "@jupyterlab/nbformat";
import { Output } from "../../python-notebook-suede.python-web-kernel-suede";
import type { Cell } from "../model/cell.svelte";

export type Label = { file: string; as: string };

export const labelsFor = (cells: Cell[]): Label[] =>
  cells.map((cell, index) => ({
    file: cell.file.name,
    as: `Cell [${index + 1}]`,
  }));

const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Where a cell was written to disk is an artefact of running it; the reader
 * only ever knew it as a cell.
 */
const quotedPathTo = ({ file }: Label) =>
  new RegExp(`"[^"\\n]*${escaped(file)}"`, "g");

const named = (line: string, labels: Label[]) =>
  labels.reduce(
    (renamed, label) => renamed.replace(quotedPathTo(label), `"${label.as}"`),
    line,
  );

export const relabelled = (output: IOutput, labels: Label[]): IOutput =>
  Output.is(output, "error")
    ? { ...output, traceback: output.traceback.map((line) => named(line, labels)) }
    : output;
