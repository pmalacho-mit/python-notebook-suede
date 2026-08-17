import {
  Chained,
  type Chain,
  type ChainedFile,
} from "../../python-notebook-suede.python-monaco-suede";
import { debounce } from "../utils";

/** A keystroke in the first of twenty cells otherwise resends nineteen. */
const RESYNC_DELAY_MS = 150;

/**
 * A notebook's cells as the language server sees them: one namespace, in which
 * a name bound in one cell is visible in every cell after it. Editing a cell
 * leaves those later cells analysed against text the server no longer has, so
 * they are resent.
 */
export const chainedCells = (files: () => readonly ChainedFile[]) => {
  const chain: Chain = {
    get files() {
      return files();
    },
  };

  const delivered = new Map<ChainedFile, string>();

  const resyncAfter = debounce(RESYNC_DELAY_MS, (from: ChainedFile) =>
    Chained.resyncAfter(chain, from),
  );

  const earliestStale = () =>
    chain.files.find((file) => delivered.get(file) !== file.source);

  return {
    register: () => Chained.register(chain),

    /** Reads every cell's text, so a caller may treat it as a tracked read. */
    settle: () => {
      const stale = earliestStale();
      chain.files.forEach((file) => delivered.set(file, file.source));
      if (stale) resyncAfter(stale);
    },
  };
};
