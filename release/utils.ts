/** Joins path segments, tolerating a stray slash on either side of a join. */
export const join = (...segments: string[]) =>
  segments
    .map((segment) => segment.replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/");

export const debounce = <T extends unknown[]>(
  milliseconds: number,
  run: (...args: T) => void,
) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: T) => {
    clearTimeout(timer);
    timer = setTimeout(() => run(...args), milliseconds);
  };
};
