/// <reference types="node" />

import importMetaUrlPlugin from "@codingame/esbuild-import-meta-url-plugin";
import { viteStaticCopy } from "vite-plugin-static-copy";
import { findNearestNodeModules } from "./utils";
import { suederoot } from "./dirname";
import { resolve } from "node:path";
import { existsSync } from "node:fs";

const SERVER_WORKER = "browser-basedpyright/dist/pyright.worker.js";

/** The grammar engine and the regex engine it runs on, both UMD. */
const UMD_BUNDLES = /vscode-(textmate|oniguruma)[\\/]release[\\/]main\.js$/;

/**
 * The grammar engine and its regex engine ship UMD bundles, which look for
 * CommonJS first and fall back to hanging themselves off the file's top-level
 * `this`. Served straight to the tokenizer's worker as a module, that `this`
 * is `undefined` and each throws on load — inside a worker, where nothing
 * surfaces it, so documents render and simply never colour.
 *
 * Pre-bundling hands them the CommonJS they want; a worker's import does not,
 * so this does. Their consumer reads `module.default ?? module`, which is why
 * one default export is enough.
 *
 * @return {import('vite').Plugin}
 */
const umdAsCommonJs = () => ({
  name: "python-monaco-suede:umd-global",
  enforce: /** @type {const} */ ("pre"),
  /**
   * @param {string} code
   * @param {string} id
   */
  transform(code, id) {
    if (!UMD_BUNDLES.test(id.split("?")[0])) return;
    const asCommonJs = [
      "const module = { exports: {} };",
      "const exports = module.exports;",
      code,
      "export default module.exports;",
    ].join("\n");
    return { code: asCommonJs, map: null };
  },
});

/**
 * @typedef {object} ApplyOptions
 * @property {string} [base] Base URL to embed into PYTHON_MONACO_BASE
 */

/**
 *
 * @param {import('vite').UserConfig} current
 * @param {ApplyOptions} [options]
 * @return {import('vite').UserConfig}
 */
export const applyConfig = (current, options = {}) => {
  current.server ??= {};
  current.server.host ??= "0.0.0.0";
  current.server.fs ??= {};
  current.server.fs.allow ??= [];
  current.server.fs.allow.push(suederoot);
  current.worker ??= {};
  // Monaco's workers are loaded as modules, which rollup cannot code-split as iife.
  current.worker.format ??= "es";
  current.define ??= {};
  current.define["PYTHON_MONACO_BASE"] = options?.base ?? current.base ?? `"/"`;
  current.plugins ??= [];

  const node_modules = findNearestNodeModules(suederoot);
  if (!node_modules) throw new Error("Could not find node_modules directory");

  const server = resolve(node_modules, SERVER_WORKER);

  if (!existsSync(server))
    throw new Error(`Could not find ${SERVER_WORKER}`);

  current.plugins.push(
    umdAsCommonJs(),
    viteStaticCopy({ targets: [{ src: server, dest: "./" }] }),
  );
  current.optimizeDeps ??= {};
  current.optimizeDeps.esbuildOptions ??= {};
  current.optimizeDeps.esbuildOptions.plugins ??= [];
  current.optimizeDeps.esbuildOptions.plugins.push({
    name: "import.meta.url for @codingame only (causes svelte issues otherwise)",
    setup(args) {
      importMetaUrlPlugin.setup({
        ...args,
        onLoad: (options, callback) => {
          args.onLoad(
            {
              ...options,
              filter: /.*(@codingame|monaco-).*\.js$/,
            },
            callback,
          );
        },
      });
    },
  });
  return current;
};
