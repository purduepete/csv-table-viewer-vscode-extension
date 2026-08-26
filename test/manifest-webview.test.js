'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { getWebviewHtml } = require('../webview');

test('manifest contributes default CSV and TSV custom editor', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    assert.equal(manifest.icon, 'images/icon.png');
    assert.equal(fs.existsSync(path.join(__dirname, '..', manifest.icon)), true);
    const editor = manifest.contributes.customEditors[0];
    assert.equal(editor.viewType, 'csvTableViewer.table');
    assert.equal(editor.priority, 'default');
    assert.deepEqual(
        editor.selector.map((item) => item.filenamePattern),
        ['*.csv', '*.tsv'],
    );
    assert.equal(
        manifest.contributes.commands.some((command) => command.command === 'csvTableViewer.open'),
        true,
    );
});

test('webview uses strict CSP and packaged resources', () => {
    const extensionUri = {
        path: '/extension',
        with(change) {
            return { path: change.path };
        },
    };
    const webview = {
        cspSource: 'vscode-webview://test',
        asWebviewUri(uri) {
            return `webview:${uri.path}`;
        },
    };
    const html = getWebviewHtml(webview, extensionUri);
    assert.match(html, /default-src 'none'/);
    assert.match(html, /script-src 'nonce-/);
    assert.doesNotMatch(html, /unsafe-inline|unsafe-eval|https?:/);
    assert.match(html, /media\/styles\.css/);
    assert.match(html, /media\/main\.js/);
    assert.match(html, /table-model\.js/);
    assert.match(html, /id="column-group"/);
    assert.match(html, /id="column-filter-menu"/);
    assert.match(html, /id="select-all-values"/);
    assert.match(html, /aria-label="Clear all filters"/);
    assert.match(html, /id="clear-column-filter"[^>]*aria-label="Clear this column's filter"[^>]*disabled/);
});
