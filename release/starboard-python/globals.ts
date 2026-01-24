/// <reference types="vite/client" />

import { nanoid } from "nanoid";
import { assertUnreachable } from "./util";
import type { Kernel } from "./worker/kernel-worker";
import type {
  PyodideWorkerOptions,
  PyodideWorkerResult,
} from "./worker/worker-message";
import { AsyncMemory } from "./worker/async-memory";
import { ObjectProxyHost } from "./worker/object-proxy";
import type { NotebookFilesystemSync } from "./worker/emscripten-fs";
import { render } from "katex";
import KernelManagerWorker from "./worker/kernel-manager?worker";

export interface Env {
  /**
   * The shared filesystem for the kernel
   */
  fs: NotebookFilesystemSync & {
    /** The location within the pyodide filesystem that the shared filesystem is mounted */
    root: string;
  };
}

let setupStatus: "unstarted" | "started" | "completed" = "unstarted";
let loadingStatus: "unstarted" | "loading" | "ready" = "unstarted";
let pyodideLoadSingleton: Promise<string> | undefined = undefined;
let kernelManager: Worker;
let objectProxyHost: ObjectProxyHost | null = null;
const runningCode = new Map<string, (value: any) => void>();

// A global value that is the current HTML element to attach matplotlib figures to..
// perhaps this can be done in a cleaner way.
let CURRENT_HTML_OUTPUT_ELEMENT: HTMLElement | undefined = undefined;

export function setGlobalPythonOutputElement(el: HTMLElement | undefined) {
  CURRENT_HTML_OUTPUT_ELEMENT = el;
}

function drawCanvas(pixels: number[], width: number, height: number) {
  const elem = document.createElement("div");
  if (!CURRENT_HTML_OUTPUT_ELEMENT) {
    console.log(
      "HTML output from pyodide but nowhere to put it, will append to body instead.",
    );
    document.querySelector("body")!.appendChild(elem);
  } else {
    CURRENT_HTML_OUTPUT_ELEMENT.appendChild(elem);
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
  CURRENT_HTML_OUTPUT_ELEMENT?.appendChild(canvas);
}

async function convertResult(data: PyodideWorkerResult) {
  if (data.display === "default") {
    return data.value;
  } else if (data.display === "latex") {
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
  } else {
    return data.value;
  }
}

function loadKernelManager(runtime?: Env) {
  const worker = new KernelManagerWorker();

  // Since all kernels are running in the same worker, they might as well use the same async memory and object proxy
  const asyncMemory = new AsyncMemory();
  const objectProxyHost = new ObjectProxyHost(asyncMemory);

  const getInputId = objectProxyHost.registerRootObject(() => {
    return prompt();
  });

  // TODO: Remove 'as any' once the starboard typings get updated
  const filesystemId = runtime?.fs
    ? objectProxyHost?.registerRootObject(runtime?.fs)
    : undefined;

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
      if (asyncMemory && objectProxyHost) {
        objectProxyHost.handleProxyMessage(data, asyncMemory);
      }
    }
  });

  worker.postMessage({
    type: "initialize",
    asyncMemory: asyncMemory
      ? {
          lockBuffer: asyncMemory.sharedLock,
          dataBuffer: asyncMemory.sharedMemory,
        }
      : undefined,
    filesystemId: filesystemId,
    getInputId: getInputId,
  } as Kernel.Request);

  return {
    kernelManager: worker,
    objectProxyHost: objectProxyHost,
  };
}

export async function loadPyodide(runtime?: Env) {
  if (pyodideLoadSingleton) return pyodideLoadSingleton;

  const kernelManagerResult = loadKernelManager(runtime);
  kernelManager = kernelManagerResult.kernelManager;
  objectProxyHost = kernelManagerResult.objectProxyHost;

  const globalThisId = objectProxyHost?.registerRootObject(globalThis);
  const drawCanvasId = objectProxyHost?.registerRootObject(drawCanvas);
  // Pyodide worker loading
  loadingStatus = "loading";

  /** Pyodide Kernel id */
  const kernelId = nanoid();

  const initOptions: Kernel.Request = {
    type: "import_kernel",
    className: "PyodideKernel",
    kernelId: kernelId,
    options: {
      globalThisId: globalThisId,
      drawCanvasId: drawCanvasId,
    } as PyodideWorkerOptions,
    root: runtime?.workspacePath ?? "/home/pyodide",
  };

  pyodideLoadSingleton = new Promise((resolve, reject) => {
    // Only the resolve case is handled for now
    function handleInitMessage(ev: MessageEvent<any>) {
      if (!ev.data) return;
      const data = ev.data as Kernel.Response;
      if (data.type === "kernel_initialized" && data.kernelId === kernelId) {
        kernelManager.removeEventListener("message", handleInitMessage);
        resolve(kernelId);
      }
    }
    kernelManager.addEventListener("message", handleInitMessage);
  });

  kernelManager.addEventListener("message", (e) => {
    if (!e.data) return;

    const data = e.data as Kernel.Response;
    switch (data.type) {
      case "result": {
        if (data.kernelId !== kernelId) break;
        const callback = runningCode.get(data.id);
        if (!callback) {
          console.warn("Missing Python callback");
        } else {
          callback(data.value as PyodideWorkerResult);
        }
        objectProxyHost?.clearTemporary();
        break;
      }
      case "console": {
        if (data.kernelId !== kernelId) break;
        (console as any)?.[data.method](...data.data);
        break;
      }
      case "error": {
        if (data.kernelId !== kernelId) break;
        console.error(data.error);
      }
      case "custom": {
        if (data.kernelId !== kernelId) break;
        // No custom messages so far
        break;
      }
      // Ignore
      case "kernel_initialized":
      case "proxy_reflect":
      case "proxy_shared_memory":
      case "proxy_print_object":
      case "proxy_promise": {
        break;
      }
      default: {
        assertUnreachable(data);
      }
    }
  });

  kernelManager.postMessage(initOptions);

  await pyodideLoadSingleton;
  loadingStatus = "ready";

  return pyodideLoadSingleton;
}

export function getPyodideLoadingStatus() {
  return loadingStatus;
}

export async function runPythonAsync(code: string, file: string) {
  if (!pyodideLoadSingleton) return;

  const kernelId = await pyodideLoadSingleton;
  const id = nanoid();
  return new Promise((resolve, reject) => {
    runningCode.set(id, (result) => {
      convertResult(result).then((v) => resolve(v));
      runningCode.delete(id);
    });

    try {
      const msg = { type: "run", kernelId, id, code, file } as const;
      kernelManager.postMessage(msg satisfies Kernel.Request);
    } catch (e) {
      console.warn(e, code);
      reject(e);
      runningCode.delete(id);
    }
  });
}
