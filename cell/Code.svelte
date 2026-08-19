<script lang="ts" module>
  import type * as monaco from "monaco-editor";
  import { Editor } from "../../python-notebook-suede.python-monaco-suede";
  import { growWithContent } from "../editor/autoheight";
  import { installCellKeybindings } from "../editor/keybindings";
  import type { CodeCell } from "../model/cell.svelte";
  import Outputs from "./Outputs.svelte";

  export type Props = {
    cell: CodeCell;
    fontSize?: number;
    reveal: () => void;
  };
</script>

<script lang="ts">
  let { cell, fontSize = 14, reveal }: Props = $props();

  const notebook = $derived(cell.notebook);

  let editor = $state<monaco.editor.IStandaloneCodeEditor>();
  let container = $state<HTMLElement>();

  const selected = $derived(notebook.selected === cell);

  const select = (cell: ReturnType<typeof notebook.neighbour>) =>
    notebook.select(cell ?? notebook.selected);

  const commands = {
    run: () => notebook.run(cell),
    runAndAdvance: () => (
      commands.run(), select(notebook.neighbour(cell, 1, "code"))
    ),
    selectNext: () => select(notebook.neighbour(cell, 1)),
    selectPrevious: () => select(notebook.neighbour(cell, -1)),
  };

  const attach = (attached: monaco.editor.IStandaloneCodeEditor) => {
    editor = attached;
    const disposables = [
      // While this editor has the keyboard it answers for undo, so the
      // notebook leaves the key alone rather than undoing a deletion.
      attached.onDidFocusEditorText(() => {
        notebook.select(cell);
        notebook.editing = true;
      }),
      attached.onKeyDown((event) =>
        notebook.fire("user keydown in code cell", cell, event),
      ),
      attached.onDidPaste((event) =>
        notebook.fire("user paste in code cell", cell, event),
      ),
      attached.onDidBlurEditorText(() => (notebook.editing = false)),
      installCellKeybindings(attached, commands),
      ...(container ? [growWithContent({ editor: attached, container })] : []),
    ];
    return {
      dispose: () => disposables.forEach((disposable) => disposable.dispose()),
    };
  };

  /**
   * A shared cell's editor is bound to its text and follows it on its own.
   * An unshared one has no such link, so a write from anywhere but this
   * editor has to be carried over.
   */
  $effect(() => {
    const { source } = cell;
    const model = editor?.getModel();
    if (!model || cell.store.sourceSync) return;
    if (model.getValue() !== source) model.setValue(source);
  });

  /** Selection is what drives focus, so that the keyboard follows the ring. */
  $effect(() => {
    if (!selected || !editor || editor.hasTextFocus()) return;
    editor.focus();
    reveal();
  });

  $effect(() => () => Editor.unregisterFile(cell.file.path));
</script>

<div class="code">
  <div bind:this={container} class="editor" data-testid="editor">
    <Editor.Component file={cell.file} size={fontSize} onEditor={attach} />
  </div>
  <Outputs outputs={cell.outputs} />
</div>

<style>
  .code {
    display: flex;
    flex-direction: column;
  }

  .editor {
    background: white;
  }
</style>
