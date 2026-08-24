'use strict';

const crypto = require('node:crypto');

function getWebviewHtml(webview, extensionUri) {
    const nonce = crypto.randomBytes(16).toString('base64');
    const stylesUri = webview.asWebviewUri(extensionUri.with({ path: `${extensionUri.path}/media/styles.css` }));
    const modelUri = webview.asWebviewUri(extensionUri.with({ path: `${extensionUri.path}/table-model.js` }));
    const scriptUri = webview.asWebviewUri(extensionUri.with({ path: `${extensionUri.path}/media/main.js` }));

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
    <link rel="stylesheet" href="${stylesUri}">
    <title>CSV Table</title>
</head>
<body>
    <main id="app" aria-busy="true">
        <header class="toolbar">
            <div class="identity">
                <strong id="file-name">CSV Table</strong>
                <span id="metadata" class="metadata"></span>
            </div>
            <label class="filter-wrap">
                <span class="sr-only">Filter all columns</span>
                <svg class="field-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-4-4"></path></svg>
                <input id="filter" type="search" placeholder="Filter all columns" autocomplete="off" spellcheck="false">
            </label>
            <button id="clear-filter" class="icon-button" type="button" title="Clear all filters" aria-label="Clear all filters" disabled>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"></path></svg>
            </button>
            <button id="open-text" class="icon-button" type="button" title="Open as text" aria-label="Open as text">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10"></path></svg>
            </button>
            <button id="refresh" class="icon-button" type="button" title="Refresh table" aria-label="Refresh table">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.34 5.66"></path><path d="M20 4v7h-7"></path></svg>
            </button>
        </header>
        <section id="notice" class="notice" aria-live="polite" hidden></section>
        <section id="table-scroll" class="table-scroll" tabindex="0" aria-label="CSV data table">
            <table id="table">
                <colgroup id="column-group"></colgroup>
                <thead><tr id="header-row"></tr></thead>
                <tbody id="table-body"></tbody>
            </table>
            <div id="empty-state" class="empty-state">Loading table...</div>
        </section>
        <section id="column-filter-menu" class="column-filter-menu" role="dialog" aria-modal="false" aria-labelledby="column-filter-title" hidden>
            <header class="column-filter-menu-header">
                <strong id="column-filter-title"></strong>
                <button id="close-column-filter" class="icon-button" type="button" title="Close" aria-label="Close column filter">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"></path></svg>
                </button>
            </header>
            <label class="column-value-search-wrap">
                <span class="sr-only">Search distinct values</span>
                <svg class="field-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-4-4"></path></svg>
                <input id="column-value-search" type="search" placeholder="Search values" autocomplete="off" spellcheck="false">
            </label>
            <label class="column-value-option select-all-option">
                <input id="select-all-values" type="checkbox">
                <span>Select all matching values</span>
            </label>
            <div id="column-value-list" class="column-value-list"></div>
            <footer class="column-filter-menu-footer">
                <span id="column-value-status"></span>
                <button id="load-more-values" type="button" hidden>Show more</button>
            </footer>
        </section>
        <footer id="status" class="status" aria-live="polite">Loading...</footer>
    </main>
    <script nonce="${nonce}" src="${modelUri}"></script>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

module.exports = { getWebviewHtml };
