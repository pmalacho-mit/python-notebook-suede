import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

export const iframe = (param = "as-iframe") => {
  const { search, pathname } = window.location;
  const params = new URLSearchParams(search);
  const is = params.get(param) !== null;
  const src = pathname + "?" + param;
  const indexedSrc = (index: number) => `${src}&index=${index}`;
  const index = Number(params.get("index"));
  return { is, src, indexedSrc, index };
};

export const doc = ({
  host = "localhost",
  port = 1234,
  room = "dummy",
  guid,
  connectionTimeoutMs = 10000,
}: {
  host?: string;
  port?: number;
  room?: string;
  guid: string;
  connectionTimeoutMs?: number;
}) => {
  const ydoc = new Y.Doc({ guid });

  const provider = new WebsocketProvider(`ws://${host}:${port}`, room, ydoc, {
    disableBc: true,
  });

  provider.on("sync", (isSynced: boolean) =>
    ydoc.emit("sync", [isSynced, ydoc]),
  );

  const connected = Promise.race([
    new Promise<void>((resolve, reject) => {
      provider.on("status", ({ status }) =>
        status === "connected"
          ? resolve()
          : status === "disconnected"
            ? reject(new Error("Could not connect to Yjs websocket server"))
            : undefined,
      );
    }),
    new Promise<void>((_, reject) =>
      setTimeout(
        () => reject(new Error("Connection to Yjs websocket server timed out")),
        connectionTimeoutMs,
      ),
    ),
  ]);

  return { ydoc, connected, provider };
};
