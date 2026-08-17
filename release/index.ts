import NotebookComponent from "./Notebook.svelte";
import { Notebook as NotebookModel } from "./model/notebook.svelte";
import { MemoryNotebook } from "./model/memory";
import { SharedNotebook } from "./model/shared";

export { Cell, CodeCell, executable } from "./model/cell.svelte";
export type { Status } from "./model/cell.svelte";
export type {
  CellStore,
  CellType,
  CodeCellStore,
  NewCell,
  NotebookStore,
  ProseCellStore,
} from "./model/store";
export type { NotebookOptions } from "./model/notebook.svelte";
export { NotebookFiles, kernelFor } from "./execution/files";

/** Where a notebook's cells can live. */
export const stores = {
  memory: MemoryNotebook.from,
  shared: (notebook: ConstructorParameters<typeof SharedNotebook>[0]) =>
    new SharedNotebook(notebook),
};

export const Notebook = {
  Model: NotebookModel,
  Component: NotebookComponent,
};

export namespace Notebook {
  export type Model = NotebookModel;
  export type Component = NotebookComponent;
}

export {
  Kernel,
  Output,
} from "../python-notebook-suede.python-web-kernel-suede";
export {
  DiagnosticFilter,
  Editor,
} from "../python-notebook-suede.python-monaco-suede";
