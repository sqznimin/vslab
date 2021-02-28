import * as vscode from 'vscode';
import * as fs from 'fs';
import { config } from './config';

let toolsConf: any = null;

interface ShortcutEntry {
    uri: vscode.Uri;
    label: string;
}

let shortcutEntries: ShortcutEntry[] = [];

function getTreeDataProvider(): vscode.TreeDataProvider<ShortcutEntry> {
    return {
        getChildren: e => shortcutEntries,

        getTreeItem: e => {
            return {
                label: e.label,
                resourceUri: e.uri,
                command: { command: 'vslab.openExternal', title: 'Open', arguments: [e.uri], }
            };
        },
    };
}

export function onActivate(context: vscode.ExtensionContext) {
    toolsConf = null;
    shortcutEntries = [];

    const path = config.get('tools.configPath');
    if (!fs.existsSync(path)) {
        return;
    }

    vscode.workspace.fs.readFile(vscode.Uri.file(path)).then(buf => {
        vscode.commands.registerCommand('vslab.openExternal', uri => {
            if (uri) {
                vscode.env.openExternal(uri);
            }
        });

        const str = buf.toString();
        toolsConf = JSON.parse(str);

        const shortcuts = toolsConf.shortcuts ?? [];
        for (let e of shortcuts) {
            if (!e.uri) {
                continue;
            }
            shortcutEntries.push({
                label: e.desc ?? e.uri,
                uri: vscode.Uri.file(e.uri ?? "")
            });
        }

        const view = vscode.window.createTreeView('vslabTools.shortcuts', { treeDataProvider: getTreeDataProvider(), showCollapseAll: true });
        context.subscriptions.push(view);
    });

}