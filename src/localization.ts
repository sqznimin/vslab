import * as vscode from 'vscode';
import { config } from './config';

const tokenTypes = new Map<string, number>();
const tokenModifiers = new Map<string, number>();

const legend = (function () {
    const tokenTypesLegend = [
        'comment', 'string', 'keyword', 'number', 'regexp', 'operator', 'namespace',
        'type', 'struct', 'class', 'interface', 'enum', 'typeParameter', 'function',
        'method', 'macro', 'variable', 'parameter', 'property', 'label', 'enumMember',
        'event'
    ];
    tokenTypesLegend.forEach((tokenType, index) => tokenTypes.set(tokenType, index));

    const tokenModifiersLegend = [
        'declaration', 'documentation', 'readonly', 'static', 'abstract', 'deprecated',
        'modification', 'async', 'definition', 'defaultLibrary'
    ];
    tokenModifiersLegend.forEach((tokenModifier, index) => tokenModifiers.set(tokenModifier, index));

    return new vscode.SemanticTokensLegend(tokenTypesLegend, tokenModifiersLegend);
})();

class DocumentSemanticTokensProvider implements vscode.DocumentSemanticTokensProvider {
    async provideDocumentSemanticTokens(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.SemanticTokens> {
        const builder = new vscode.SemanticTokensBuilder();
        this._parseText(document, builder);
        return builder.build();
    }

    private _encodeTokenType(tokenType: string): number {
        if (tokenTypes.has(tokenType)) {
            return tokenTypes.get(tokenType)!;
        }
        return 0;
    }

    private _encodeTokenModifier(tokenModifier: string): number {
        if (tokenModifiers.has(tokenModifier)) {
            return 1 << tokenModifiers.get(tokenModifier)!;
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

    private _parseText(doc: vscode.TextDocument, builder: vscode.SemanticTokensBuilder): void {
        const highlight: boolean = !!(config.get('localization.semanticHighlight'));

        for (let i = 0; i < doc.lineCount; i++) {
            if (doc.lineAt(i).isEmptyOrWhitespace) {
                continue;
            }

            const line = doc.lineAt(i).text;

            if (line.startsWith('!!!')) {
                builder.push(i, 0, line.length, this._encodeTokenType('comment'));
                continue;
            }

            const index = line.indexOf('=');
            if (index === -1) {
                continue;
            }

            builder.push(i, 0, index, this._encodeTokenType('macro'));

            let start: number = index + 1;
            if (highlight) {
                let open: boolean = false;
                let openPos: number = index + 1;
                for (let pos: number = index + 1; pos < line.length;) {
                    if (!open && (line.charAt(pos) === '\\') && (pos < line.length - 1)) {
                        if (line.charAt(pos + 1) === 'n') {
                            if (pos > start) {
                                builder.push(i, start, pos - start, this._encodeTokenType('string'));
                            }
                            builder.push(i, pos, 2, this._encodeTokenType('property'));
                            pos += 2;
                            start = pos;
                            continue;
                        }
                    }
                    else if (open && (line.charAt(pos) === '}')) {
                        if (openPos > start) {
                            builder.push(i, start, openPos - start, this._encodeTokenType('string'));
                        }
                        builder.push(i, openPos, pos - openPos + 1, this._encodeTokenType('number'));
                        open = false;
                        pos++;
                        start = pos;
                        continue;
                    }
                    else if (!open && (line.charAt(pos) === '{')) {
                        open = true;
                        openPos = pos;
                    }
                    pos++;
                }
            }
            if (start < line.length) {
                builder.push(i, start, line.length - start, this._encodeTokenType('string'));
            }
        }
    }
}

function onDidSaveLanguage(doc: vscode.TextDocument, fileName: string) {
    let tbl: { [key: string]: string; } = {};
    let breakLineNo = -1;
    let err = false;
    for (let i = 0; i < doc.lineCount; ++i) {
        if (doc.lineAt(i).isEmptyOrWhitespace) {
            continue;
        }

        const line = doc.lineAt(i).text;
        if (line.startsWith('!!!')) {
            breakLineNo = i;
            break;
        }

        let idx = line.indexOf('=');
        if (idx < 0) {
            breakLineNo = i;
            err = true;
            break;
        }

        let key = line.substr(0, idx).trim();
        let value = line.substr(idx + 1);
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

    if (config.get('localization.formatOnSave')) {
        let fmtStrArr: string[] = [];

        let maxLen = -1;
        for (let i in sorted) {
            let k = sorted[i];
            if (maxLen < k.length) {
                maxLen = k.length;
            }

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

    if (config.get('localization.exportCSOnSave')) {
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
    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(doc => {
        if (doc.isUntitled) {
            return;
        }

        const fileName = doc.fileName.replace(/\\/gm, '/');
        if (fileName.includes('Assets/Res/Config/Language_')) {
            onDidSaveLanguage(doc, fileName);
        }
    }));

    context.subscriptions.push(vscode.languages.registerDocumentSemanticTokensProvider({ language: 'localizationConfig' }, new DocumentSemanticTokensProvider(), legend));
}
