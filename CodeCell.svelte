<script lang="ts" module>
  export class Model extends Editor.Model {}
</script>

<script lang="ts">
  import type { default as PythonKernel, Run } from "./PythonKernel";
  import { Editor } from "../python-monaco-suede";
  import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
  import {
    enableMonacoAutoHeight,
    installNotebookCellKeybindings,
  } from "./monaco";
  import type { CellEvents } from "./Notebook.svelte";

  let {
    kernel,
    model,
    getRunID,
    selected,
    reveal,
  }: {
    kernel: PythonKernel;
    model: Model;
    getRunID: () => number;
    selected: boolean;
    reveal: () => void;
  } = $props();

  let runID = $state<number>();
  let status = $state<"initial" | "queued" | "running" | "completed">(
    "initial",
  );

  type OutputStatus = "ok" | "error";

  let outputs = $state<{ values: any[]; status: OutputStatus }[]>();

  let outputElement = $state<HTMLElement>();
  let container = $state<HTMLElement>();

  let editor = $state<monaco.editor.IStandaloneCodeEditor>();

  const preRun = () => {
    runID = getRunID();
    outputElement?.childNodes.forEach((child) => child.remove());
    outputs = undefined;
    status = "queued";
  };

  const output = (status: OutputStatus, value: any) => {
    if (outputs && outputs.length > 0) {
      const last = outputs[outputs.length - 1];
      if (last.status === status) return last.values.push(value);
    }

    (outputs ??= []).push({ status, values: [value] });
  };

  const focus = (target: "start" | "end" = "start") => {
    reveal();
    editor?.focus();
    if (target === "end") {
      const model = editor?.getModel();
      if (model) {
        const lineCount = model.getLineCount();
        const lastLineLength = model.getLineMaxColumn(lineCount);
        editor?.setPosition({ lineNumber: lineCount, column: lastLineLength });
      }
    }
  };

  const select = () => {
    if (selected) return;
    (model as any as { events: CellEvents }).events.fire("request select");
  };

  const on = {
    start: () => (status = "running"),
    complete: () => (status = "completed"),
    output: {
      html: (element: HTMLElement) => outputElement!.appendChild(element),
      raw: (data: any) => output("ok", data),
    },
    error: (msg: string) => {
      output("error", msg);
      focus();
    },
    console: (level: "log" | "warn" | "error", msg: string) =>
      level === "log" ? on.output.raw(msg) : on.error(msg),
  } as const;

  let task: Run.Job | undefined = undefined;

  const run = () => {
    preRun();
    const { content: code, path } = model;
    task = kernel.run({ code, path });
    task.on("start", on.start);
    task.on("complete", on.complete);
    task.on("output", "html", on.output.html);
    task.on("output", "raw", on.output.raw);
    task.on("error", on.error);
    task.on("console", on.console);
  };

  const interrupt = () => {
    task?.interrupt();
    status = "completed";
  };

  const inflight = $derived(status === "queued" || status === "running");

  $effect(() => {
    if (selected) focus();
  });

  const focusNext = () =>
    (model as any as { events: CellEvents }).events.fire(
      "request select next",
      "code",
    );

  const focusPrevious = () =>
    (model as any as { events: CellEvents }).events.fire(
      "request select previous",
      "code",
    );

  const runAndFocusNext = () => (run(), focusNext());

  const controls = { run, runAndFocusNext, focusNext, focusPrevious };

  const onEditor = (
    _editor: monaco.editor.IStandaloneCodeEditor,
  ): monaco.IDisposable => {
    editor = _editor;

    const disposables = [
      editor.onDidFocusEditorText(select),
      installNotebookCellKeybindings(editor, controls),
    ];

    if (container)
      disposables.push(enableMonacoAutoHeight({ editor, container }));

    const dispose = () => disposables.forEach(({ dispose }) => dispose());
    return { dispose };
  };
</script>

<div class="cell" class:selected>
  <div class="cell-row">
    <div class="cell-gutter">
      <div class="exec">In [{runID ?? ""}]</div>
      <div
        style:display="flex"
        style:flex-direction="column"
        style:justify-content="center"
        style:align-items="center"
      >
        <div style="position: relative">
          <span
            class="loader {status}"
            style:position="absolute"
            style:top="-2px"
            style:left="-18px"
          ></span>
        </div>

        <button
          class="run-btn"
          aria-label="run"
          onclick={inflight ? interrupt : run}
        >
        </button>
        {#if inflight}<em>{status}</em>{/if}
      </div>
    </div>
    <div
      class="cell-body"
      role="button"
      tabindex={1}
      onkeypress={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        if (editor?.hasTextFocus()) return;
        event.preventDefault();
        select();
      }}
      onclick={({ y, currentTarget }) => {
        const rect = currentTarget.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        focus(y < midpoint ? "start" : "end");
      }}
    >
      <div class="cell-toolbar">Code</div>
      <div class="editor" bind:this={container}>
        <Editor.Component file={model} {onEditor} />
      </div>
      <div class="output">
        {#each outputs as { status, values }}
          <div class="output-box {status}">
            {#each values as value}
              <div style:white-space="pre-line">
                {value}
              </div>
            {/each}
          </div>
        {/each}
      </div>
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
    width: 68px;
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
  }

  .cell-toolbar {
    padding: 0.5rem 1rem;
    border-bottom: 1px solid #e5e7eb;
    font-size: 0.75rem;
    color: #6b7280;
    display: flex;
    justify-content: space-between;
  }

  .editor {
    font-size: 0.875rem;
    line-height: 1.6;
    background: white;
  }

  /* ========== Outputs ========== */
  .output {
    border-top: 1px solid #e5e7eb;
    padding: 1rem;
  }

  .output-box {
    border-left: 4px solid #e5e7eb;
    padding: 0.75rem;
    border-radius: 8px;
    background: #ffffff;
  }

  .output-box.ok {
    border-left-color: #a7f3d0;
  }

  .output-box.error {
    border-left-color: #fecaca;
    color: #991b1b;
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
</style>
