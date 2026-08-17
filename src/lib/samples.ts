import type { INotebookContent } from "@jupyterlab/nbformat";
import { base } from "$app/paths";

export const samples = {
  part1: "Intro Part 1",
  part2: "Intro Part 2",
  homework1: "Homework 1",
} as const;

export type Sample = keyof typeof samples;

export const load = async (sample: Sample): Promise<INotebookContent> => {
  const response = await fetch(`${base}/${sample}.ipynb`);
  if (!response.ok) throw new Error(`Could not read ${sample}.ipynb`);
  return response.json();
};
