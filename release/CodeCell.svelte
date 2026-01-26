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
  import { CellEvents } from "./Notebook.svelte";

  let {
    kernel,
    model,
    getRunID,
    selected,
  }: {
    kernel: PythonKernel;
    model: Model;
    getRunID: () => number;
    selected: boolean;
  } = $props();

  let runID = $state<number>();
  let status = $state<"initial" | "queued" | "running" | "completed">(
    "initial",
  );

  let rawOutput = $state<any>();
  let errorOutput = $state<string>();
  let outputElement = $state<HTMLElement>();
  let editorContainer = $state<HTMLElement>();

  const preRun = () => {
    runID = getRunID();
    outputElement?.childNodes.forEach((child) => child.remove());
    rawOutput = undefined;
    errorOutput = undefined;
    status = "queued";
  };

  const on = {
    start: () => {
      status = "running";
    },
    complete: () => {
      status = "completed";
    },
    output: {
      html: (element: HTMLElement) => outputElement!.appendChild(element),
      raw: (data: any) => (rawOutput = data),
    },
    error: (msg: string) => (errorOutput = msg),
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
  };

  const ok = $derived(status === "completed" && errorOutput === undefined);
  const error = $derived(status === "completed" && errorOutput !== undefined);

  $effect(() => {
    if (selected) {
      editorContainer?.querySelector("textarea")?.focus();
    }
  });
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
          onclick={status === "completed" || status === "initial"
            ? run
            : () => {
                task?.interrupt();
                status = "completed";
              }}
        >
        </button>
        {#if status !== "initial" && status !== "completed"}
          <em>{status}</em>
        {/if}
      </div>
    </div>
    <div class="cell-body">
      <div class="cell-toolbar">Code</div>
      <div class="editor" bind:this={editorContainer}>
        <Editor.Component
          file={model}
          onEditor={(editor) => {
            const disposables = new Set<monaco.IDisposable>();
            const capture = (disposable: monaco.IDisposable) =>
              disposables.add(disposable);

            capture(
              enableMonacoAutoHeight({
                editor,
                container: editorContainer!,
              }),
            );

            capture(
              editor.onDidFocusEditorText(() => {
                if (!selected) {
                  (model as any as { events: CellEvents }).events.fire(
                    "request select",
                  );
                }
              }),
            );

            capture(
              installNotebookCellKeybindings({
                editor,
                runCell: () => run(),
                runCellAndFocusNext: () => {
                  run();
                  (model as any as { events: CellEvents }).events.fire(
                    "request select next",
                    "code",
                  );
                },
                focusNextCell: () => {
                  (model as any as { events: CellEvents }).events.fire(
                    "request select next",
                    "code",
                  );
                },
                focusPrevCell: () => {},
              }),
            );

            return {
              dispose: () => disposables.forEach((d) => d.dispose()),
            };
          }}
        />
      </div>
      <div class="output">
        {#if rawOutput !== undefined || errorOutput !== undefined}
          <div class="output-box" class:ok class:error>
            {#if rawOutput !== undefined}
              {rawOutput}
            {/if}
            {#if errorOutput !== undefined}
              {errorOutput}
            {/if}
          </div>
        {/if}
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
