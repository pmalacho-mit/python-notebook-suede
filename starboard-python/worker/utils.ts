export type Typed<T extends Record<string, any>> = {
  [K in keyof T]: { type: K } & T[K];
}[keyof T];

export type SyncResult<T, E = Error> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      status: number;
      error: E;
      detail?: string;
    };
