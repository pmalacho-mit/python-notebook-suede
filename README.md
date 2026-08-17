# Python-notebook-suede

A Jupyter-like notebook for the browser — Monaco editors with Python
intellisense, a Pyodide kernel, and optional collaborative editing over Yjs.

This repo is a [suede dependency](https://github.com/pmalacho-mit/suede). The
shipped source lives in [`release/`](./release), and
[`release/README.md`](./release/README.md) is its documentation. Everything
else here is the app that develops and tests it.

To see the installable source code, please checkout the [release branch](https://github.com/pmalacho-mit/python-notebook-suede/tree/release).

## Installation

```bash
bash <(curl https://suede.sh/install-release) --repo pmalacho-mit/python-notebook-suede
```

<details>
<summary>
See alternative to using <a href="https://github.com/pmalacho-mit/suede#suedesh">suede.sh</a> script proxy
</summary>

```bash
bash <(curl https://raw.githubusercontent.com/pmalacho-mit/suede/refs/heads/main/scripts/install-release.sh) --repo pmalacho-mit/python-notebook-suede
```

</details>

## Developing

```bash
npm install
npm run dev
```

- `/` — a sample notebook, backed by plain JSON.
- `/collab` — the same notebook in two frames, backed by a shared document.
- `/tests` — the test suite, running live.

`/collab` and the collaboration tests need the sync server:

```bash
npm run sync-server   # a y-websocket server on :1234, in Docker
```

## Testing

Tests are [sweater-vest-suede](https://github.com/pmalacho-mit/sweater-vest-suede)
`.test.svelte` files under [`src/tests/`](./src/tests). They run in a real
browser against the real dependencies: a real Pyodide kernel, a real language
server, a real sync server.

Browse them at `/tests` while developing, or drive them all through a
containerised browser and get a Markdown report:

```bash
npm run dev &
npm run sync-server &
npm run report        # → fashion-show.md
```

The report forwards `5173` and `1234` onto the browser's own `localhost`,
because `SharedArrayBuffer` — and so the kernel — exists only on a page served
from a trustworthy origin.
