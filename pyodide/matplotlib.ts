export type Payload = {
  base64: string;
  width: number;
  height: number;
};

export const is = (query: any): query is Payload =>
  typeof query === "object" &&
  query !== null &&
  typeof query.base64 === "string" &&
  typeof query.width === "number" &&
  typeof query.height === "number";

/**
 * Matplotlib currently creates a dom element which never gets attached to the DOM.
 * Without a way to specify our own DOM node creation function, we override it here - saving us from shipping our own matplotlib package.
 */
export function patchMatplotlib(module: { runPython: (code: string) => any }) {
  // Switch to simpler matplotlib backend https://github.com/jupyterlite/jupyterlite/blob/main/packages/pyolite-kernel/py/pyolite/pyolite/patches.py
  module.runPython(`import os
os.environ["MPLBACKEND"] = "AGG"`);

  module.runPython(`import matplotlib
import matplotlib.pyplot

def show():
  canvas = matplotlib.pyplot.gcf().canvas
  canvas.draw()
  pixels = canvas.buffer_rgba().tobytes()
  encoded = base64.b64encode(pixels).decode('utf-8')
  width, height = canvas.get_width_height()
  return { '${"base64" satisfies keyof Payload}': encoded, '${"width" satisfies keyof Payload}': width, '${"height" satisfies keyof Payload}': height }

matplotlib.pyplot.show = show
`);
}
