import type { Kernel } from "./kernel-worker";
import { EMFS } from "./emscripten-fs";
import { patchMatplotlib } from "../pyodide/matplotlib";
import { loadPyodide, version, type PyodideAPI } from "pyodide";

export type RunCodeResult = {
  display?: "default" | "html" | "latex";
  value: any; // TODO: Normal objects can be normal objects, python proxies might need a bit of comlink
};

export class PyodideInstance {
  readonly globalThisId: string;
  readonly drawCanvasId: string;
  readonly interruptBuffer: Uint8Array<ArrayBufferLike>;

  proxiedGlobalThis: undefined | any;
  proxiedDrawCanvas: (pixels: number[], width: number, height: number) => void =
    () => {};
  pyodide: PyodideAPI | undefined = undefined;

  constructor(options: {
    globalThisId: string;
    drawCanvasId: string;
    interruptBuffer: Uint8Array<ArrayBufferLike>;
  }) {
    this.globalThisId = options.globalThisId;
    this.drawCanvasId = options.drawCanvasId;
    this.interruptBuffer = options.interruptBuffer;
  }

  async init(manager: Kernel, root: string): Promise<any> {
    this.proxiedGlobalThis = this.proxyGlobalThis(manager, this.globalThisId);

    this.proxiedDrawCanvas = manager.proxy.getObjectProxy(this.drawCanvasId);
    (globalThis as any).drawPyodideCanvas = (
      pixels: number[],
      width: number,
      height: number,
    ) => {
      if ((pixels as any).toJs) pixels = (pixels as any).toJs();
      if (pixels instanceof Uint8ClampedArray || pixels instanceof Uint8Array)
        pixels = Array.from(pixels);
      this.proxiedDrawCanvas.apply({}, [pixels, width, height]);
    };

    const indexURL = `https://cdn.jsdelivr.net/pyodide/v${version}/full/`;

    this.pyodide = await loadPyodide({
      indexURL,
      fullStdLib: false,
    });

    this.pyodide.setInterruptBuffer(this.interruptBuffer);

    const stdinFunc = this.createStdin(manager);
    this.pyodide.setStdin({
      stdin: stdinFunc,
    });

    this.pyodide.setStdout({
      // raw(charCode) {
      //   if (charCode === 10) {
      //     console.log("OUT: [newline]");
      //   } else {
      //     console.log("OUT RAW:", String.fromCharCode(charCode));
      //   }
      // },
      batched: (output: string) => {
        console.log("OUT:", output);
      },
    });

    this.pyodide.setStderr({
      batched: (output: string) => {
        console.error("ERR:", output);
      },
    });

    this.pyodide.FS.mkdirTree(root);
    this.pyodide.FS.mount(new EMFS(this.pyodide, manager.syncFs), {}, root);
    this.pyodide.registerJsModule("js", this.proxiedGlobalThis);
  }

  async runCode(
    code: string,
    filename: string,
  ): Promise<RunCodeResult | undefined> {
    if (!this.pyodide) {
      console.warn("Worker has not yet been initialized");
      return;
    }

    // We prevent some spam, otherwise every time you run a cell with an import it will show
    // "Loading bla", "Bla was already loaded from default channel", "Loaded bla"
    let wasAlreadyLoaded: boolean | undefined = undefined;
    let msgBuffer: string[] = [];

    await this.pyodide.loadPackagesFromImports(code, {
      messageCallback: (msg) => {
        if (wasAlreadyLoaded === true) return;

        if (msg.match(/Loaded.*\smatplotlib/)) {
          console.debug("Hooking matplotlib output to Starboard");
          patchMatplotlib(this.pyodide!);
        }

        if (wasAlreadyLoaded === false) {
          if (msg.match(/already loaded from default channel$/)) {
            return; // This is not the main package being loaded but another dependency that is
            // already loaded - no need to list it.
          }
          console.debug(msg);
        }

        if (wasAlreadyLoaded === undefined) {
          if (msg.match(/already loaded from default channel$/)) {
            wasAlreadyLoaded = true;
            return;
          }
          if (msg.match(/^Loading [a-z\-, ]*/)) {
            wasAlreadyLoaded = false;
            msgBuffer.forEach((m) => console.debug(m));
            console.debug(msg);
          }
        }
      },
    });

    let result = await this.pyodide
      .runPythonAsync(code, { filename })
      .catch((error) => error);

    let displayType: RunCodeResult["display"];

    if (result instanceof this.pyodide.ffi.PyProxy) {
      if (result._repr_html_ !== undefined) {
        result = result._repr_html_();
        displayType = "html";
      } else if (result._repr_latex_ !== undefined) {
        result = result._repr_latex_();
        displayType = "latex";
      } else {
        result = result.__str__();
        displayType = "default";
      }
    } else if (result instanceof this.pyodide.ffi.PythonError)
      result = result + "";

    this.destroyToJsResult(result);

    return {
      display: displayType,
      value: result,
    };
  }

  io(manager: Kernel) {}

  createStdin(manager: Kernel) {
    const encoder = new TextEncoder();
    let input = new Uint8Array();
    let inputIndex = -1; // -1 means that we just returned null
    function stdin() {
      if (inputIndex === -1) {
        const text = manager.input();
        input = encoder.encode(text + (text.endsWith("\n") ? "" : "\n"));
        inputIndex = 0;
      }

      if (inputIndex < input.length) {
        let character = input[inputIndex];
        inputIndex++;
        return character;
      } else {
        inputIndex = -1;
        return null;
      }
    }
    return stdin;
  }

  private proxyGlobalThis(manager: Kernel, id?: string) {
    // Special cases for the globalThis object. We don't need to proxy everything
    const noProxy = new Set<string | symbol>([
      "location",
      // Proxy navigator, however, some navigator properties do not have to be proxied
      // "navigator",
      "self",
      "importScripts",
      "addEventListener",
      "removeEventListener",
      "caches",
      "crypto",
      "indexedDB",
      "isSecureContext",
      "origin",
      "performance",
      "atob",
      "btoa",
      "clearInterval",
      "clearTimeout",
      "createImageBitmap",
      "fetch",
      "queueMicrotask",
      "setInterval",
      "setTimeout",

      // Special cases for the pyodide globalThis
      "$$",
      "pyodide",
      "__name__",
      "__package__",
      "__path__",
      "__loader__",

      // Pyodide likes checking for lots of properties, like the .stack property to check if something is an error
      // https://github.com/pyodide/pyodide/blob/c8436c33a7fbee13e1ded97c0bbdaa7d635f2745/src/core/jsproxy.c#L1631
      "stack",
      "get",
      "set",
      "has",
      "size",
      "length",
      "then",
      "includes",
      "next",
      Symbol.iterator,

      // Draw something to a canvas
      "drawPyodideCanvas",
    ]);
    return manager.proxy && id
      ? manager.proxy.wrapExcluderProxy(
          manager.proxy.getObjectProxy(id),
          globalThis,
          noProxy,
        )
      : globalThis;
  }

  private destroyToJsResult(x: any) {
    if (!this.pyodide || !x) return;
    if (x instanceof this.pyodide.ffi.PyProxy) x.destroy();
  }
}
