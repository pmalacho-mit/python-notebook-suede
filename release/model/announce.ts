import type { Unsubscribe } from "./store";

/** The listener bookkeeping every unshared store would otherwise repeat. */
export class Announcer {
  private readonly listeners = new Set<() => void>();

  observe = (listen: () => void): Unsubscribe => {
    this.listeners.add(listen);
    return () => void this.listeners.delete(listen);
  };

  protected announce = () => this.listeners.forEach((listen) => listen());
}
