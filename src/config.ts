import * as vscode from 'vscode';

export interface IConfig {
    version: string;
    get(key: string): any;
}

export const config: IConfig = {
    version: vscode.extensions.getExtension('sqz.vslab')?.packageJSON.version,

    get(key: string): any {
        return vscode.workspace.getConfiguration().get('vslab.' + key);
    }
};