<script lang="ts" module>
  import { Sweater } from "../../sweater-vest-suede";
  import { DiagnosticFilter, Editor, Notebook } from "../../release";
  import type { Cell } from "../../release";
  import { LANGUAGE_TIMEOUT_MS, frames, until, write } from "./support";

  class Pocket {
    notebook = Notebook.Model.memory();

    constructor(sources: string[]) {
      write(this.notebook, sources);
    }
  }

  /** Imported once the editors are up: pulling the editor API into this
   *  module would evaluate it before the workspace has started its services. */
  const markers = async () => (await import("monaco-editor")).editor.getModelMarkers({});

  const reportedIn = async (cell: Cell) =>
    (await markers())
      .filter(({ resource }) => resource.path.endsWith(cell.file.name))
      .map(({ message }) => message);

  /**
   * A cell inherits names from a kernel session no checker can see, so
   * undefined names are suppressed by default — and this is the one test that
   * needs to see them.
   */
  const showingUndefinedNames = async <T,>(run: () => Promise<T>) => {
    Editor.unregisterDiagnosticFilter(DiagnosticFilter.undefinedNames);
    try {
      return await run();
    } finally {
      Editor.registerDiagnosticFilter(DiagnosticFilter.undefinedNames);
    }
  };
</script>

<Sweater config category="Language service" orientation="vertical" mode="serial" />

<Sweater
  name="a name bound in one cell is defined in the next; one bound nowhere is not"
  body={async (harness) => {
    const { notebook } = harness.set(
      new Pocket(["greeting = 'hello'", "greeting.upper()\nnever_assigned"]),
    );

    await until("both cells to render", () => frames(harness.container).length === 2);

    const [, second] = notebook.code;

    await showingUndefinedNames(async () => {
      // What the server has already said was filtered on its way through, and
      // it says nothing again until the document changes.
      second.write("greeting.upper()\nnever_assigned\n");

      // The unbound name is what proves the server has analysed this cell at
      // all; asserting an absence before then would prove nothing.
      const reported = await until(
        "the language server to report the unbound name",
        async () => {
          const messages = await reportedIn(second);
          return messages.some((m) => m.includes("never_assigned")) && messages;
        },
        LANGUAGE_TIMEOUT_MS,
      );

      harness.note(reported.join("\n"));
      harness.expect(reported.some((m) => m.includes("greeting"))).toBe(false);
    });

    harness.capture("png");
  }}
>
  {#snippet vest(pocket: Pocket)}
    <Notebook.Component notebook={pocket.notebook} />
  {/snippet}
</Sweater>

<Sweater
  name="names a kernel session supplies are not reported as undefined"
  body={async (harness) => {
    harness.set(new Pocket(["print(inherited_from_the_session)"]));
    await until("the cell to render", () => frames(harness.container).length === 1);

    harness.expect(Editor.diagnosticFilters()).toContain(
      DiagnosticFilter.undefinedNames,
    );
  }}
>
  {#snippet vest(pocket: Pocket)}
    <Notebook.Component notebook={pocket.notebook} />
  {/snippet}
</Sweater>
