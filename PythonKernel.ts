/// <reference types="vite/client" />

import KernelWorker from "./starboard-python/worker/kernel-worker?worker";
import { AsyncMemory } from "./starboard-python/worker/async-memory";
import { ObjectProxyHost } from "./starboard-python/worker/object-proxy";
import type { Kernel } from "./starboard-python//worker/kernel-worker";
import type { NotebookFilesystemSync } from "./starboard-python/worker/emscripten-fs";
import { nanoid } from "nanoid";
import { render } from "katex";
import type { RunCodeResult } from "./starboard-python/worker/pyodide-instance";
import { flatPromise } from "./starboard-python/flat-promise";

const handleMessages = ({
  worker,
  objectProxyHost,
  asyncMemory,
  runningCode,
}: PythonKernel) =>
  worker.addEventListener("message", (ev: MessageEvent) => {
    if (!ev.data) {
      console.warn("Unexpected message from kernel manager", ev);
      return;
    }
    const data = ev.data as Kernel.Response;

    if (
      data.type === "proxy_reflect" ||
      data.type === "proxy_shared_memory" ||
      data.type === "proxy_print_object" ||
      data.type === "proxy_promise"
    ) {
      objectProxyHost.handleProxyMessage(data, asyncMemory);
    } else if (data.type === "result") {
      runningCode.get(data.id)?.(data.value);
      objectProxyHost?.clearTemporary();
    } else if (data.type === "console") console[data.method](...data.data);
    else if (data.type === "error") console.error(data.error);
  });

async function convertResult(data: RunCodeResult) {
  if (data.display === "default") return data.value;
  else if (data.display === "latex") {
    let div = document.createElement("div");
    div.className = "rendered_html cell-output-html";
    const value = data.value;

    render(value.replace(/^(\$?\$?)([^]*)\1$/, "$2"), div, {
      throwOnError: false,
      errorColor: " #cc0000",
      displayMode: true,
    });

    return div;
  } else if (data.display === "html") {
    let div = document.createElement("div");
    div.className = "rendered_html cell-output-html";
    div.appendChild(
      new DOMParser().parseFromString(data.value, "text/html").body
        .firstChild as any,
    );
    return div;
  } else return data.value;
}

const isPyProxy = (jsobj: any) =>
  !!jsobj && jsobj.$$ !== undefined && jsobj.$$.type === "PyProxy";

type AddEntry = (payload: { method: "error" | "result"; data: any }) => void;

// Just putting HTML with script tags on the DOM will not get them evaluated
// Using this hack we execute them anyway
const evalScriptTagsHack = (element: HTMLElement) =>
  element
    .querySelectorAll('script[type|="text/javascript"]')
    .forEach(function (e) {
      if (e.textContent !== null) eval(e.textContent);
    });

const processProxyResult = (result: any, htmlOutput: HTMLElement) => {
  if (result._repr_html_ !== undefined) {
    const representation = result._repr_html_();
    if (typeof representation === "string") {
      let div = document.createElement("div");
      div.className = "rendered_html cell-output-html";
      div.appendChild(
        new DOMParser().parseFromString(representation, "text/html").body
          .firstChild!,
      );
      htmlOutput.appendChild(div);
      evalScriptTagsHack(div);
      return true;
    }
  } else if (result._repr_latex_ !== undefined) {
    let representation = result._repr_latex_();
    if (typeof representation === "string") {
      let div = document.createElement("div");
      div.className = "rendered_html cell-output-html";
      if (representation.startsWith("$$")) {
        representation = representation.substr(2, representation.length - 3);
        render(representation, div, {
          throwOnError: false,
          errorColor: " #cc0000",
          displayMode: true,
        });
      } else if (representation.startsWith("$")) {
        representation = representation.substr(1, representation.length - 2);
        render(representation, div, {
          throwOnError: false,
          errorColor: " #cc0000",
          displayMode: false,
        });
      }
      htmlOutput.appendChild(div);
      return true;
    }
  }
  return false;
};

const processResult = (
  result: any,
  htmlOutput: HTMLElement,
  addEntry: AddEntry,
): { error: any } | undefined => {
  if (result == undefined) return;

  if (result instanceof HTMLElement) {
    htmlOutput.appendChild(result);
    evalScriptTagsHack(result);
  } else if (
    typeof result === "object" &&
    result.name === "PythonError" &&
    result.__error_address
  ) {
    addEntry({ method: "error", data: `${result.toString()}` });
    return { error: result };
  } else if (!isPyProxy(result)) {
    addEntry({ method: "result", data: result });
  } else if (!processProxyResult(result, htmlOutput))
    addEntry({ method: "result", data: result });
};

type Environment = {
  fs: NotebookFilesystemSync & { root: string };
  input: () => string;
};

let i = 0;

export default class PythonKernel {
  readonly worker = new KernelWorker();
  readonly asyncMemory = new AsyncMemory();
  readonly objectProxyHost = new ObjectProxyHost(this.asyncMemory);
  readonly runningCode = new Map<string, (value: RunCodeResult) => void>();

  runChain = Promise.resolve();

  readonly loaded: Promise<void>;

  currentHtmlOutputElement: HTMLElement | null = null;

  constructor({ fs, input }: Environment) {
    handleMessages(this);
    const { worker, objectProxyHost } = this;
    const drawCanvas = this.drawCanvas.bind(this);

    const payload: Kernel.Request = {
      type: "initialize",
      root: fs.root,
      asyncMemory: {
        lockBuffer: this.asyncMemory.sharedLock,
        dataBuffer: this.asyncMemory.sharedMemory,
        interruptBuffer: this.asyncMemory.interruptBuffer,
      },
      ids: {
        getInput: objectProxyHost.registerRootObject(input),
        filesystem: objectProxyHost.registerRootObject(fs),
        globalThis: objectProxyHost.registerRootObject(globalThis),
        drawCanvas: objectProxyHost.registerRootObject(drawCanvas),
      },
    };

    this.loaded = new Promise((resolve) => {
      const onInitialized = (ev: MessageEvent) => {
        if (!ev.data) return;
        const data = ev.data as Kernel.Response;
        if (data.type === "initialized") {
          worker.removeEventListener("message", onInitialized);
          resolve();
        }
      };
      worker.addEventListener("message", onInitialized);
      worker.postMessage(payload);
    });
  }

  drawCanvas(pixels: number[], width: number, height: number) {
    const elem = document.createElement("div");
    if (!this.currentHtmlOutputElement) {
      console.log(
        "HTML output from pyodide but nowhere to put it, will append to body instead.",
      );
      document.body.appendChild(elem);
    } else {
      this.currentHtmlOutputElement.appendChild(elem);
    }
    const image = new ImageData(new Uint8ClampedArray(pixels), width, height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      console.warn("Failed to acquire canvas context");
      return;
    }
    ctx.putImageData(image, 0, 0);
    this.currentHtmlOutputElement?.appendChild(canvas);
  }

  interrupt() {
    this.asyncMemory.interrupt();
  }

  clearInterrupt() {
    this.asyncMemory.clearInterrupt();
  }

  runFile(
    code: string,
    path: string,
    renderOutputTarget: HTMLElement,
    addEntry: AddEntry,
  ) {
    const { runningCode, worker, loaded, runChain } = this;

    const done = flatPromise();

    const alreadyRunning = runChain.catch((_) => 0);
    this.runChain = done.promise;

    const index = i++;
    done.promise.then(() => {
      console.log("Finished running code", index);
    });

    let executing = false;
    let doExecute = true;

    const interrupt = () => {
      if (executing) {
        this.interrupt();
        done.reject("Execution interrupted");
      } else doExecute = false;
    };

    const result = new Promise<any>(async (resolve) => {
      await loaded;
      await alreadyRunning;

      if (!doExecute) return resolve(undefined);

      executing = true;

      this.clearInterrupt();

      const htmlOutput = document.createElement("div");

      renderOutputTarget.appendChild(htmlOutput);

      this.currentHtmlOutputElement = htmlOutput;

      const id = nanoid();

      let result: any = undefined;
      let error: any = undefined;

      try {
        result = await new Promise<any>((resolve, reject) => {
          runningCode.set(id, (result) => {
            convertResult(result).then(resolve);
            runningCode.delete(id);
          });

          try {
            const msg = { type: "run", id, code, file: path } as const;
            worker.postMessage(msg satisfies Kernel.Request);
          } catch (e) {
            console.warn(e, code);
            reject(e);
            runningCode.delete(id);
          }
        });

        const processed = processResult(result, htmlOutput, addEntry);
        if (processed?.error !== undefined) error = processed.error;
      } catch (e: any) {
        error = e;
        addEntry({
          method: "error",
          data: `${e.name} ${e.message}`,
        });
      }

      done.resolve();
      if (error !== undefined) throw error;

      resolve(result);
    });

    return { interrupt, result };
  }
}
