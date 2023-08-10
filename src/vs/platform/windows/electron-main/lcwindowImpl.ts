/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { BrowserView, BrowserWindow, ipcMain } from 'electron';
import { FileAccess } from 'vs/base/common/network';
import { IEnvironmentMainService } from 'vs/platform/environment/electron-main/environmentMainService';
import { IWindowState } from 'vs/platform/window/electron-main/window';

export class LCWindow {

	private homeBW: BrowserWindow;
	private workBV: BrowserView;
	private windowState: IWindowState;
	private environmentMainService: IEnvironmentMainService;

	private _isShowCodeWin: boolean = false;

	private _AttachCodeWin: boolean = false;

	constructor(homeBW: BrowserWindow, workBV: BrowserView, windowState: IWindowState, environmentMainService: IEnvironmentMainService) {
		this.homeBW = homeBW;
		this.workBV = workBV;
		this.windowState = windowState;
		this.environmentMainService = environmentMainService;
	}

	registerListeners(): void {
		ipcMain.on('lc:showwt', () => {
			this.showCodeWork();
		});
		ipcMain.on('lc:dissmisswt', () => {
			this.dissmissCodeWork();
		});
	}


	dissmissCodeWork(): void {
		if (this._isShowCodeWin && this.workBV) {
			this.homeBW.removeBrowserView(this.workBV);
		}
		this._isShowCodeWin = false;
	}
	showCodeWork(): void {
		if (!this.workBV) {
			console.log('codeWin not init');
			return;
		}
		if (!this._AttachCodeWin) {
			this.homeBW.setBrowserView(this.workBV);
			this.workBV.setBounds({ x: 0, y: 200, width: this.windowState.width || 800, height: this.windowState.height || 600 });
			this.workBV?.webContents.loadURL(FileAccess.asBrowserUri(`vs/code/electron-sandbox/workbench/workbench${this.environmentMainService.isBuilt ? '' : '-dev'}.html`).toString(true));
			this.workBV?.webContents.openDevTools();
			this._AttachCodeWin = true;
		} else {
			this.homeBW.setBrowserView(this.workBV);
		}
		this._isShowCodeWin = true;
	}

	getWebContents() {
		return this.workBV.webContents;
	}
}
