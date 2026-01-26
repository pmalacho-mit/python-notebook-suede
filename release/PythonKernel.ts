/// <reference types="vite/client" />

import KernelWorker from "./worker/kernel-worker?worker";
import { AsyncMemory } from "./worker/async-memory";
import { ObjectProxyHost } from "./worker/object-proxy";
import type { Kernel } from "./worker/kernel-worker";
import type { NotebookFilesystemSync } from "./worker/emscripten-fs";
import { nanoid } from "nanoid";
import { render } from "katex";
import type { RunCodeResult } from "./worker/pyodide-instance";
import { flatPromise } from "./utils";

export type Environment = {
  fs: NotebookFilesystemSync & { root: string };
  input: (prompt: string) => string;
};

export namespace Run {
  type Callback<T extends any[] = []> = (...args: T) => any;

  export type OutputKey = "html" | "raw";

  export interface On<Return = void> {
    (
      event: "output",
      type: "html",
      callback: Callback<[element: HTMLElement]>,
    ): Return;
    (event: "output", type: "raw", callback: Callback<[data: any]>): Return;
    (
      event: "console",
      callback: Callback<[type: "log" | "error" | "warn", msg: string]>,
    ): Return;
    (event: "error", callback: Callback<[value: string]>): Return;
    (event: "start", callback: Callback): Return;
    (event: "complete", callback: Callback): Return;
  }

  export interface Fire<Return = void> {
    (event: "output", type: OutputKey, element: HTMLElement): Return;
    (event: "output", type: OutputKey, data: any): Return;
    (event: "console", type: "log" | "error" | "warn", msg: string): Return;
    (event: "error", value: string): Return;
    (event: "start"): Return;
    (event: "complete"): Return;
  }

  export type Job = Expand<{
    interrupt: () => void;
    result: Promise<any>;
    on: On;
  }>;
}

const defaultPath = (env: Environment) => env.fs.root + "/temp.py";

const handleMessages = ({
  worker,
  objectProxyHost,
  asyncMemory,
  runningCode,
  loadingCode,
  consoleCallbacks,
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
    )
      objectProxyHost.handleProxyMessage(data, asyncMemory);
    else if (data.type === "result") {
      runningCode.get(data.id)?.(data.value);
      objectProxyHost?.clearTemporary();
    } else if (data.type === "console") {
      consoleCallbacks.forEach((cb) => cb(data.method, data.data));
      console[data.method](...data.data);
    } else if (data.type === "error") console.error(data.error);
    else if (data.type === "loaded") loadingCode.get(data.id)?.();
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

// Just putting HTML with script tags on the DOM will not get them evaluated
// Using this hack we execute them anyway
const evalScriptTagsHack = (element: Element) =>
  element
    .querySelectorAll('script[type|="text/javascript"]')
    .forEach(function (e) {
      if (e.textContent !== null) eval(e.textContent);
    });

const appendHtmlOutput = (
  htmlOutput: HTMLElement,
  fire: Run.Fire,
  child: HTMLElement,
) => {
  htmlOutput.appendChild(child);
  fire("output", "html", htmlOutput);
  evalScriptTagsHack(htmlOutput);
};

const tryProcessProxyResultAsHTML = (
  result: any,
  htmlOutput: HTMLElement,
  fire: Run.Fire,
) => {
  if (result._repr_html_ !== undefined) {
    const representation = result._repr_html_();
    if (typeof representation === "string") {
      let div = document.createElement("div");
      div.className = "rendered_html cell-output-html";
      div.appendChild(
        new DOMParser().parseFromString(representation, "text/html").body
          .firstChild!,
      );
      appendHtmlOutput(htmlOutput, fire, div);
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
      appendHtmlOutput(htmlOutput, fire, div);
      return true;
    }
  }
  return false;
};

const processResult = (
  result: any,
  htmlOutput: HTMLElement,
  fire: Run.Fire,
) => {
  if (result == undefined) return;
  if (result instanceof HTMLElement) {
    htmlOutput.appendChild(result);
    fire("output", "html", result);
  } else if (
    (typeof result === "object" &&
      result.name === "PythonError" &&
      result.__error_address) ||
    (typeof result === "string" && result.includes("Traceback"))
  )
    fire("error", `${result.toString()}`);
  else if (!isPyProxy(result)) fire("output", "raw", result);
  else if (!tryProcessProxyResultAsHTML(result, htmlOutput, fire))
    fire("output", "raw", result);
};

export default class PythonKernel {
  readonly worker = new KernelWorker();
  readonly asyncMemory = new AsyncMemory();
  readonly objectProxyHost = new ObjectProxyHost(this.asyncMemory);
  readonly runningCode = new Map<string, (value: RunCodeResult) => void>();
  readonly loadingCode = new Map<string, () => void>();
  readonly environment: Environment;

  readonly consoleCallbacks = new Set<
    (type: "log" | "error" | "warn", data: any[]) => void
  >();

  readonly loaded: Promise<void>;

  private runChain = Promise.resolve();
  private currentHtmlOutputElement: HTMLElement | null = null;

  constructor(environment: Environment) {
    this.environment = environment;
    const { fs, input } = environment;

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

  run(code: string): Run.Job;
  run(request: { code: string; path?: string }): Run.Job;
  run(arg: string | { code: string; path?: string }): Run.Job {
    const code = typeof arg === "string" ? arg : arg.code;
    const path =
      typeof arg === "string"
        ? defaultPath(this.environment)
        : (arg.path ?? defaultPath(this.environment));

    const {
      runningCode,
      loadingCode,
      worker,
      loaded: packages,
      runChain,
    } = this;

    const done = flatPromise();

    const alreadyRunning = runChain.catch((_) => 0);
    this.runChain = done.promise;

    let executing = false;
    let doExecute = true;

    const interrupt = () => {
      if (executing) {
        this.interrupt();
        done.resolve();
      } else doExecute = false;
    };

    type Callback = (...args: any[]) => void;
    const callbacks = new Map<string, Callback[]>();
    const set = (event: string, callback: Callback) =>
      callbacks.get(event)?.push(callback) ?? callbacks.set(event, [callback]);
    const exec = (event: string, ...args: any[]) =>
      callbacks.get(event)?.forEach((cb) => cb(...args));

    const on: Run.On<null> = (event, ...args: any[]) => {
      switch (event) {
        case "output":
          const [type, callback] = args as [Run.OutputKey, (arg: any) => void];
          set(type, callback);
          return null;
        case "start":
        case "complete":
        case "error":
        case "console":
          set(event, args[0]);
          return null;
      }
    };

    const fire: Run.Fire<null> = (event, ...args: any[]) => {
      switch (event) {
        case "output":
          const [type, payload] = args as [Run.OutputKey, any];
          exec(type, payload);
          return null;
        case "start":
        case "complete":
        case "error":
        case "console":
          exec(event, ...args);
          return null;
      }
    };

    const onConsole: Parameters<typeof this.consoleCallbacks.add>[0] = (
      type,
      data,
    ) => fire("console", type, data.join(" "));

    const result = new Promise<any>(async (resolve) => {
      await packages;
      await alreadyRunning;

      if (!doExecute) return resolve(undefined);

      this.clearInterrupt();
      fire("start");

      this.consoleCallbacks.add(onConsole);

      const htmlOutput = document.createElement("div");
      this.currentHtmlOutputElement = htmlOutput;

      const id = nanoid();

      let result: any = undefined;

      try {
        const packages = new Promise<boolean>((resolve) =>
          loadingCode.set(id, () => resolve(loadingCode.delete(id))),
        );

        const execution = new Promise<any>((resolve, reject) =>
          runningCode.set(id, (result) => {
            try {
              convertResult(result).then(resolve);
            } catch (e) {
              reject(e);
            } finally {
              runningCode.delete(id);
            }
          }),
        );

        const msg = { type: "run", id, code, file: path } as const;
        worker.postMessage(msg satisfies Kernel.Request);

        await packages;
        if (!doExecute) return resolve(undefined);

        executing = true;
        result = await execution;

        processResult(result, htmlOutput, fire);
      } catch (e: any) {
        fire("error", `${e.name} ${e.message}`);
      }

      resolve(result);
    }).then(() => {
      done.resolve();
      fire("complete");
      result.then((v) => {
        console.log(v);
      });
      this.consoleCallbacks.delete(onConsole);
    });

    return { interrupt, result, on };
  }
}
