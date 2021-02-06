import * as vscode from 'vscode';

// "editor.semanticTokenColorCustomizations": {
//     "enabled": true
// }

const tokenTypes = new Map<string, number>();
const tokenModifiers = new Map<string, number>();

const legend = (function () {
    const tokenTypesLegend = [
        'comment', 'string', 'keyword', 'number', 'regexp', 'operator', 'namespace',
        'type', 'struct', 'class', 'interface', 'enum', 'typeParameter', 'function',
        'method', 'macro', 'variable', 'parameter', 'property', 'label'
    ];
    tokenTypesLegend.forEach((tokenType, index) => tokenTypes.set(tokenType, index));

    const tokenModifiersLegend = [
        'declaration', 'documentation', 'readonly', 'static', 'abstract', 'deprecated',
        'modification', 'async'
    ];
    tokenModifiersLegend.forEach((tokenModifier, index) => tokenModifiers.set(tokenModifier, index));

    return new vscode.SemanticTokensLegend(tokenTypesLegend, tokenModifiersLegend);
})();

interface IParsedToken {
    line: number;
    startCharacter: number;
    length: number;
    tokenType: number;
}

class DocumentSemanticTokensProvider implements vscode.DocumentSemanticTokensProvider {
    async provideDocumentSemanticTokens(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.SemanticTokens> {
        const allTokens = this._parseText(document.getText());
        const builder = new vscode.SemanticTokensBuilder();
        allTokens.forEach((token) => {
            builder.push(token.line, token.startCharacter, token.length, token.tokenType, 0);
        });
        return builder.build();
    }

    private _encodeTokenType(tokenType: string): number {
        if (tokenTypes.has(tokenType)) {
            return tokenTypes.get(tokenType)!;
        }
        return 0;
    }

    private _encodeTokenModifiers(strTokenModifiers: string[]): number {
        let result = 0;
        for (let i = 0; i < strTokenModifiers.length; i++) {
            const tokenModifier = strTokenModifiers[i];
            if (tokenModifiers.has(tokenModifier)) {
                result = result | (1 << tokenModifiers.get(tokenModifier)!);
            }
        }
        return result;
    }

    private _parseText(text: string): IParsedToken[] {
        const r: IParsedToken[] = [];
        const lines = text.split(/\r\n|\r|\n/);
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const index = line.indexOf('=');
            if (index === -1)
                continue;
            r.push({
                line: i,
                startCharacter: 0,
                length: index,
                tokenType: this._encodeTokenType('keyword'),
            });
            r.push({
                line: i,
                startCharacter: index + 1,
                length: line.length - (index + 1),
                tokenType: this._encodeTokenType('string'),
            });
        }
        return r;
    }
}

export function onDidSaveLanguage(doc: vscode.TextDocument, fileName: string) {
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

        fmtStrArr.push('');
        fmtStrArr.push('');
        fmtStrArr.push('');
        fmtStrArr.push('');

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
        csStrArr.push('namespace GameLogic.Localization');
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

export function onActivate(context: vscode.ExtensionContext) {
    context.subscriptions.push(vscode.languages.registerDocumentSemanticTokensProvider({ language: 'localizationConfig' }, new DocumentSemanticTokensProvider(), legend));
}
