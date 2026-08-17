import type * as monaco from "monaco-editor";

/** A cell is as tall as its text; the page, not the editor, is what scrolls. */
const AS_A_CELL: monaco.editor.IEditorOptions = {
  scrollBeyondLastLine: false,
  scrollbar: {
    vertical: "hidden",
    horizontal: "auto",
    handleMouseWheel: false,
  },
  minimap: { enabled: false },
  overviewRulerLanes: 0,
  hideCursorInOverviewRuler: true,
  renderLineHighlight: "none",
  padding: { top: 8, bottom: 8 },
  automaticLayout: false,
};

export type Growing = {
  editor: monaco.editor.IStandaloneCodeEditor;
  container: HTMLElement;
  maxHeight?: number;
};

export const growWithContent = ({
  editor,
  container,
  maxHeight = Infinity,
}: Growing): monaco.IDisposable => {
  editor.updateOptions(AS_A_CELL);

  let height = -1;
  let width = -1;
  let laying = false;
  let frame: number | undefined;

  const apply = (contentHeight: number) => {
    const wanted = Math.min(Math.ceil(contentHeight), maxHeight);
    const available = container.clientWidth;
    if (wanted === height && available === width) return;
    if (wanted !== height) container.style.height = `${(height = wanted)}px`;
    laying = true;
    try {
      editor.layout({ width: available, height });
    } finally {
      laying = false;
      width = available;
    }
  };

  const schedule = (contentHeight?: number) => {
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      frame = undefined;
      apply(contentHeight ?? editor.getContentHeight());
    });
  };

  schedule();

  const grew = editor.onDidContentSizeChange(({ contentHeight }) => {
    // The layout above reports its own new size back here; measuring that
    // again is what makes an auto-height editor grow without bound.
    if (!laying) schedule(contentHeight);
  });

  const resized = new ResizeObserver(() => schedule());
  resized.observe(container);

  return {
    dispose: () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
      grew.dispose();
      resized.disconnect();
    },
  };
};
