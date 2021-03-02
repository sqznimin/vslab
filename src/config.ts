import * as vscode from 'vscode';

export interface IConfig {
    version: string;
    rootPath: string | undefined;
    get(key: string): any;
}

export const config: IConfig = {
    version: vscode.extensions.getExtension('sqz.vslab')?.packageJSON.version,

    get rootPath() {
        let p = vscode.workspace.workspaceFolders?.[0].uri.path;
        return p?.substr(1);
    },

    get(key: string): any {
        return vscode.workspace.getConfiguration().get('vslab.' + key);
    }
};