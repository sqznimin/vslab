import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {

	console.log('VSLab activate!');

	context.subscriptions.push(vscode.workspace.onDidSaveTextDocument((doc) => {
		if (doc.isUntitled)
			return;

		if (doc.fileName.includes('Client\\Assets\\Res\\Config\\Language_')) {
			let strArr = [];

			strArr.push('namespace GameLogic.XlsConfig.LocizationStrings');
			strArr.push('{');
			strArr.push('    public static class LS');
			strArr.push('    {');

			let tbl: { [key: string]: string; } = {};
			for (let i = 0; i < doc.lineCount; ++i) {
				let line = doc.lineAt(i);
				if (line.isEmptyOrWhitespace)
					continue;
				let str = line.text;
				if (str.startsWith('!!!'))
					break;

				let idx = str.indexOf('=');
				if (idx < 0)
					continue;

				let key = str.substr(0, idx).trim();
				let value = str.substr(idx + 1);
				tbl[key] = value;
			}

			let sorted = Object.keys(tbl).sort();
			for (let i in sorted) {
				let k = sorted[i];
				strArr.push(`        public const string ${k} = "${tbl[k]}";`);
			}

			strArr.push('    }');
			strArr.push('}');

			const u8Str = Buffer.from(strArr.join('\n'), 'utf8');
			let csFile = doc.fileName.substr(0, doc.fileName.lastIndexOf('\\')) + '/../../Scripts/GameLogic/GameDataManager/Config/LocalizationStrings.cs';
			vscode.workspace.fs.writeFile(vscode.Uri.file(csFile), u8Str).then(() => {
				vscode.window.showInformationMessage(`导出成功`);
			});
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand('vslab.version', () => {
		vscode.window.showInformationMessage(`VSLab 版本：${vscode.extensions.getExtension('sqz.vslab')?.packageJSON.version}`);
	}));
}

export function deactivate() { }
