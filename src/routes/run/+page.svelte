<script lang="ts" module>
  const examples = {
    repr_html: `
import pandas as pd

class MyObjectWithHTML:
    def __init__(self, data):
        self.data = data

    def __repr__(self):
        """Standard plain-text representation."""
        return f"MyObjectWithHTML(data={self.data!r})"

    def _repr_html_(self):
        """Rich HTML representation for notebooks/IPython."""
        # Example: embedding a pandas DataFrame's HTML repr within a custom message
        df = pd.DataFrame(self.data, index=["row1", "row2"])
        df_html = df._repr_html_()
        return (
            "<h3>Custom HTML Display</h3>"
            f"<p>This is a rich display of the object's data:</p>"
            f"{df_html}"
        )

# In a Jupyter notebook cell, simply output an instance of the class:
x = MyObjectWithHTML({'col1': [1, 2], 'col2': [3, 4]})
x
`,
  };
</script>

<script lang="ts">
  import PythonKernel from "../../../release/PythonKernel";

  const kernel = new PythonKernel(PythonKernel.DefaultEnvironment());
  kernel.run({ code: examples.repr_html });
</script>
