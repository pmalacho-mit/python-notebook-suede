import { YNotebook } from "@jupyter/ydoc";
import type { INotebookContent } from "@jupyterlab/nbformat";
import { connect } from "$lib/sync";
import type { Notebook } from "../../release";
import type { CellType } from "../../release";

const sleep = (milliseconds: number) =>
  new Promise((resume) => setTimeout(resume, milliseconds));

const POLL_MS = 50;

/**
 * Waits for something to be produced rather than for a fixed delay, so that a
 * test is neither flaky on a slow machine nor slow on a fast one.
 */
type Produced<T> = T | undefined | null | false;

export const until = async <T>(
  what: string,
  produce: () => Produced<T> | Promise<Produced<T>>,
  timeoutMs = 30_000,
): Promise<T> => {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const produced = await produce();
    if (produced) return produced;
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${what}`);
    await sleep(POLL_MS);
  }
};

/** Long enough for the worker to start and Python to boot; it takes ~5s. */
export const KERNEL_TIMEOUT_MS = 30_000;

/**
 * Long enough for the server to start and analyse a first document. It takes
 * ~2s alone; the margin is for the other test files doing the same at once.
 */
export const LANGUAGE_TIMEOUT_MS = 60_000;

export const frames = (within: HTMLElement) => [
  ...within.querySelectorAll<HTMLElement>('[data-testid="cell"]'),
];

export const kinds = (within: HTMLElement) =>
  frames(within).map((frame) => frame.dataset.cellType);

export const identities = (within: HTMLElement) =>
  frames(within).map((frame) => frame.dataset.cellId);

export const outputText = (frame: HTMLElement) =>
  frame.querySelector<HTMLElement>('[data-testid="outputs"]')?.innerText ?? "";

/**
 * Monaco paints each run of text with a class per theme colour, so a line the
 * grammar has not been applied to is one colour from end to end.
 */
export const coloursIn = (frame: HTMLElement) =>
  new Set(
    // Only the theme-colour class: bracket colourisation puts classes of its
    // own on the same runs, and counting those makes an uncoloured cell look
    // coloured.
    [...frame.querySelectorAll<HTMLElement>('.view-lines [class^="mtk"]')].flatMap(
      (run) => [...run.classList].filter((name) => /^mtk\d+$/.test(name)),
    ),
  );

/**
 * Whether every editor lays its overflowing widgets — a hover, a completion
 * list — out against the viewport. Monaco reads this when it builds a widget,
 * so the option is what there is to observe until one is open.
 */
export const widgetsEscapeTheirEditor = async () => {
  const { editor } = await import("monaco-editor");
  const editors = editor.getEditors();
  return (
    editors.length > 0 &&
    editors.every((one) =>
      one.getOption(editor.EditorOption.fixedOverflowWidgets),
    )
  );
};

/** Monaco renders the spaces in a line as non-breaking ones. */
export const editorText = (frame: HTMLElement) =>
  (frame.querySelector<HTMLElement>(".view-lines")?.textContent ?? "").replaceAll(
    "\u00a0",
    " ",
  );

/**
 * Monaco takes the keyboard through a hidden element beside the painted text
 * — a textarea until VSCode moved to the EditContext API, and a div since.
 */
export const editorInput = (frame: HTMLElement) =>
  frame.querySelector<HTMLElement>("textarea.inputarea, .native-edit-context");

export const deleteButton = (frame: HTMLElement) =>
  frame.querySelector<HTMLElement>('[data-testid="delete-cell"]')!;

/** The buttons that append to the end of the notebook are the last pair. */
export const appendButton = (within: HTMLElement, type: "code" | "markdown") => {
  const all = within.querySelectorAll<HTMLElement>(`[data-testid="add-${type}"]`);
  return all[all.length - 1];
};

export const sourcesOf = ({ cells }: INotebookContent) =>
  cells.map((cell) => cell.source);

export const contentOf = (
  ...cells: [type: CellType, source: string][]
): INotebookContent => ({
  cells: cells.map(([cell_type, source]) => ({
    cell_type,
    source,
    metadata: {},
    ...(cell_type === "code" ? { outputs: [], execution_count: null } : {}),
  })),
  metadata: {},
  nbformat: 4,
  nbformat_minor: 5,
});

export const write = (notebook: Notebook.Model, sources: string[]) =>
  sources.forEach((source, index) => notebook.add("code", index).write(source));

/** A notebook joined to a room on the sync server, as one collaborator sees it. */
export const joined = async (room: string) => {
  const shared = new YNotebook();
  const link = connect(shared, room);
  await link.synced;
  return { shared, ...link };
};

export const newRoom = () => `test-${crypto.randomUUID()}`;
