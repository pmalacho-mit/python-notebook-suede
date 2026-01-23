import { AsyncMemory } from "./async-memory";
import type { NotebookFilesystemSync } from "./emscripten-fs";
import {
  ObjectId,
  ObjectProxyClient,
  type ProxyMessages,
} from "./object-proxy";
import { PyodideKernel } from "./pyodide-kernel";
import type { Typed } from "./utils";

type KernelManagerMessages = {
  initialize: {
    asyncMemory: {
      lockBuffer: SharedArrayBuffer;
      dataBuffer: SharedArrayBuffer;
    };
    filesystemId: string;
    getInputId: string;
  };
  import_kernel: {
    kernelId: string;
    workspacePath: string;
    className: string;
    options: any;
  };
  run: {
    kernelId: string;
    id: string;
    code: string;
  };
  custom: {
    kernelId: string;
    message: any;
  };
};

type KernelManagerResponses = {
  kernel_initialized: {
    kernelId: string;
  };
  result: {
    kernelId: string;
    id: string;
    value: any;
  };
  console: {
    kernelId: string;
    method: "log" | "warn" | "error";
    data: string[];
  };
  error: {
    kernelId: string;
    id: string;
    error: string;
  };
  custom: {
    kernelId: string;
    message: any;
  };
} & ProxyMessages;

export type KernelManagerMessage = Typed<KernelManagerMessages>;
export type KernelManagerResponse = Typed<KernelManagerResponses>;

type MessageHandler = {
  [k in keyof KernelManagerMessages as `on${Capitalize<k>}`]: (
    manager: KernelManager,
    data: KernelManagerMessages[k],
  ) => any;
};

const handler = {
  onInitialize: (manager, data) => {
    const asyncMemory = new AsyncMemory(
      data.asyncMemory.lockBuffer,
      data.asyncMemory.dataBuffer,
    );
    const proxy = new ObjectProxyClient(asyncMemory, (msg) =>
      manager.postMessage(msg),
    );
    const input = proxy.getObjectProxy<() => string>(data.getInputId);
    const asyncFs = proxy.getObjectProxy(data.filesystemId);
    const syncFs: NotebookFilesystemSync = {
      get: (opts) => proxy.thenSync(asyncFs.get(opts)),
      put: (opts) => proxy.thenSync(asyncFs.put(opts)),
      delete: (opts) => proxy.thenSync(asyncFs.delete(opts)),
      move: (opts) => proxy.thenSync(asyncFs.move(opts)),
      listDirectory: (opts) => proxy.thenSync(asyncFs.listDirectory(opts)),
    };

    manager.proxy = proxy;
    manager.input = input;
    manager.syncFs = syncFs;
  },
  onImport_kernel: (manager, { options, kernelId, workspacePath }) => {
    try {
      options.id ??= kernelId;
      const kernel = new PyodideKernel(options);
      manager.kernels.set(kernel.kernelId, kernel);
      kernelId = kernel.kernelId;
      kernel
        .init(manager, workspacePath)
        .then(() =>
          manager.postMessage({ type: "kernel_initialized", kernelId }),
        );
    } catch (e) {
      manager.postMessage({ type: "error", kernelId, id: "", error: e + "" });
    }
  },
  onRun: async (manager, { kernelId, id, code }) => {
    try {
      const kernel = manager.kernels.get(kernelId);
      if (!kernel) throw new Error("Failed to find kernel with id " + kernelId);
      const value = await kernel.runCode(code);
      kernelId = kernel.kernelId;
      manager.postMessage({ type: "result", id, value, kernelId });
    } catch (e) {
      manager.postMessage({ type: "error", id, kernelId, error: e + "" });
    }
  },
  onCustom: (manager, { kernelId, message }) => {
    const kernel = manager.kernels.get(kernelId);
    kernel?.customMessage(message) ??
      console.warn("Custom message was sent to an nonexistent kernel", {
        kernelId,
        message,
      });
  },
} satisfies MessageHandler;

const handle = (manager: KernelManager, msg: KernelManagerMessage) => {
  const { type } = msg;
  const methodName =
    `on${type.charAt(0).toUpperCase()}${type.slice(1)}` as keyof MessageHandler;
  if (!(methodName in handler))
    throw new Error(`No handler for message type ${type}`);
  handler[methodName](manager, msg as any);
};

/**
 * Manages all the kernels in this worker.
 */
export class KernelManager {
  readonly kernels = new Map<string, PyodideKernel>();

  /** Properties set by the initialize message */
  proxy!: ObjectProxyClient;
  input!: () => string;
  syncFs!: NotebookFilesystemSync;

  constructor() {
    const _handle = handle.bind(null, this);
    self.addEventListener("message", async (e: MessageEvent) => {
      if (!e.data) {
        console.warn("Kernel worker received unexpected message:", e);
        return;
      }
      _handle(e.data);
    });
  }

  postMessage(message: KernelManagerResponse) {
    (self.postMessage as any)(message);
  }

  log(kernel: PyodideKernel, ...args: string[]) {
    this.postMessage({
      kernelId: kernel.kernelId,
      type: "console",
      method: "log",
      data: args,
    });
  }

  logWarning(kernel: PyodideKernel, ...args: string[]) {
    this.postMessage({
      kernelId: kernel.kernelId,
      type: "console",
      method: "warn",
      data: args,
    });
  }

  logError(kernel: PyodideKernel, ...args: string[]) {
    this.postMessage({
      kernelId: kernel.kernelId,
      type: "console",
      method: "error",
      data: args,
    });
  }

  [ObjectId] = "";
}

const singleton = new KernelManager();
export default singleton;
