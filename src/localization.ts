import * as vscode from 'vscode';

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

interface IParsedToken {
    line: number;
    startCharacter: number;
    length: number;
    tokenType: number;
    tokenModifiers: number;
}

class DocumentSemanticTokensProvider implements vscode.DocumentSemanticTokensProvider {
    async provideDocumentSemanticTokens(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.SemanticTokens> {
        const allTokens = this._parseText(document);
        const builder = new vscode.SemanticTokensBuilder();
        allTokens.forEach((token) => {
            builder.push(token.line, token.startCharacter, token.length, token.tokenType, token.tokenModifiers);
        });
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

    private _parseText(doc: vscode.TextDocument): IParsedToken[] {
        const highlight: boolean = !!(vscode.workspace.getConfiguration().get('vslab.localization.semanticHighlight'));
        const r: IParsedToken[] = [];
        for (let i = 0; i < doc.lineCount; i++) {
            if (doc.lineAt(i).isEmptyOrWhitespace)
                continue;
            const line = doc.lineAt(i).text;
            const index = line.indexOf('=');
            if (index === -1)
                continue;
            r.push({
                line: i,
                startCharacter: 0,
                length: index,
                tokenType: this._encodeTokenType('macro'),
                tokenModifiers: 0,
            });

            let start: number = index + 1;
            if (highlight) {
                let open: boolean = false;
                let openPos: number = index + 1;
                for (let pos: number = index + 1; pos < line.length;) {
                    if (!open && (line.charAt(pos) == '\\') && (pos < line.length - 1)) {
                        if (line.charAt(pos + 1) == 'n') {
                            if (pos > start) {
                                r.push({
                                    line: i,
                                    startCharacter: start,
                                    length: pos - start,
                                    tokenType: this._encodeTokenType('string'),
                                    tokenModifiers: 0
                                });
                            }
                            r.push({
                                line: i,
                                startCharacter: pos,
                                length: 2,
                                tokenType: this._encodeTokenType('property'),
                                tokenModifiers: 0
                            });
                            pos += 2;
                            start = pos;
                            continue;
                        }
                    }
                    else if (open && (line.charAt(pos) == '}')) {
                        if (openPos > start) {
                            r.push({
                                line: i,
                                startCharacter: start,
                                length: openPos - start,
                                tokenType: this._encodeTokenType('string'),
                                tokenModifiers: 0
                            });
                        }
                        r.push({
                            line: i,
                            startCharacter: openPos,
                            length: pos - openPos + 1,
                            tokenType: this._encodeTokenType('number'),
                            tokenModifiers: 0
                        });
                        open = false;
                        pos++;
                        start = pos;
                        continue;
                    }
                    else if (!open && (line.charAt(pos) == '{')) {
                        open = true;
                        openPos = pos;
                    }
                    pos++;
                }
            }
            if (start < line.length - 1) {
                r.push({
                    line: i,
                    startCharacter: start,
                    length: line.length - start,
                    tokenType: this._encodeTokenType('string'),
                    tokenModifiers: 0
                });
            }
        }
        return r;
    }
}

function onDidSaveLanguage(doc: vscode.TextDocument, fileName: string) {
    let tbl: { [key: string]: string; } = {};
    let breakLineNo = -1;
    let err = false;
    for (let i = 0; i < doc.lineCount; ++i) {
        if (doc.lineAt(i).isEmptyOrWhitespace)
            continue;
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
    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(doc => {
        if (doc.isUntitled)
            return;
        const fileName = doc.fileName.replace(/\\/gm, '/');
        if (fileName.includes('Assets/Res/Config/Language_')) {
            onDidSaveLanguage(doc, fileName);
        }
    }));

    context.subscriptions.push(vscode.languages.registerDocumentSemanticTokensProvider({ language: 'localizationConfig' }, new DocumentSemanticTokensProvider(), legend));
}
