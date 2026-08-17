/** Deep enough to cover a working session; shallow enough to stay free. */
const REMEMBERED = 100;

/**
 * What a store looked like before each change, so a change can be taken back.
 *
 * States are held by reference and never copied into, which is what makes
 * undoing a deletion give back the same cell — with the text and the outputs
 * it had — rather than a new one that merely looks like it.
 */
export class History<State> {
  private readonly past: State[] = [];
  private readonly future: State[] = [];

  constructor(private readonly remembered = REMEMBERED) {}

  /** Call before changing, with the state being left behind. */
  record(present: State) {
    this.past.push(present);
    if (this.past.length > this.remembered) this.past.shift();
    this.future.length = 0;
  }

  canUndo = () => this.past.length > 0;

  canRedo = () => this.future.length > 0;

  undo(present: State) {
    if (!this.canUndo()) return undefined;
    this.future.push(present);
    return this.past.pop();
  }

  redo(present: State) {
    if (!this.canRedo()) return undefined;
    this.past.push(present);
    return this.future.pop();
  }
}
