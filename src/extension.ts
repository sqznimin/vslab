import * as vscode from 'vscode';
import * as yaml from 'js-yaml';
import * as localization from './localization';

let terminal: vscode.Terminal;

function onDidSaveEventsDefine(doc: vscode.TextDocument, fileName: string) {
	const jsonStr = JSON.stringify(yaml.load(doc.getText()));
	const json = JSON.parse(jsonStr);

	let sb: string[] = [];
	const usings: string[] = json.usings;
	for (let i = 0; i < usings.length; ++i) {
		sb.push(`using ${usings[i]};`);
	}

	sb.push('');
	sb.push('namespace GameLogic.Event');
	sb.push('{');
	sb.push('    public static class GE');
	sb.push('    {');
	sb.push('        static readonly EventPublisher events = new EventPublisher();');
	sb.push('        public static void OffAll() { events.OffAllEvents(); }');

	const modules = json.events;
	for (let i = 0; i < modules.length; ++i) {
		for (let k in modules[i]) {
			const events = modules[i][k];
			if ((events?.length ?? 0) == 0)
				break;

			sb.push('');
			sb.push(`        public static class ${k}`);
			sb.push('        {');
			for (let j = 0; j < events.length; ++j) {
				try {
					let name: string = events[j].name.trim();
					let targs: string = '';
					let comment: string = events[j].desc ?? '';
					let idx = name.indexOf('<');
					if (idx != -1) {
						targs = name.substr(idx);
						name = name.substr(0, idx);
					}
					if (comment != '') {
						sb.push('            /// <summary>');
						sb.push(`            /// ${comment}`);
						sb.push('            /// </summary>');
					}
					sb.push(`            public static readonly EventEmitter${targs} ${name} = events.Reg(new EventEmitter${targs}());`);
				}
				catch
				{
					vscode.window.showErrorMessage(`Export "GlobalEvents.cs" error, at event class: ${k}.`);
					return;
				}
			}
			sb.push('        }');
			break;
		}
	}

	sb.push('    }');
	sb.push('}');

	const u8Str = Buffer.from(sb.join('\n'), 'utf8');
	const csFile = fileName.substr(0, fileName.lastIndexOf('/')) + '/../../Assets/Scripts/GameLogic/Event/GlobalEvents.cs';
	vscode.workspace.fs.writeFile(vscode.Uri.file(csFile), u8Str).then(() => {
		vscode.window.showInformationMessage(`Export "GlobalEvents.cs" done!`);
	});
}

export function activate(context: vscode.ExtensionContext) {
	console.log('VSLab activate!');

	terminal = vscode.window.createTerminal('VSLab');

	context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(doc => {
		if (doc.isUntitled)
			return;

		const fileName = doc.fileName.replace(/\\/gm, '/');
		if (fileName.includes('Assets/Res/Config/Language_')) {
			localization.onDidSaveLanguage(doc, fileName);
		}
		else if (fileName.includes('event_define')) {
			onDidSaveEventsDefine(doc, fileName)
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand('vslab.version', () => {
		vscode.window.showInformationMessage(`VSLab Version:${vscode.extensions.getExtension('sqz.vslab')?.packageJSON.version}`);
	}));

	context.subscriptions.push(vscode.commands.registerCommand('vslab.runUIDuplicateCheck', (uri: vscode.Uri) => {
		const path = uri.fsPath.replace(/\\/gm, '/') + '/';
		if (!path.includes('Assets/Res/UI'))
			return;

		const rootPath = path.substr(0, path.indexOf('Assets/Res/UI')) + 'Assets/Res/UI/';
		const toolPath = rootPath.replace('Assets/Res/UI/', 'Misc/tools/ui_duplicate_check/');
		const exePath = toolPath + 'check.exe';
		terminal?.sendText(`start ${exePath} ${rootPath}-${path}`);

		vscode.workspace.openTextDocument(toolPath + 'result.txt').then(doc => {
			vscode.window.showTextDocument(doc);
		});
	}));

	localization.onActivate(context);
}

export function deactivate() {
	terminal?.dispose();
}
