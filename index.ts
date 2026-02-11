import {
  default as NotebookComponent,
  Model as NotebookModel,
} from "./Notebook.svelte";

export { default as PythonKernel, type Environment } from "./PythonKernel";

export const Notebook = {
  Model: NotebookModel,
  Component: NotebookComponent,
};

export namespace Notebook {
  export type Model = NotebookModel;
  export type Component = NotebookComponent;
}
