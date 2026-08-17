# python-notebook-suede

A Jupyter-like notebook for the browser: cells edited in Monaco with real
Python intellisense, run by a Pyodide kernel, and — if you want it —
collaboratively edited over Yjs.

It is the display and execution half of two smaller dependencies, which do the
parts that are not about notebooks:

- [python-monaco-suede](https://github.com/pmalacho-mit/python-monaco-suede) —
  Python in a Monaco editor, with basedpyright in a worker, and the machinery
  for analysing a list of files as one shared namespace.
- [python-web-kernel-suede](https://github.com/pmalacho-mit/python-web-kernel-suede)
  — Pyodide in a worker, with a filesystem you supply on the main thread.

```svelte
<script lang="ts">
  import { Kernel, Notebook } from "<path>/python-notebook-suede";

  const notebook = Notebook.Model.memory(ipynb, {
    kernel: new Kernel(Kernel.Environment()),
  });
</script>

<Notebook.Component {notebook} />
```

---

## Where the cells live

A notebook reads and writes its cells through a **store**, and knows nothing
else about them. Two are supplied.

`Notebook.Model.memory(content?)` holds them in a plain object, built from
anything shaped like an `.ipynb` — deserialised JSON, a fixture, nothing at all:

```ts
const notebook = Notebook.Model.memory(await (await fetch("lesson.ipynb")).json());
notebook.add("code").write("print('hi')");
notebook.toJSON(); // back to nbformat
```

`Notebook.Model.shared(ynotebook)` holds them in a
[`@jupyter/ydoc`](https://www.npmjs.com/package/@jupyter/ydoc) `YNotebook`, so
that two people editing at once converge rather than overwrite:

```ts
import { YNotebook } from "@jupyter/ydoc";
import { WebsocketProvider } from "y-websocket";

const shared = new YNotebook();
new WebsocketProvider(url, room, shared.ydoc);

const notebook = Notebook.Model.shared(shared, { kernel });
```

The notebook owns its Yjs document, so build the provider around
`shared.ydoc` rather than handing a document in.

Everything above the store is the same either way. The one visible difference
is `cell.store.sourceSync`: a shared cell has a `Y.Text`, which is what lets
the editor bind to it instead of copying it, and an unshared one does not.

Anything else that can answer the same questions is a store too — implement
`NotebookStore` and hand it to `new Notebook.Model({ store })`.

## Where the notebook is

A notebook has a `parent` directory and a `name`, and its `path` follows both.
The name is state, because a file can be renamed while it is open:

```ts
const notebook = Notebook.Model.memory(content, {
  parent: workspace, // anything with a `path`, reactive or not
  name: "intro.ipynb",
});

notebook.path; // "lessons/intro.ipynb"
notebook.name = "week-one.ipynb";
notebook.path; // "lessons/week-one.ipynb"
```

Each cell appears to the editor as a file **beside** the notebook, not inside
it — `lessons/intro-cell-<id>.py` — so a `helpers.py` sitting next to
`intro.ipynb` is importable from a cell exactly as it would be from a script
written in that directory, and anything that reports a path says which notebook
it belongs to. Cell paths follow a rename, which costs the open editors their
undo history: an editor rebuilds a document whose path changed.

Given no `parent`, a notebook takes a directory of its own, so that two open at
once cannot collide.

## Running the cells

A notebook without a `kernel` displays and edits; asking it to run throws.

```ts
notebook.run(cell); // one cell
notebook.runAll();
notebook.runBefore(cell);
notebook.runAfter(cell);
notebook.interrupt();
```

Cells share one interpreter and one namespace, in the order they appear. What
Python produces is written into the cell as it arrives, so a slow cell shows
its output before it finishes, and it is written into the **store** — so a
shared notebook's outputs reach every collaborator, and `toJSON()` carries
them.

A traceback names the cell it came from (`Cell [3]`) rather than the file the
cell was written to, which is an artefact of running it.

Cells run under their file name in the interpreter's own working directory,
which is the root of the filesystem the kernel was given. So the editor
resolving `import helpers` beside the notebook and Python resolving it at
runtime agree only when that filesystem is mounted at the notebook's
directory — the editor is not in a position to arrange that for you.

## Intellisense across cells

Each cell is its own Monaco document, but the language server sees it prefixed
with every earlier cell — so a name bound in cell 1 is defined in cell 2, and
go-to-definition on it lands in cell 1. `Notebook.Component` registers the
chain and keeps it in step; there is nothing to wire up.

Only code cells take part.

## The model

| Member                      | Description                                     |
| --------------------------- | ----------------------------------------------- |
| `cells`                     | Every cell, in order.                           |
| `code`                      | Only the runnable ones.                         |
| `add(type, at?)`            | Insert a cell; returns it.                      |
| `remove(cell)`              | Delete it.                                      |
| `move(cell, to)`            | Reorder.                                        |
| `select(cell)` / `selected` | Which cell has the ring, and the keyboard.      |
| `neighbour(cell, step, type?)` | The next cell in a direction.                |
| `toJSON()`                  | nbformat, outputs and execution counts included. |
| `dispose()`                 | Stop following the store.                       |

A cell carries `source`, `type`, `id` and `index`; a code cell adds `outputs`,
`executionCount`, `status` and `interrupt()`.

## Keyboard

| Key                | Action                        |
| ------------------ | ----------------------------- |
| `Shift+Enter`      | Run, then select the next code cell |
| `Ctrl`/`Cmd+Enter` | Run                           |
| `↑` at the top     | Select the previous cell      |
| `↓` at the bottom  | Select the next cell          |
