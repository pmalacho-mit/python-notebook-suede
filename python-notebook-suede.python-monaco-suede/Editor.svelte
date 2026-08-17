<script lang="ts" module>
  import { whenReady as pythonReady } from "@codingame/monaco-vscode-python-default-extension";
  import { MonacoEditorLanguageClientWrapper } from "monaco-editor-wrapper";
  import { configureDefaultWorkerFactory } from "monaco-editor-wrapper/workers/workerLoaders";
  import { getMonacoEnvironmentEnhanced } from "monaco-languageclient/vscode/services";
  import * as monaco from "monaco-editor";
  import { MonacoBinding } from "y-monaco";
  import { untrack } from "svelte";
  import type { EditableFile } from "./models.svelte";
  import { analyse, prepare, servicesStarted } from "./workspace";

  export type OnEditor = (
    editor: monaco.editor.IStandaloneCodeEditor,
  ) => monaco.IDisposable;

  type Attachable = Pick<EditableFile, "path" | "source" | "sourceSync">;

  /**
   * The first attach brings the workspace's services up, and a second begun
   * before it finishes brings them up again — which throws, leaving that
   * editor unattached. Only the first has to be alone; making every attach
   * wait its turn would leave a long notebook opening one cell at a time.
   */
  let first: Promise<unknown> | undefined;

  /** Read from the page rather than remembered, so that a second copy of this
   *  module — a dev server's reload, say — cannot answer differently. */
  const servicesAreUp = () =>
    getMonacoEnvironmentEnhanced()?.vscodeApiInitialised === true;

  const afterTheFirst = <T,>(attach: () => Promise<T>): Promise<T> => {
    if (first !== undefined) return first.then(attach);
    const attached = attach();
    first = attached.catch(() => {});
    return attached;
  };

  /**
   * The grammar that colours Python arrives with an extension the editor
   * brings up, and a model created before it is registered stays plain until
   * something makes the view redraw — which, left alone, is the first
   * keystroke.
   */
  const highlight = async (editor: monaco.editor.IStandaloneCodeEditor) => {
    await pythonReady();
    editor.render(true);
  };

  const attachEditor = async (
    target: HTMLElement,
    file: Attachable,
    onEditor?: OnEditor,
  ) => {
    const modified = await prepare(file.path, file.source);

    const wrapper = new MonacoEditorLanguageClientWrapper();

    await wrapper.initAndStart({
      $type: "extended",
      vscodeApiConfig: { vscodeApiInitPerformExternally: servicesAreUp() },
      htmlContainer: target,
      editorAppConfig: {
        useDiffEditor: false,
        monacoWorkerFactory: configureDefaultWorkerFactory,
        codeResources: { modified },
        editorOptions: {
          /**
           * An embedded editor sits inside something that clips, and a hover
           * is routinely taller than the editor it belongs to. Fixed widgets
           * are laid out against the viewport instead, which only the editor
           * that builds them can be told — the option is read once, when the
           * view is constructed.
           */
          fixedOverflowWidgets: true,
        },
      },
    });

    servicesStarted();
    await analyse(file.path);

    const editor = wrapper.getEditor();
    if (!editor) throw new Error("Editor not found");

    const model = editor.getModel();
    if (!model) throw new Error("Model not found");

    void highlight(editor);

    file.source = model.getValue();

    const disposables = [
      onEditor?.(editor),
      model.onDidChangeContent(() => (file.source = model.getValue())),
    ];

    const dispose = () => {
      disposables.forEach((disposable) => disposable?.dispose());
      wrapper.dispose();
    };

    return { model, editor, dispose };
  };

  export type Props = {
    file: EditableFile;
    size?: number;
    readonlyOverride?: boolean;
    onEditor?: OnEditor;
  };
</script>

<script lang="ts">
  let { file, onEditor, readonlyOverride = false, size = 14 }: Props = $props();

  let container = $state<HTMLElement>();
  let current = $state<ReturnType<typeof attachEditor>>();

  $effect(() => {
    if (!container) return;
    const { path: _ } = file;
    const child = document.createElement("div");
    child.style.width = "100%";
    child.style.height = "100%";
    container.appendChild(child);
    const handle = untrack(() => afterTheFirst(() => attachEditor(child, file, onEditor)));
    current = handle;
    return () => {
      handle.then(({ dispose }) => dispose());
      container?.removeChild(child);
    };
  });

  $effect(() => {
    const { readonly } = file;
    const readOnly = readonlyOverride || readonly;
    current?.then(({ editor }) => editor.updateOptions({ readOnly }));
  });

  $effect(() => {
    const fontSize = size;
    current?.then(({ editor }) => editor.updateOptions({ fontSize }));
  });

  $effect(() => {
    const { sourceSync } = file;
    if (!sourceSync) return;
    let dispose: (() => void) | null = null;
    current?.then(({ model, editor }) => {
      const binding = new MonacoBinding(sourceSync, model, new Set([editor]));
      dispose = () => binding.destroy();
    });
    return () => dispose?.();
  });
</script>

<div style:width="100%" style:height="100%" bind:this={container}></div>
