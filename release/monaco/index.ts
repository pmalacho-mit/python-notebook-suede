import * as monaco from "monaco-editor";

export function enableMonacoAutoHeight(opts: {
  editor: monaco.editor.IStandaloneCodeEditor;
  container: HTMLElement; // the element you pass to monaco.create(...)
  maxHeightPx?: number; // optional: cap for very large cells
  extraBottomPx?: number; // optional: small breathing room
}): monaco.IDisposable {
  const { editor, container: containerElement } = opts;
  const maxHeightPx = opts.maxHeightPx ?? Infinity;
  const extraBottomPx = opts.extraBottomPx ?? 0;

  // Strongly recommended options for "auto-height cell"
  editor.updateOptions({
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
    // If you use padding, keep it stable (don’t dynamically change it during resize)
    padding: { top: 8, bottom: 8 },
    automaticLayout: false,
  });

  let lastHeight = -1;
  let lastWidth = -1;

  // Guards to prevent feedback loops
  let inLayout = false;
  let rafId: number | null = null;

  const applySize = (targetContentHeight?: number) => {
    if (rafId != null) cancelAnimationFrame(rafId);

    rafId = requestAnimationFrame(() => {
      rafId = null;

      const width = containerElement.clientWidth;

      // Prefer Monaco's content height (never use DOM scrollHeight here)
      const contentHeight = targetContentHeight ?? editor.getContentHeight();

      // Cap height if desired (you can re-enable vertical scrolling when capped)
      const clampedHeight = Math.min(
        Math.ceil(contentHeight + extraBottomPx),
        maxHeightPx,
      );

      // Only touch DOM + layout if something actually changed
      const heightChanged = clampedHeight !== lastHeight;
      const widthChanged = width !== lastWidth;

      if (!heightChanged && !widthChanged) return;

      // Apply DOM height first (important)
      if (heightChanged) {
        containerElement.style.height = `${clampedHeight}px`;
        lastHeight = clampedHeight;
      }

      // Now tell Monaco its new size.
      // This can trigger content-size events; guard against re-entrancy.
      inLayout = true;
      try {
        editor.layout({ width, height: lastHeight });
      } finally {
        inLayout = false;
        lastWidth = width;
      }
    });
  };

  // Initial sizing
  applySize();

  const contentSizeDisposable = editor.onDidContentSizeChange((e) => {
    // If layout caused this event, ignore it; applySize already used the new height.
    if (inLayout) return;

    // e.contentHeight is the key value; it’s stable and does not “compound”
    applySize(e.contentHeight);
  });

  // Width changes: handle separately to avoid height feedback loops
  const ro = new ResizeObserver(() => {
    applySize(); // uses editor.getContentHeight() for height, new clientWidth for width
  });
  ro.observe(containerElement);

  return {
    dispose: () => {
      if (rafId != null) cancelAnimationFrame(rafId);
      contentSizeDisposable.dispose();
      ro.disconnect();
    },
  };
}

export type NotebookCellKeybindings = {
  // execution
  runAndFocusNext: () => void | Promise<void>;
  run: () => void | Promise<void>;
  //runCellAndInsertBelow: () => void | Promise<void>;

  // mode / focus
  // exitEditMode: () => void;

  // navigation (optional but nice)
  focusPrevious?: () => void;
  focusNext?: () => void;

  // Optional: treat "at top/bottom of editor" as notebook navigation.
  enableEdgeArrowNavigation?: boolean;
};

export function installNotebookCellKeybindings(
  editor: monaco.editor.IStandaloneCodeEditor,
  opts: NotebookCellKeybindings,
): monaco.IDisposable {
  const {
    runAndFocusNext: runAndFocusNext,
    run: runCell,
    //runCellAndInsertBelow,
    //exitEditMode,
    focusPrevious: focusPrevCell,
    focusNext: focusNextCell,
    enableEdgeArrowNavigation = true,
  } = opts;

  const disposables: monaco.IDisposable[] = [];

  // Helper: register a command with Monaco’s keybinding service
  const add = (
    keybinding: number,
    handler: () => void | Promise<void>,
    when?: string,
  ) => {
    // Monaco allows a "context key expression" via "when" only for addAction.
    // For commands, we typically just always register and let the handler decide.
    // If you want a strict "when", use addAction below.
    const id = editor.addCommand(keybinding, () => void handler());
    // addCommand returns an internal command id string; no disposable.
    // So instead, we register via addAction which *does* give a disposable.
    // We'll use addAction for reliability and clean disposal.
  };

  // Prefer addAction so we get a disposable and can set "when" contexts if desired.
  const addAction = (cfg: {
    id: string;
    label: string;
    keybinding: number;
    run: () => void | Promise<void>;
    // context expr; keep simple unless you’re using Monaco context keys elsewhere
    precondition?: string;
    keybindingContext?: string;
  }) => {
    disposables.push(
      editor.addAction({
        id: cfg.id,
        label: cfg.label,
        keybindings: [cfg.keybinding],
        precondition: cfg.precondition,
        keybindingContext: cfg.keybindingContext,
        run: () => cfg.run(),
      }),
    );
  };

  // --- Notebook-style execution bindings ---
  addAction({
    id: "notebook.runCell.shiftEnter",
    label: "Run Cell (Shift+Enter)",
    keybinding: monaco.KeyMod.Shift | monaco.KeyCode.Enter,
    run: runAndFocusNext,
  });

  addAction({
    id: "notebook.runCell.ctrlEnter",
    label: "Run Cell (Ctrl/Cmd+Enter)",
    // Monaco uses CtrlCmd to mean Ctrl on Win/Linux, Cmd on macOS
    keybinding: monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
    run: runCell,
  });

  // addAction({
  //   id: "notebook.runCell.altEnter",
  //   label: "Run Cell and Insert Below (Alt+Enter)",
  //   keybinding: monaco.KeyMod.Alt | monaco.KeyCode.Enter,
  //   run: runCellAndInsertBelow,
  // });

  // --- Exit edit mode (Esc) ---
  // addAction({
  //   id: "notebook.exitEditMode",
  //   label: "Exit Edit Mode (Esc)",
  //   keybinding: monaco.KeyCode.Escape,
  //   run: exitEditMode,
  // });

  // --- Optional: Arrow navigation at edges (Jupyter-like) ---
  if (enableEdgeArrowNavigation && (focusPrevCell || focusNextCell)) {
    const isAtTop = () => {
      const pos = editor.getPosition();
      if (!pos) return false;
      return pos.lineNumber === 1 && pos.column === 1;
    };

    const isAtBottom = () => {
      const model = editor.getModel();
      const pos = editor.getPosition();
      if (!model || !pos) return false;
      const lastLine = model.getLineCount();
      const lastCol = model.getLineMaxColumn(lastLine);
      return pos.lineNumber === lastLine && pos.column === lastCol;
    };

    if (focusPrevCell) {
      addAction({
        id: "notebook.focusPrevCell.onUpAtTop",
        label: "Focus Previous Cell (Up at top)",
        keybinding: monaco.KeyCode.UpArrow,
        run: () => {
          // only steal the key if the cursor is truly at the top
          if (isAtTop()) focusPrevCell();
          else editor.trigger("keyboard", "cursorUp", null);
        },
      });
    }

    if (focusNextCell) {
      addAction({
        id: "notebook.focusNextCell.onDownAtBottom",
        label: "Focus Next Cell (Down at bottom)",
        keybinding: monaco.KeyCode.DownArrow,
        run: () => {
          if (isAtBottom()) focusNextCell();
          else editor.trigger("keyboard", "cursorDown", null);
        },
      });
    }
  }

  return {
    dispose: () => {
      for (const d of disposables) d.dispose();
    },
  };
}
