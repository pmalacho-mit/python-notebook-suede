<script lang="ts" module>
  import { Sweater } from "../../sweater-vest-suede";
  import { Notebook, type CellsChange } from "../../release";
  import {
    appendButton,
    coloursIn,
    contentOf,
    deleteButton,
    editorInput,
    editorText,
    frames,
    identities,
    kinds,
    widgetsEscapeTheirEditor,
    sourcesOf,
    until,
  } from "./support";

  const lesson = () =>
    contentOf(
      ["markdown", "# Lesson"],
      ["code", "total = 1 + 1"],
      ["code", "print(total)"],
    );

  const LESSONS = { path: "lessons" };

  class Pocket {
    notebook = Notebook.Model.memory(lesson(), {
      parent: LESSONS,
      name: "intro.ipynb",
    });
  }

  /** One cell, for a test that needs a working editor rather than a notebook. */
  class OneCell {
    notebook = Notebook.Model.memory(contentOf(["code", "kept = 1"]));
  }

  const rendered = (within: HTMLElement, count: number) =>
    until(`${count} cells to render`, () => frames(within).length === count);
</script>

<!-- One notebook at a time: eleven of them rendering at once is a load the
     harness creates, not one a page does. -->
<Sweater config category="Editing" orientation="vertical" mode="serial" />

<Sweater
  name="shows one frame per cell, with markdown rendered and code in an editor"
  body={async (harness) => {
    const pocket = harness.set(new Pocket());
    const { container } = harness;

    await rendered(container, 3);
    harness.expect(kinds(container)).toEqual(["markdown", "code", "code"]);

    const heading = await until("markdown to render", () =>
      container.querySelector('[data-testid="markdown"] h1'),
    );
    harness.expect(heading.textContent).toBe("Lesson");

    const [, first] = frames(container);
    await until("monaco to show the cell source", () =>
      editorText(first).includes("total = 1 + 1"),
    );

    harness.note(`Cells: ${kinds(container).join(", ")}`);
    harness.capture("png");
    harness.expect(pocket.notebook.cells.length).toBe(3);
  }}
>
  {#snippet vest(pocket: Pocket)}
    <Notebook.Component notebook={pocket.notebook} />
  {/snippet}
</Sweater>

<Sweater
  name="adding a cell appends it to the notebook and to what it serialises to"
  body={async (harness) => {
    const { notebook } = harness.set(new Pocket());
    const { container } = harness;

    await rendered(container, 3);

    await harness.withUserFocus(async (userEvent) => {
      await userEvent.click(appendButton(container, "code"));
      await userEvent.click(appendButton(container, "markdown"));
    });

    await rendered(container, 5);
    harness.expect(kinds(container)).toEqual([
      "markdown",
      "code",
      "code",
      "code",
      "markdown",
    ]);

    notebook.cells[3].write("answer = 42");
    harness.expect(sourcesOf(notebook.toJSON())).toEqual([
      "# Lesson",
      "total = 1 + 1",
      "print(total)",
      "answer = 42",
      "",
    ]);
  }}
>
  {#snippet vest(pocket: Pocket)}
    <Notebook.Component notebook={pocket.notebook} />
  {/snippet}
</Sweater>

<Sweater
  name="deleting a cell removes its frame"
  body={async (harness) => {
    const { notebook } = harness.set(new Pocket());
    const { container } = harness;

    await rendered(container, 3);
    const [, doomed] = identities(container);

    await harness.withUserFocus(async (userEvent) => {
      await userEvent.click(deleteButton(frames(container)[1]));
    });

    await rendered(container, 2);
    harness.expect(identities(container)).not.toContain(doomed);
    harness.expect(sourcesOf(notebook.toJSON())).toEqual([
      "# Lesson",
      "print(total)",
    ]);
  }}
>
  {#snippet vest(pocket: Pocket)}
    <Notebook.Component notebook={pocket.notebook} />
  {/snippet}
</Sweater>

<Sweater
  name="moving a cell reorders the notebook without rebuilding its cells"
  body={async (harness) => {
    const { notebook } = harness.set(new Pocket());
    const { container } = harness;

    await rendered(container, 3);
    const before = identities(container);
    const moved = notebook.cells[2];

    notebook.move(moved, 0);

    await until("the moved cell to lead", () => identities(container)[0] === moved.id);
    harness.expect(identities(container)).toEqual([
      before[2],
      before[0],
      before[1],
    ]);
    harness.expect(sourcesOf(notebook.toJSON())).toEqual([
      "print(total)",
      "# Lesson",
      "total = 1 + 1",
    ]);
  }}
>
  {#snippet vest(pocket: Pocket)}
    <Notebook.Component notebook={pocket.notebook} />
  {/snippet}
</Sweater>

<Sweater
  name="cells are files beside the notebook, named after it, and follow it when renamed"
  body={async (harness) => {
    const { notebook } = harness.set(new Pocket());
    await rendered(harness.container, 3);

    harness.expect(notebook.path).toBe("lessons/intro.ipynb");

    const [, cell] = notebook.cells;
    harness.expect(cell.file.name).toBe(`intro-cell-${cell.id}.py`);

    // A cell sits next to the notebook rather than inside it, so a module in
    // the same directory is importable from a cell exactly as it would be
    // from a script written there.
    harness.expect(cell.file.path).toBe(`lessons/intro-cell-${cell.id}.py`);

    notebook.name = "renamed.ipynb";
    harness.expect(notebook.path).toBe("lessons/renamed.ipynb");
    harness.expect(cell.file.path).toBe(`lessons/renamed-cell-${cell.id}.py`);
  }}
>
  {#snippet vest(pocket: Pocket)}
    <Notebook.Component notebook={pocket.notebook} />
  {/snippet}
</Sweater>

<Sweater
  name="a cell is syntax highlighted before anyone types in it"
  body={async (harness) => {
    harness.set(new Pocket());
    await rendered(harness.container, 3);

    const [, cell] = frames(harness.container);
    await until("monaco to show the cell source", () =>
      editorText(cell).includes("total = 1 + 1"),
    );

    // One colour from end to end is a line the grammar never reached.
    const painted = await until(
      "the grammar to colour the cell",
      () => coloursIn(cell).size > 1 && coloursIn(cell),
    );

    harness.note(`Token colours: ${[...painted].join(", ")}`);
    harness.capture("png");
  }}
>
  {#snippet vest(pocket: Pocket)}
    <Notebook.Component notebook={pocket.notebook} />
  {/snippet}
</Sweater>

<Sweater
  name="widgets taller than their cell are laid out against the page, not the cell"
  body={async (harness) => {
    harness.set(new Pocket());
    await rendered(harness.container, 3);

    // A hover on a two-line cell is taller than the cell, and a cell clips
    // what leaves it — unless the widget is positioned against the viewport.
    await until("every editor to allow its widgets out", widgetsEscapeTheirEditor);
  }}
>
  {#snippet vest(pocket: Pocket)}
    <Notebook.Component notebook={pocket.notebook} />
  {/snippet}
</Sweater>

<Sweater
  name="a deleted cell can be brought back, with the text and outputs it had"
  body={async (harness) => {
    const { notebook } = harness.set(new Pocket());
    const { container } = harness;

    await rendered(container, 3);
    harness.expect(notebook.undoable).toBe(false);

    await harness.withUserFocus(async (userEvent) => {
      await userEvent.click(deleteButton(frames(container)[1]));
    });

    await rendered(container, 2);
    harness.expect(notebook.undoable).toBe(true);

    notebook.undo();

    await rendered(container, 3);
    harness.expect(sourcesOf(notebook.toJSON())).toEqual([
      "# Lesson",
      "total = 1 + 1",
      "print(total)",
    ]);
    harness.expect(notebook.redoable).toBe(true);

    notebook.redo();
    await rendered(container, 2);
  }}
>
  {#snippet vest(pocket: Pocket)}
    <Notebook.Component notebook={pocket.notebook} />
  {/snippet}
</Sweater>

<Sweater
  name="a move can be taken back, and put back again"
  body={async (harness) => {
    const { notebook } = harness.set(new Pocket());
    await rendered(harness.container, 3);

    const original = sourcesOf(notebook.toJSON());
    notebook.move(notebook.cells[2], 0);
    harness.expect(sourcesOf(notebook.toJSON())[0]).toBe("print(total)");

    notebook.undo();
    harness.expect(sourcesOf(notebook.toJSON())).toEqual(original);

    notebook.redo();
    harness.expect(sourcesOf(notebook.toJSON())[0]).toBe("print(total)");
  }}
>
  {#snippet vest(pocket: Pocket)}
    <Notebook.Component notebook={pocket.notebook} />
  {/snippet}
</Sweater>

<Sweater
  name="undo belongs to the editor that has the keyboard, and to the notebook otherwise"
  body={async (harness) => {
    const { notebook } = harness.set(new OneCell());
    const { container } = harness;

    await rendered(container, 1);
    const [cell] = frames(container);
    const input = await until("the editor to be ready", () => editorInput(cell));

    notebook.add("code");
    await rendered(container, 2);

    // While the editor has the keyboard, the key is its own to answer.
    input.focus();
    await until("the editor to take the keyboard", () => notebook.editing);
    await harness.withUserFocus(async (userEvent) => {
      await userEvent.keyboard("z");
    });
    harness.expect(frames(container).length).toBe(2);

    // Out of the editor, the same key takes back the added cell.
    await harness.withUserFocus(async (userEvent) => {
      await userEvent.click(
        cell.querySelector<HTMLElement>('[data-testid="select-cell"]')!,
      );
    });
    await until("the editor to give up the keyboard", () => !notebook.editing);
    await harness.withUserFocus(async (userEvent) => {
      await userEvent.keyboard("z");
    });

    await rendered(container, 1);
  }}
>
  {#snippet vest(pocket: OneCell)}
    <Notebook.Component notebook={pocket.notebook} />
  {/snippet}
</Sweater>

<Sweater
  name="deleting a cell and undoing it is one gesture, with no click in between"
  body={async (harness) => {
    const { container } = harness;
    harness.set(new Pocket());

    await rendered(container, 3);

    // The button that removes the cell goes with it, and the keyboard would
    // go to the document unless the notebook keeps hold of it.
    await harness.withUserFocus(async (userEvent) => {
      await userEvent.click(deleteButton(frames(container)[1]));
      await rendered(container, 2);
      await userEvent.keyboard("{Control>}z{/Control}");
    });

    await rendered(container, 3);
  }}
>
  {#snippet vest(pocket: Pocket)}
    <Notebook.Component notebook={pocket.notebook} />
  {/snippet}
</Sweater>

<Sweater
  name="an undo says which cell it brought back, and a change is reported however it came"
  body={async (harness) => {
    const { notebook } = harness.set(new Pocket());
    const { container } = harness;
    await rendered(container, 3);

    const seen: string[] = [];
    notebook.subscribe({
      "cells changed": ({ added, removed, moved }) =>
        seen.push(
          `+${added.length} -${removed.length} ~${moved.map((m) => `${m.from}>${m.to}`).join("")}`,
        ),
    });

    const doomed = notebook.cells[1];
    notebook.remove(doomed);
    harness.expect(seen).toEqual(["+0 -1 ~"]);

    const taken = await new Promise<CellsChange>((resolve) => {
      notebook.once({ "undo by user": (change) => resolve(change) });
      notebook.undo();
    });

    // What comes back is the cell that went, carrying its text and outputs —
    // the same store, behind a wrapper built for it again.
    harness.expect(taken.added.map((cell) => cell.id)).toEqual([doomed.id]);
    harness.expect(notebook.cells[1].store).toBe(doomed.store);
    harness.expect(notebook.cells[1].source).toBe("total = 1 + 1");

    // A reorder reports as a reorder, and nothing else does.
    notebook.move(notebook.cells[2], 0);
    harness.expect(seen.at(-1)).toBe("+0 -0 ~0>11>22>0");

    harness.note(seen.join(" | "));
  }}
>
  {#snippet vest(pocket: Pocket)}
    <Notebook.Component notebook={pocket.notebook} />
  {/snippet}
</Sweater>

<Sweater
  name="a notebook with no shared document still round-trips through nbformat"
  body={async (harness) => {
    const { notebook } = harness.set(new Pocket());
    await rendered(harness.container, 3);

    const reopened = Notebook.Model.memory(notebook.toJSON());
    harness.expect(sourcesOf(reopened.toJSON())).toEqual(
      sourcesOf(notebook.toJSON()),
    );
    harness.expect(reopened.cells.map((cell) => cell.type)).toEqual([
      "markdown",
      "code",
      "code",
    ]);
    harness.expect(notebook.cells[1].store.sourceSync).toBeUndefined();
  }}
>
  {#snippet vest(pocket: Pocket)}
    <Notebook.Component notebook={pocket.notebook} />
  {/snippet}
</Sweater>
