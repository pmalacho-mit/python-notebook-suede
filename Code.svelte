<script lang="ts" module>
  import type { Text } from "yjs";
  import { Output } from "../python-web-kernel-suede";

  class File implements Editor.Model {
    index = $state<number>(0);
    notebook = $state<Notebook>();
    sourceSync = $state<Text>();

    removeSuffixExtension(line: string) {
      const { path } = this;
      return line.replace(path, path.replace(".py", ""));
    }

    private suffix(content: string) {
      return `${content}(${this.index}).py`;
    }

    get name() {
      return this.suffix(this.notebook?.name ?? "");
    }

    get path() {
      return this.suffix(this.notebook?.path ?? "");
    }

    get readonly() {
      return this.notebook?.file.readonly ?? false;
    }

    get source() {
      return this.sourceSync?.toString() ?? "";
    }

    set name(_) {}
    set path(_) {}
    set source(_) {}
    set readonly(_) {}
  }

  // Just putting HTML with script tags on the DOM will not get them evaluated
  // Using this hack we execute them anyway
  const evalScriptTagsHack = (element: Element) =>
    element
      .querySelectorAll('script[type|="text/javascript"]')
      .forEach(function (e) {
        if (e.textContent !== null) eval(e.textContent);
      });

  type Status = "initial" | "queued" | "running" | "completed";

  const trap = (event: Event) => event.stopPropagation();

  const trySanitizeError = (output: Output.Specific, file: File) => {
    if (!Output.is(output, "error")) return output;
    const { traceback } = output;
    for (let i = 0; i < traceback.length; i++)
      traceback[i] = file.removeSuffixExtension(traceback[i]);
    return output;
  };

  export type Props = {
    cell: YCodeCell;
    proxy: CellProxy;
    notebook: Notebook;
    getRunID: () => number;
    selected: boolean;
    reveal: () => void;
    index: number;
    runAbove: () => void;
    runBelow: () => void;
  };
</script>

<script lang="ts">
  import { YCodeCell, type CellChange } from "../python-yjs-suede";
  import { type Run, snippets } from "../python-web-kernel-suede";
  import { Editor } from "../python-monaco-suede";
  import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
  import {
    enableMonacoAutoHeight,
    installNotebookCellKeybindings,
  } from "./monaco";
  import type { CellProxy, Notebook } from "./models.svelte";

  let {
    cell,
    proxy,
    notebook,
    getRunID,
    selected,
    reveal,
    index,
    runAbove,
    runBelow,
  }: Props = $props();

  let runID = $state<number>();
  let status = $state<Status>("initial");

  let outputs = $state.raw<Output.Any[]>();

  const increment = () => {
    runID = getRunID();
    cell.execution_count = runID;
    return runID;
  };

  const file = new File();

  $effect(() => {
    file.index = index;
  });

  $effect(() => {
    file.notebook = notebook;
  });

  $effect(() => {
    file.sourceSync = cell.ysource;
  });

  const onChange = (cell: YCodeCell, { outputsChange }: CellChange) => {
    if (outputsChange && outputsChange.length > 0) {
      outputs = cell.outputs;
      for (const output of outputs) {
        if (Output.is(output, "error")) return select();
        if (Output.is(output, "stream") && output.name === "stderr")
          return select();
      }
    }
  };

  $effect(() => {
    const { changed } = cell;
    changed.connect(onChange);
    return () => changed.disconnect(onChange);
  });

  let editor = $state<monaco.editor.IStandaloneCodeEditor>();
  let editorContainer = $state<HTMLElement>();

  const preRun = () => {
    runID = undefined;
    outputs = undefined;
    cell.clearOutputs();
    status = "queued";
  };

  const focusHack = () => {
    editor?.focus();
    editor?.trigger("keyboard", "type", { text: "" });
    let diposable = editor?.onDidFocusEditorWidget(() => {
      editor?.focus();
      diposable?.dispose();
    });
  };

  const focus = (target?: "start" | "end") => {
    focusHack();
    reveal();

    switch (target) {
      case "start":
        editor?.setPosition({ lineNumber: 1, column: 1 });
        break;
      case "end":
        const model = editor?.getModel();
        if (model) {
          const lineCount = model.getLineCount();
          const lastLineLength = model.getLineMaxColumn(lineCount);
          editor?.setPosition({
            lineNumber: lineCount,
            column: lastLineLength,
          });
        }
    }
  };

  const select = () => {
    if (!selected) proxy.fire("request select");
  };

  const on = {
    start: () => (status = "running"),
    complete: (outputs: Output.Specific[]) => {
      status = "completed";
      proxy.fire("cell executed", outputs, increment());
    },
    output: (entry: Output.Specific) => {
      const { length } = cell.outputs;
      trySanitizeError(entry, file);
      cell.updateOutputs(length, length, [entry]);
    },
  } as const;

  let task: Run.Job | undefined = undefined;

  const run = () => {
    preRun();
    const { source: code } = cell;
    const { path } = file;
    task = notebook.kernel.run({ code, on, path });
  };

  const interrupt = () => {
    task?.interrupt();
    status = "completed";
  };

  const inflight = $derived(status === "queued" || status === "running");

  $effect(() => {
    if (selected) focus();
  });

  const focusNext = () => proxy.fire("request select next", "code");
  const focusPrevious = () => proxy.fire("request select previous", "code");
  const runAndFocusNext = () => (run(), focusNext());
  const controls = { run, runAndFocusNext, focusNext, focusPrevious };

  const onEditor = (
    _editor: monaco.editor.IStandaloneCodeEditor,
  ): monaco.IDisposable => {
    editor = _editor;

    const disposables = [
      editor.onDidFocusEditorText(select),
      editor.onKeyDown((event) => {
        proxy.fire("keydown", event.browserEvent);
      }),
      installNotebookCellKeybindings(editor, controls),
    ];

    if (editorContainer)
      disposables.push(
        enableMonacoAutoHeight({ editor, container: editorContainer }),
      );

    const dispose = () => disposables.forEach(({ dispose }) => dispose());
    return { dispose };
  };

  const onclick = $derived(inflight ? interrupt : run);

  const tryFocus = (end: "start" | "end") => (selected ? select() : focus(end));

  const tryFocusOnKey = (event: KeyboardEvent, end: "start" | "end") => {
    if (event.key === "Enter" || event.key === " ")
      selected ? select() : tryFocus(end);
  };

  $effect(() =>
    proxy.subscribe({
      run: () => run(),
    }),
  );
</script>

<div class="cell" class:selected>
  <div class="cell-row">
    <div class="cell-gutter">
      <div class="exec">In [{runID ?? ""}]</div>
      <div class="run-container">
        <div class="loader-container">
          <span class="loader {status}"></span>
        </div>
        <button class="run-btn" aria-label="run" {onclick}></button>
        {#if inflight}<em>{status}</em>{/if}
      </div>
    </div>
    <div class="cell-body" role="button" tabindex={1}>
      <div class="cell-toolbar">
        <button
          class="toolbar-label"
          onkeypress={(event) => tryFocusOnKey(event, "start")}
          onclick={() => tryFocus("start")}
        >
          Code
        </button>
        <div class="run-all-btns">
          <button
            class="run-all-btn"
            aria-label="run all above"
            onclick={runAbove}
            title="Run all above">↑</button
          >
          <button
            class="run-all-btn"
            aria-label="run all below"
            onclick={runBelow}
            title="Run all below">↓</button
          >
        </div>
      </div>
      <div
        bind:this={editorContainer}
        class="editor"
        role="button"
        tabindex={1}
      >
        <Editor.Component {file} {onEditor} />
      </div>
      <button
        class="output"
        onkeypress={(event) => tryFocusOnKey(event, "start")}
        onclick={() => tryFocus("end")}
      >
        {#each outputs as output}
          {@const error =
            output.output_type === "error" ||
            (output.output_type === "stream" && output.name === "stderr")}
          {@const ok = !error}
          <div class="output-box" class:error class:ok>
            {@render snippets.output.any(output)}
          </div>
        {/each}
      </button>
    </div>
  </div>
</div>

<style>
  /* ========== Cells ========== */
  .cell {
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    overflow: hidden;
    background: white;
  }

  .cell.selected {
    position: relative;
  }

  .cell.selected::before {
    content: "";
    position: absolute;
    left: 0;
    top: 12px;
    bottom: 12px;
    width: 4px;
    background: #3b82f6;
    border-radius: 999px;
  }

  .cell-row {
    display: flex;
    flex-direction: row;
  }

  .cell-gutter {
    width: 72px;
    background: #f9fafb;
    border-right: 1px solid #e5e7eb;
    padding: 0.75rem 0.5rem;
    text-align: center;
    font-size: 0.75rem;
    color: #6b7280;
  }

  .exec {
    display: inline-block;
    padding: 0.15rem 0.4rem;
    border-radius: 6px;
    background: #f3f4f6;
    border: 1px solid #e5e7eb;
    color: #374151;
    margin-bottom: 0.5rem;
  }

  .run-container {
    display: "flex";
    position: relative;
    flex-direction: "column";
    justify-content: "center";
    align-items: "center";
    width: 100%;
  }

  .run-btn {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 1px solid #d1d5db;
    background: white;
    position: relative;
  }

  /** need to make play a stop button on run */
  .run-btn::after {
    content: "";
    position: absolute;
    top: 9px;
    left: 12px;
    border-top: 7px solid transparent;
    border-bottom: 7px solid transparent;
    border-left: 11px solid #374151;
  }

  .cell-body {
    flex: 1;
    width: 100%;
  }

  .cell-toolbar {
    width: 100%;
    padding: 0.5rem 1rem;
    border-bottom: 1px solid #e5e7eb;
    font-size: 0.75rem;
    color: #6b7280;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .toolbar-label {
    background: none;
    border: none;
    padding: 0;
    font-size: 0.75rem;
    color: #6b7280;
    cursor: pointer;
  }

  .editor {
    font-size: 0.875rem;
    line-height: 1.6;
    background: white;
  }

  /* ========== Outputs ========== */
  .output {
    text-align: left;
    display: block;
    width: 100%;
    border-top: 1px solid #e5e7eb;
    padding: 1rem;
  }

  .output-box {
    border-left: 4px solid #e5e7eb;
    padding: 0.75rem;
    border-radius: 8px;
    background: #ffffff;
    overflow-x: scroll;
  }

  .output-box.ok {
    border-left-color: #a7f3d0;
  }

  .output-box.error {
    border-left-color: #fecaca;
    color: #991b1b;
  }

  .loader-container {
    position: absolute;
    top: 0;
    width: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .loader {
    width: 36px;
    height: 36px;
    border: none;
    border-bottom-color: transparent;
    border-radius: 50%;
    display: inline-block;
    box-sizing: border-box;
    animation: rotation 1s linear infinite;
  }

  .loader.queued {
    border: 5px solid grey;
    border-bottom-color: transparent;
  }

  .loader.running {
    border: 5px solid blue;
    border-bottom-color: transparent;
  }

  @keyframes rotation {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  @keyframes rotate {
    100% {
      transform: rotate(360deg);
    }
  }

  @keyframes prixClipFix {
    0% {
      clip-path: polygon(50% 50%, 0 0, 0 0, 0 0, 0 0, 0 0);
    }
    25% {
      clip-path: polygon(50% 50%, 0 0, 100% 0, 100% 0, 100% 0, 100% 0);
    }
    50% {
      clip-path: polygon(50% 50%, 0 0, 100% 0, 100% 100%, 100% 100%, 100% 100%);
    }
    75% {
      clip-path: polygon(50% 50%, 0 0, 100% 0, 100% 100%, 0 100%, 0 100%);
    }
    100% {
      clip-path: polygon(50% 50%, 0 0, 100% 0, 100% 100%, 0 100%, 0 0);
    }
  }

  .run-all-btns {
    display: flex;
    gap: 6px;
  }

  .run-all-btn {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: 1px solid #d1d5db;
    background: #f9fafb;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: #374151;
    transition: all 0.15s ease;
  }

  .run-all-btn:hover {
    background: #e5e7eb;
    border-color: #9ca3af;
  }

  .run-all-btn:active {
    background: #d1d5db;
  }
</style>
