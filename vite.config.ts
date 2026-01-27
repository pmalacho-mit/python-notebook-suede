import tailwindcss from "@tailwindcss/vite";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import { applyConfig } from "./python-monaco-suede/config/vite";

export default applyConfig(
  defineConfig({
    server: {
      host: "0.0.0.0",
      headers: {
        "Cross-Origin-Embedder-Policy": "require-corp",
        "Cross-Origin-Opener-Policy": "same-origin",
      },
      fs: {
        allow: ["./release", "./python-monaco-suede", "./with-events-suede"],
      },
    },
    plugins: [tailwindcss(), sveltekit()],
    worker: {
      format: "es",
    },
  }),
  {
    base: `"./"`,
  },
);
