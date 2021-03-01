import * as vscode from 'vscode';
import * as yaml from 'js-yaml';
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

        vscode.commands.registerCommand('vslab.shortcuts', () => {
            if (!shortcutEntries) {
                return;
            }
            const list: string[] = [];
            for (let e of shortcutEntries) {
                if (e.label) {
                    list.push(e.label);
                }
            }
            if (list.length === 0) {
                return;
            }
            vscode.window.showQuickPick(list).then(s => {
                let e = shortcutEntries.find(x => x.label === s);
                vscode.commands.executeCommand('vslab.openExternal', e?.uri);
            });
        });

        let str = buf.toString();
        const ref = JSON.parse(JSON.stringify(yaml.load(str)))?.references ?? {};
        str = str.replace(/\$\{(\w+)\}/g, (s, a) => ref[a] ?? s);
        const jsonStr = JSON.stringify(yaml.load(str));
        toolsConf = JSON.parse(jsonStr);

        const shortcuts = toolsConf.shortcuts ?? [];
        for (let e of shortcuts) {
            if (!e.uri) {
                continue;
            }
            shortcutEntries.push({
                label: e.desc ?? e.uri,
                uri: vscode.Uri.file(e.uri ?? '')
            });
        }

        const view = vscode.window.createTreeView('vslabTools.shortcuts', { treeDataProvider: getTreeDataProvider(), showCollapseAll: true });
        context.subscriptions.push(view);
    });
}