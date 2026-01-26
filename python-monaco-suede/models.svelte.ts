import type { MonacoBinding } from "y-monaco";

export class EditableFile {
  name: string;
  path: string;
  content: string;
  readonly: boolean;
  sync?: ConstructorParameters<typeof MonacoBinding>[0];

  constructor({
    name,
    parent,
    content = "",
    readonly = false,
    sync = undefined,
  }: Pick<EditableFile, "name"> & {
    parent: Pick<EditableFile, "path">;
  } & Partial<Pick<EditableFile, "content" | "readonly" | "sync">>) {
    this.name = $state(name);
    this.path = $derived(`${parent.path}/${name}`);
    this.content = $state(content);
    this.readonly = $state(readonly);
    this.sync = $state(sync);
  }
}
