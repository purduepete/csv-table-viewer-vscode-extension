# CSV Table Viewer

Open CSV and TSV files as read-only, searchable tables in VS Code.

## Features

- Opens `.csv` and `.tsv` files in the table editor by default.
- Filters across every displayed cell.
- Filters individual columns by checking values from each column's distinct-value list.
- Clears the open column's filter without changing the global search or filters on other columns.
- Clears all active filters from the table toolbar.
- Select all in a searched value list selects only the matching values and deselects the rest.
- Sorts columns through unsorted, ascending, and descending states.
- Resizes columns by dragging a header edge, with arrow-key adjustment and double-click reset.
- Keeps headers visible while scrolling in either direction.
- Uses virtual rows so large previews do not create an unbounded DOM.
- Refreshes after external file changes without discarding valid filter or sort state.
- Follows the active VS Code light, dark, or high-contrast theme.

Use the text-lines button in the toolbar or **Reopen Editor With... > Text Editor** to inspect the raw source. The table viewer never writes to the file.

## Supported files

The viewer supports comma-delimited CSV and tab-delimited TSV with quoted fields, escaped quotes, embedded newlines, UTF-8, BOM-marked UTF-16LE/BE, and a Windows-1252 fallback.

V1 previews files up to 10 MiB and the first 50,000 data rows. A visible notice identifies truncated previews and fallback decoding. Filtering and sorting apply to the displayed preview.

Configurable delimiters, editing, full large-file indexing, type inference, and saved layouts are outside the first version.

## Build and install

Requirements: Node.js 20 or later, npm, PowerShell, and the `code` command on `PATH`.

```powershell
.\scripts\Build-Extension.ps1
.\scripts\Install-Extension.ps1
```

Reload VS Code after installing. The packaged extension is written to `dist\csv-table-viewer.vsix`.

## Development

```powershell
npm install
npm test
npm run package
```

Runtime code uses the stable VS Code custom editor API and Papa Parse. The webview has a nonce-based Content Security Policy and renders CSV values with `textContent`.
