import type { YNotebook } from "@jupyter/ydoc";
import { WebsocketProvider } from "y-websocket";

const PORT = 1234;
const TIMEOUT_MS = 10_000;

/**
 * Where the page came from, so that a browser running in another container
 * finds the sync server on the host it already reached this page through.
 */
const serverHost = () => window.location.hostname;

const timeout = (milliseconds: number, message: string) =>
  new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(message)), milliseconds),
  );

const firstSync = (provider: WebsocketProvider) =>
  new Promise<void>((resolve) => provider.once("sync", () => resolve()));

export type Connection = ReturnType<typeof connect>;

/**
 * Joins a notebook to the room of the same name on the sync server. The
 * notebook owns its Yjs document, so the provider is built around it rather
 * than the other way round.
 */
export const connect = (
  notebook: YNotebook,
  room: string,
  { host = serverHost(), port = PORT } = {},
) => {
  const provider = new WebsocketProvider(`ws://${host}:${port}`, room, notebook.ydoc, {
    disableBc: true,
  });

  const synced = Promise.race([
    firstSync(provider),
    timeout(TIMEOUT_MS, `No sync server at ws://${host}:${port} (npm run sync-server)`),
  ]);

  return { provider, synced, disconnect: () => provider.destroy() };
};
