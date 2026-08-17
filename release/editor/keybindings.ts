import * as monaco from "monaco-editor";

export type CellCommands = {
  run: () => void;
  runAndAdvance: () => void;
  selectPrevious: () => void;
  selectNext: () => void;
};

type Action = {
  id: string;
  label: string;
  keybinding: number;
  run: () => void;
};

type Editor = monaco.editor.IStandaloneCodeEditor;

const atFirstCharacter = (editor: Editor) => {
  const at = editor.getPosition();
  return at?.lineNumber === 1 && at.column === 1;
};

const atLastCharacter = (editor: Editor) => {
  const model = editor.getModel();
  const at = editor.getPosition();
  if (!model || !at) return false;
  const last = model.getLineCount();
  return at.lineNumber === last && at.column === model.getLineMaxColumn(last);
};

/** An arrow key leaves the cell only when there is nowhere left to go in it. */
const leavingUpwards = (editor: Editor, leave: () => void): Action => ({
  id: "cell.selectPrevious",
  label: "Select the previous cell",
  keybinding: monaco.KeyCode.UpArrow,
  run: () =>
    atFirstCharacter(editor)
      ? leave()
      : editor.trigger("keyboard", "cursorUp", null),
});

const leavingDownwards = (editor: Editor, leave: () => void): Action => ({
  id: "cell.selectNext",
  label: "Select the next cell",
  keybinding: monaco.KeyCode.DownArrow,
  run: () =>
    atLastCharacter(editor)
      ? leave()
      : editor.trigger("keyboard", "cursorDown", null),
});

export const installCellKeybindings = (
  editor: Editor,
  { run, runAndAdvance, selectPrevious, selectNext }: CellCommands,
): monaco.IDisposable => {
  const actions: Action[] = [
    {
      id: "cell.run",
      label: "Run cell",
      keybinding: monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
      run,
    },
    {
      id: "cell.runAndAdvance",
      label: "Run cell and select the next",
      keybinding: monaco.KeyMod.Shift | monaco.KeyCode.Enter,
      run: runAndAdvance,
    },
    leavingUpwards(editor, selectPrevious),
    leavingDownwards(editor, selectNext),
  ];

  const installed = actions.map(({ keybinding, ...action }) =>
    editor.addAction({ ...action, keybindings: [keybinding] }),
  );

  return { dispose: () => installed.forEach((action) => action.dispose()) };
};
