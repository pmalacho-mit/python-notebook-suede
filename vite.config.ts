import tailwindcss from "@tailwindcss/vite";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import { applyConfig as withMonaco } from "./python-notebook-suede.python-monaco-suede/config/vite";
import { applyConfig as withKernel } from "./python-notebook-suede.python-web-kernel-suede/config/vite";

export default withKernel(
  withMonaco(
    defineConfig({
      server: {
        host: "0.0.0.0",
        fs: { allow: ["./release"] },
      },
      plugins: [tailwindcss(), sveltekit()],
    }),
    { base: `"./"` },
  ),
);
