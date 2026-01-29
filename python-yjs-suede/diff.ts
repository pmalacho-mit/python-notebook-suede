import diff from "fast-diff";

type YjsDelta = { insert: string } | { retain: number } | { delete: number };

// from: https://dev.to/priolo/synchronizing-collaborative-text-editing-with-yjs-and-websockets-1dco
const diffToDelta = (diffed: ReturnType<typeof diff>): YjsDelta[] =>
  diffed
    .map(
      ([op, value]) =>
        ({
          [diff.INSERT]: { insert: value },
          [diff.EQUAL]: { retain: value.length },
          [diff.DELETE]: { delete: value.length },
        })[op]!,
    )
    .filter(Boolean);

export const diffAsDelta = ({ from, to }: Record<"from" | "to", string>) =>
  diffToDelta(diff(from, to));
