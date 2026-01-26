<div class="app-bar">
  <strong>Notebook (Static)</strong>
  <span style="font-size:0.8rem;color:#6b7280;">Python 3 • Connected</span>
</div>

<div class="layout">
  <!-- Sidebar -->
  <aside>
    <div class="panel">
      <div class="panel-header">Files</div>
      <div class="panel-body">
        <div class="file active">notebook.ipynb</div>
        <div class="file">data/</div>
        <div class="file indent">cars.csv</div>
        <div class="file">src/</div>
        <div class="file indent">utils.py</div>
      </div>
    </div>
  </aside>

  <!-- Notebook -->
  <section class="notebook">
    <div class="notebook-header">
      <h1>Untitled0.ipynb</h1>
      <p>Static HTML notebook mock (no JS)</p>
    </div>

    <div class="cells">
      <!-- Markdown cell -->
      <div class="cell">
        <div class="cell-row">
          <div class="cell-gutter">MD</div>
          <div class="cell-body" style="padding:1rem;">
            <h2>Notebook Title</h2>
            <p>
              This is a fully static, HTML + CSS notebook layout inspired by
              Jupyter and Google Colab.
            </p>
          </div>
        </div>
      </div>

      <!-- Code cell -->
      <div class="cell selected">
        <div class="cell-row">
          <div class="cell-gutter">
            <div class="exec">In&nbsp;[1]</div>
            <div class="run-btn"></div>
          </div>
          <div class="cell-body">
            <div class="cell-toolbar">Code</div>
            <pre class="editor mono">
import pandas as pd

df = pd.read_csv("data/cars.csv")
df.head()</pre>
            <div class="output">
              <div class="output-box ok">
                <div class="output-label">Out[1]</div>
                <table>
                  <thead>
                    <tr>
                      <th>mpg</th><th>cyl</th><th>disp</th><th>hp</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td>4.58</td><td>6</td><td>160</td><td>110</td></tr>
                    <tr><td>4.77</td><td>4</td><td>108</td><td>93</td></tr>
                    <tr><td>4.63</td><td>6</td><td>258</td><td>110</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Error cell -->
      <div class="cell">
        <div class="cell-row">
          <div class="cell-gutter">
            <div class="exec">In&nbsp;[2]</div>
            <div class="run-btn"></div>
          </div>
          <div class="cell-body">
            <div class="cell-toolbar">Code</div>
            <pre class="editor mono">1 / 0</pre>
            <div class="output">
              <div class="output-box error">
                <div class="output-label">ZeroDivisionError</div>
                division by zero
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Add cell divider -->
      <div class="add-cell">
        <hr />
        <div class="add-pill">+ Code</div>
        <div class="add-pill">+ Text</div>
        <hr />
      </div>
    </div>
  </section>
</div>

<style>
  /* ========== Reset & Base ========== */
  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    font-family:
      system-ui,
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      Roboto,
      Helvetica,
      Arial,
      sans-serif;
    background: #f9fafb;
    color: #111827;
  }

  h1,
  h2 {
    margin: 0;
    font-weight: 600;
  }

  p {
    margin: 0.5rem 0 0;
    color: #374151;
    line-height: 1.6;
  }

  pre {
    margin: 0;
    white-space: pre;
    overflow-x: auto;
  }

  code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
      "Liberation Mono", "Courier New", monospace;
  }

  .mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
      "Liberation Mono", "Courier New", monospace;
  }

  /* ========== Layout ========== */
  header {
    position: sticky;
    top: 0;
    z-index: 10;
    background: white;
    border-bottom: 1px solid #e5e7eb;
  }

  .app-bar {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 1rem;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  main {
    max-width: 1200px;
    margin: 0 auto;
    padding: 1.5rem 1rem;
  }

  .layout {
    display: grid;
    grid-template-columns: 280px 1fr;
    gap: 1.5rem;
  }

  /* ========== Sidebar ========== */
  aside {
    position: sticky;
    top: 88px;
    align-self: start;
  }

  .panel {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    box-shadow:
      0 1px 2px rgba(0, 0, 0, 0.06),
      0 10px 24px rgba(0, 0, 0, 0.06);
    overflow: hidden;
  }

  .panel-header {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #e5e7eb;
    font-size: 0.875rem;
    font-weight: 600;
  }

  .panel-body {
    padding: 0.5rem;
    font-size: 0.875rem;
  }

  .file {
    padding: 0.4rem 0.6rem;
    border-radius: 6px;
    cursor: default;
  }

  .file.active {
    background: #eff6ff;
    color: #1d4ed8;
    font-weight: 500;
  }

  .file.indent {
    padding-left: 1.5rem;
  }

  /* ========== Notebook Container ========== */
  .notebook {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    box-shadow:
      0 1px 2px rgba(0, 0, 0, 0.06),
      0 10px 24px rgba(0, 0, 0, 0.06);
  }

  .notebook-header {
    padding: 1rem 1.25rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .notebook-header h1 {
    font-size: 1.125rem;
  }

  .cells {
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  /* ========== Cells ========== */
  .cell {
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    overflow: hidden;
    background: white;
  }

  .cell.selected {
    position: relative;
  }

  .cell.selected::before {
    content: "";
    position: absolute;
    left: 0;
    top: 12px;
    bottom: 12px;
    width: 4px;
    background: #3b82f6;
    border-radius: 999px;
  }

  .cell-row {
    display: flex;
  }

  .cell-gutter {
    width: 56px;
    background: #f9fafb;
    border-right: 1px solid #e5e7eb;
    padding: 0.75rem 0.5rem;
    text-align: center;
    font-size: 0.75rem;
    color: #6b7280;
  }

  .exec {
    display: inline-block;
    padding: 0.15rem 0.4rem;
    border-radius: 6px;
    background: #f3f4f6;
    border: 1px solid #e5e7eb;
    color: #374151;
    margin-bottom: 0.5rem;
  }

  .run-btn {
    margin: 0.5rem auto 0;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 1px solid #d1d5db;
    background: white;
    position: relative;
  }

  .run-btn::after {
    content: "";
    position: absolute;
    top: 9px;
    left: 12px;
    border-top: 7px solid transparent;
    border-bottom: 7px solid transparent;
    border-left: 11px solid #374151;
  }

  .cell-body {
    flex: 1;
  }

  .cell-toolbar {
    padding: 0.5rem 1rem;
    border-bottom: 1px solid #e5e7eb;
    font-size: 0.75rem;
    color: #6b7280;
    display: flex;
    justify-content: space-between;
  }

  .editor {
    padding: 1rem;
    font-size: 0.875rem;
    line-height: 1.6;
    background: white;
  }

  /* ========== Outputs ========== */
  .output {
    border-top: 1px solid #e5e7eb;
    padding: 1rem;
  }

  .output-box {
    border-left: 4px solid #e5e7eb;
    padding: 0.75rem;
    border-radius: 8px;
    background: #ffffff;
  }

  .output-box.ok {
    border-left-color: #a7f3d0;
  }

  .output-box.error {
    border-left-color: #fecaca;
    color: #991b1b;
  }

  .output-label {
    font-size: 0.75rem;
    color: #6b7280;
    margin-bottom: 0.5rem;
  }

  /* ========== Tables ========== */
  table {
    border-collapse: collapse;
    width: 100%;
    font-size: 0.875rem;
  }

  th,
  td {
    padding: 0.4rem 0.6rem;
    border-bottom: 1px solid #e5e7eb;
    text-align: left;
  }

  th {
    background: #f9fafb;
    font-weight: 500;
    color: #374151;
  }

  /* ========== Add Cell Divider ========== */
  .add-cell {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin: 0.5rem 0;
  }

  .add-cell hr {
    flex: 1;
    border: none;
    height: 1px;
    background: #e5e7eb;
  }

  .add-pill {
    border: 1px solid #d1d5db;
    border-radius: 999px;
    padding: 0.25rem 0.75rem;
    font-size: 0.75rem;
    color: #374151;
    background: white;
  }

  /* ========== Responsive ========== */
  @media (max-width: 900px) {
    .layout {
      grid-template-columns: 1fr;
    }

    aside {
      display: none;
    }
  }
</style>
