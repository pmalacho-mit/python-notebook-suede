<script lang="ts">
  import { runStarboardPython } from "../../release/starboard-python/run";
  let element = $state<HTMLElement>();

  const runtime = {
    fs: {
      get(opts: { path: string }) {
        console.log("fs.get invoked with:", opts);
        return { ok: true as const, data: null };
      },
      put(opts: { path: string; value: string | null }) {
        console.log("fs.put invoked with:", opts);
        return { ok: true as const, data: undefined };
      },
      delete(opts: { path: string }) {
        console.log("fs.delete invoked with:", opts);
        return { ok: true as const, data: undefined };
      },
      move(opts: { path: string; newPath: string }) {
        console.log("fs.move invoked with:", opts);
        return { ok: true as const, data: undefined };
      },
      listDirectory(opts: { path: string }) {
        console.log("fs.listDirectory invoked with:", opts);
        return { ok: true as const, data: [] };
      },
      stat: (opts: { path: string }) =>
        console.log("fs.stat invoked with:", opts),
    },
  };

  $effect(() => {
    if (!element) return;

    runStarboardPython(runtime, `import regex`, element, (entry) => {
      console.log("Python output entry:", entry);
    });

    new Promise((resolve) => setTimeout(resolve, 1000)).then(async () => {
      const x = await runStarboardPython(
        runtime,
        `import os
import pandas
pandas_path = os.path.dirname(pandas.__file__)
parsers_file_path = os.path.join(pandas_path, '_libs', 'parsers.pyx')
print(f"The file is located at: {parsers_file_path}")

# Read the content of the file
with open(parsers_file_path, 'r', encoding='utf-8') as file:
    content = file.read()
print("Content of parsers.pyx:")
print(content)
`,
        element!,
        (entry) => {
          console.log("Python output entry:", entry);
        },
      );
      console.log("Result of print(x):", x);
    });
  });
</script>

<div bind:this={element}></div>
