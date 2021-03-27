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

async function populateShortcuts(entries: ShortcutEntry[], refMap: { [key: string]: string | undefined }, path: string): Promise<void> {
    if (!fs.existsSync(path)) {
        return;
    }

    let buf = await vscode.workspace.fs.readFile(vscode.Uri.file(path));
    let str = buf.toString();
    const refs = JSON.parse(JSON.stringify(yaml.load(str)))?.references ?? [];

    for (let e of refs) {
        for (let k in e) {
            let v: string = e[k];
            v = v.replace(/\$\{(\w+)\}/g, (s, a) => refMap[a] ?? s);
            refMap[k] = v;
        }
    }

    str = str.replace(/\$\{(\w+)\}/g, (s, a) => refMap[a] ?? s);
    const jsonStr = JSON.stringify(yaml.load(str));
    toolsConf = JSON.parse(jsonStr);

    const shortcuts = toolsConf.shortcuts ?? [];
    for (let e of shortcuts) {
        if (!e.uri) {
            continue;
        }
        entries.push({
            label: e.desc ?? e.uri,
            uri: e.uri?.startsWith('http') ? vscode.Uri.parse(e.uri) : vscode.Uri.file(e.uri ?? '')
        });
    }
}

export function onActivate(context: vscode.ExtensionContext) {
    toolsConf = null;
    shortcutEntries = [];

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

    let path = '';
    const rootPath = config.rootPath;
    if (rootPath) {
        path = rootPath + '/.vscode/vslab_tools.yml';
    }
    populateShortcuts(shortcutEntries, { ['ROOT']: rootPath }, path).then(() => {
        populateShortcuts(shortcutEntries, {}, config.get('tools.configPath')).then(() => {
            const view = vscode.window.createTreeView('vslabTools.shortcuts', { treeDataProvider: getTreeDataProvider(), showCollapseAll: true });
            context.subscriptions.push(view);
        });
    });
}