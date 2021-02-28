import * as vscode from 'vscode';
import { config } from './config';
import * as localization from './localization';
import * as eventSystem from './eventSystem';
import * as tools from './tools';

let terminal: vscode.Terminal;

export function activate(context: vscode.ExtensionContext) {
	console.log('VSLab activate!');

	terminal = vscode.window.terminals.find(x => x.name === 'VSLab') ?? vscode.window.createTerminal('VSLab');

	context.subscriptions.push(vscode.commands.registerCommand('vslab.version', () => {
		vscode.window.showInformationMessage(`VSLab Version:${config.version}`);
	}));

	context.subscriptions.push(vscode.commands.registerCommand('vslab.runUIDuplicateCheck', (uri: vscode.Uri) => {
		const path = uri.fsPath.replace(/\\/gm, '/') + '/';
		if (!path.includes('Assets/Res/UI')) {
			return;
		}

		const rootPath = path.substr(0, path.indexOf('Assets/Res/UI')) + 'Assets/Res/UI/';
		const toolPath = rootPath.replace('Assets/Res/UI/', 'Misc/tools/ui_duplicate_check/');
		const exePath = toolPath + 'check.exe';
		terminal?.sendText(`start ${exePath} ${rootPath}-${path}`);

		vscode.workspace.openTextDocument(toolPath + 'result.txt').then(doc => {
			vscode.window.showTextDocument(doc);
		});
	}));

	localization.onActivate(context);
	eventSystem.onActivate(context);
	tools.onActivate(context);
}

export function deactivate() {
	terminal?.dispose();
}
