import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	console.log('VSLab activate!');

	context.subscriptions.push(vscode.workspace.onDidSaveTextDocument((doc) => {
		if (doc.isUntitled)
			return;

		const fileName = doc.fileName.replace(/\\/gm, '/');
		if (fileName.includes('Client/Assets/Res/Config/Language_')) {
			let tbl: { [key: string]: string; } = {};
			let breakLineNo = -1;
			let err = false;
			for (let i = 0; i < doc.lineCount; ++i) {
				let line = doc.lineAt(i);
				if (line.isEmptyOrWhitespace)
					continue;
				let str = line.text;
				if (str.startsWith('!!!')) {
					breakLineNo = i;
					break;
				}

				let idx = str.indexOf('=');
				if (idx < 0) {
					breakLineNo = i;
					err = true;
					break;
				}

				let key = str.substr(0, idx).trim();
				let value = str.substr(idx + 1);
				tbl[key] = value;
			}

			if (err) {
				vscode.window.showErrorMessage(`There is an error at line${breakLineNo + 1}.`);
				return;
			}
			if (breakLineNo === -1) {
				vscode.window.showErrorMessage(`There is an error at eof.`);
				return;
			}

			const sorted = Object.keys(tbl).sort();
			const conf = vscode.workspace.getConfiguration();

			if (conf.get('vslab.localization.formatOnSave')) {
				let fmtStrArr: string[] = [];

				let maxLen = -1;
				for (let i in sorted) {
					let k = sorted[i];
					if (maxLen < k.length)
						maxLen = k.length;
				}
				for (let i in sorted) {
					let k = sorted[i];
					fmtStrArr.push(`${k.padEnd(maxLen, ' ')}=${tbl[k]}`);
				}
				for (let i = breakLineNo; i < doc.lineCount; ++i) {
					let line = doc.lineAt(i);
					fmtStrArr.push(line.text);
				}

				const u8Str = Buffer.from(fmtStrArr.join('\n'), 'utf8');
				vscode.workspace.fs.writeFile(vscode.Uri.file(fileName), u8Str).then(() => {
					vscode.window.showInformationMessage(`Format done!`);
				});
			}

			if (conf.get('vslab.localization.exportCSOnSave')) {
				let csStrArr: string[] = [];
				csStrArr.push('namespace GameLogic.XlsConfig.LocizationStrings');
				csStrArr.push('{');
				csStrArr.push('    public static class LS');
				csStrArr.push('    {');
				for (let i in sorted) {
					let k = sorted[i];
					csStrArr.push(`        public const string ${k} = "${tbl[k]}";`);
				}
				csStrArr.push('    }');
				csStrArr.push('}');

				const u8Str = Buffer.from(csStrArr.join('\n'), 'utf8');
				const csFile = fileName.substr(0, fileName.lastIndexOf('/')) + '/../../Scripts/GameLogic/GameDataManager/Config/LocalizationStrings.cs';
				vscode.workspace.fs.writeFile(vscode.Uri.file(csFile), u8Str).then(() => {
					vscode.window.showInformationMessage(`Export "LocalizationStrings.cs" done!`);
				});
			}
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand('vslab.version', () => {
		vscode.window.showInformationMessage(`VSLab Version:${vscode.extensions.getExtension('sqz.vslab')?.packageJSON.version}`);
	}));
}

export function deactivate() { }
