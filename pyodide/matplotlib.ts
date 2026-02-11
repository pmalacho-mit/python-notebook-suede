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

  module.runPython(`
import js
import matplotlib
import matplotlib.pyplot
import base64
import io

class Dud:

    def __init__(self, *args, **kwargs) -> None:
        return

    def __getattr__(self, __name: str):
        return Dud

def show():
  js.document = Dud()
  canvas = matplotlib.pyplot.gcf().canvas
  canvas.draw()
  buf = io.BytesIO()
  canvas.print_png(buf)
  buf.seek(0)
  encoded = base64.b64encode(buf.read()).decode('ascii')
  width, height = canvas.get_width_height()
  return { '${"base64" satisfies keyof Payload}': encoded, '${"width" satisfies keyof Payload}': int(width), '${"height" satisfies keyof Payload}': int(height) }

matplotlib.pyplot.show = show
`);
}
