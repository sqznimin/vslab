import * as vscode from 'vscode';
import * as yaml from 'js-yaml';

export function onActivate(context: vscode.ExtensionContext) {
    context.subscriptions.push(vscode.commands.registerCommand('vslab.yaml2json', () => {
        try {
            const text = vscode.window.activeTextEditor?.document.getText() ?? "";
            const str = JSON.stringify(yaml.load(text), null, '    ');
            vscode.workspace.openTextDocument({ language: 'json', content: str });
        } catch (e) {
            vscode.window.showErrorMessage(e);
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand('vslab.json2yaml', () => {
        try {
            const text = vscode.window.activeTextEditor?.document.getText() ?? "";
            const str = yaml.dump(JSON.parse(text));
            vscode.workspace.openTextDocument({ language: 'yaml', content: str });
        } catch (e) {
            vscode.window.showErrorMessage(e);
        }
    }));
}