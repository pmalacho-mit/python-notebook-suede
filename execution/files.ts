import {
  Kernel,
  type Contents,
} from "../../python-notebook-suede.python-web-kernel-suede";

const DIRECTORY = { directory: true } as const;

const nameUnder = (prefix: string, path: string) =>
  path.startsWith(prefix) ? path.slice(prefix.length).split("/")[0] : undefined;

/**
 * The files a notebook's cells read and write, held in memory for as long as
 * the notebook is open. A kernel given nowhere to write cannot run anything:
 * making one cell's names visible to the next has Python mark its working
 * directory a package, which it does by creating a file there.
 */
export class NotebookFiles {
  private readonly files = new Map<string, Contents>();
  private readonly directories = new Set<string>();

  get = (path: string) =>
    this.files.get(path) ?? (this.holdsDirectory(path) ? DIRECTORY : undefined);

  listDirectory = (path: string) => [...this.namesIn(path)];

  /** The kernel writes a directory as a path with no contents. */
  put = (path: string, value: Contents | null) => {
    if (value === null) return void this.directories.add(path);
    this.directories.delete(path);
    this.files.set(path, value);
  };

  delete = (path: string) => {
    this.files.delete(path);
    this.directories.delete(path);
  };

  move = ({ from, to }: { from: string; to: string }) => {
    const value = this.files.get(from);
    if (value === undefined) return;
    this.files.delete(from);
    this.files.set(to, value);
  };

  private holdsDirectory = (path: string) =>
    path === "" || this.directories.has(path) || this.namesIn(path).size > 0;

  private namesIn(directory: string) {
    const prefix = directory === "" ? "" : `${directory}/`;
    const paths = [...this.files.keys(), ...this.directories];
    return new Set(
      paths.map((path) => nameUnder(prefix, path)).filter(Boolean) as string[],
    );
  }
}

/** A Python kernel with a filesystem a notebook's cells can use. */
export const kernelFor = (files = new NotebookFiles()) =>
  new Kernel(Kernel.Environment({ fs: Kernel.ReadWriteFileSystem(files) }));
