'use strict';

const path = require('node:path');
const vscode = require('vscode');
const { FileTooLargeError, readCsvBytes } = require('./csv-reader');
const { getWebviewHtml } = require('./webview');

const VIEW_TYPE = 'csvTableViewer.table';

class CsvTableDocument {
    constructor(uri) {
        this.uri = uri;
        this.panels = new Set();
        this.disposables = [];
    }

    dispose() {
        vscode.Disposable.from(...this.disposables).dispose();
        this.panels.clear();
    }
}

class CsvTableEditorProvider {
    constructor(context) {
        this.context = context;
    }

    async openCustomDocument(uri) {
        const document = new CsvTableDocument(uri);
        if (uri.scheme === 'file') {
            const directory = vscode.Uri.file(path.dirname(uri.fsPath));
            const watcher = vscode.workspace.createFileSystemWatcher(
                new vscode.RelativePattern(directory, path.basename(uri.fsPath)),
            );
            const notifyChanged = () => {
                for (const panel of document.panels) {
                    void panel.webview.postMessage({ type: 'externalChange' });
                }
            };
            document.disposables.push(watcher, watcher.onDidChange(notifyChanged), watcher.onDidCreate(notifyChanged));
        }
        return document;
    }

    async resolveCustomEditor(document, panel) {
        document.panels.add(panel);
        panel.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.context.extensionUri],
        };
        panel.webview.html = getWebviewHtml(panel.webview, this.context.extensionUri);

        const sendData = async () => {
            await panel.webview.postMessage({ type: 'loading' });
            try {
                const bytes = await vscode.workspace.fs.readFile(document.uri);
                const extension = path.extname(document.uri.path);
                const parsed = readCsvBytes(bytes, extension);
                const viewState = this.context.workspaceState.get(`csvViewState:${document.uri.toString()}`);
                await panel.webview.postMessage({
                    type: 'data',
                    payload: {
                        fileName: path.basename(document.uri.path),
                        ...parsed,
                        viewState,
                    },
                });
            } catch (error) {
                await panel.webview.postMessage({
                    type: error instanceof FileTooLargeError ? 'fileTooLarge' : 'error',
                    message: error instanceof Error ? error.message : String(error),
                });
            }
        };

        const messageDisposable = panel.webview.onDidReceiveMessage(async (message) => {
            if (message?.type === 'ready' || message?.type === 'refresh') {
                await sendData();
            } else if (message?.type === 'saveViewState') {
                const key = `csvViewState:${document.uri.toString()}`;
                if (message.viewState) {
                    await this.context.workspaceState.update(key, message.viewState);
                } else {
                    await this.context.workspaceState.update(key, undefined);
                }
            } else if (message?.type === 'openText') {
                await vscode.commands.executeCommand('vscode.openWith', document.uri, 'default');
            }
        });
        const panelDisposable = panel.onDidDispose(() => {
            document.panels.delete(panel);
            messageDisposable.dispose();
            panelDisposable.dispose();
        });
    }
}

function activeResource() {
    return vscode.window.activeTextEditor?.document.uri;
}

function activate(context) {
    const provider = new CsvTableEditorProvider(context);
    context.subscriptions.push(
        vscode.window.registerCustomEditorProvider(VIEW_TYPE, provider, {
            webviewOptions: { retainContextWhenHidden: true },
            supportsMultipleEditorsPerDocument: true,
        }),
        vscode.commands.registerCommand('csvTableViewer.open', async (uri) => {
            const target = uri || activeResource();
            if (target) await vscode.commands.executeCommand('vscode.openWith', target, VIEW_TYPE);
        }),
        vscode.commands.registerCommand('csvTableViewer.openText', async (uri) => {
            const target = uri || activeResource();
            if (target) await vscode.commands.executeCommand('vscode.openWith', target, 'default');
        }),
    );
}

function deactivate() {}

module.exports = { activate, deactivate, CsvTableDocument, CsvTableEditorProvider };
