/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { BrowserView, BrowserWindow, Menu, app, ipcMain } from 'electron';
import { FileAccess } from 'vs/base/common/network';
import { IEnvironmentMainService } from 'vs/platform/environment/electron-main/environmentMainService';
import { IWindowState } from 'vs/platform/window/electron-main/window';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { INativeHostMainService } from 'vs/platform/native/electron-main/nativeHostMainService';
import { Server as ElectronIPCServer } from 'vs/base/parts/ipc/electron-main/ipc.electron';
import { URI } from 'vs/base/common/uri';
import { IMenubarMainService } from 'vs/platform/menubar/electron-main/menubarMainService';
import { ICommonNativeLCService } from 'vs/platform/lc/common/ILC';
import { LcOps } from 'vs/platform/lc/common/LcOps';

export const ILCService = createDecorator<ILCService>('lcService');

export interface ILCService extends ICommonNativeLCService {
	// 添加这个，会使createInstance不报错
	readonly _serviceBrand: undefined;
	bindWindow(homeBW: BrowserWindow, workBV: BrowserView, windowState: IWindowState, environmentMainService: IEnvironmentMainService): void;

	registerListeners(): void;
	showVSMenu(): void;

	dismissVSMenuAndShowMyMenu(): void;
	dissmissCodeWork(): void;
	showCodeWork(args: LcOps): void;

	getWebContents(): Electron.WebContents;
	initService(mINativeHostMainService: INativeHostMainService, mainProcessElectronServer: ElectronIPCServer): void;
}

export class LCService implements ILCService {
	declare readonly _serviceBrand: undefined;
	private homeBW: BrowserWindow | undefined;
	private workBV!: BrowserView;
	// private windowState: IWindowState | undefined;
	private viewMargins: Electron.Rectangle | undefined;
	private _isShowCodeWin: boolean = false;

	private _AttachCodeWin: boolean = false;

	private mINativeHostMainService!: INativeHostMainService;

	constructor(
		@IEnvironmentMainService private readonly environmentMainService: IEnvironmentMainService,
		@IMenubarMainService private readonly menubarMainService: IMenubarMainService,

	) {
	}

	initService(mINativeHostMainService: INativeHostMainService, mainProcessElectronServer: ElectronIPCServer) {
		this.mINativeHostMainService = mINativeHostMainService;
	}

	bindWindow(homeBW: BrowserWindow, workBV: BrowserView, windowState: IWindowState, environmentMainService: IEnvironmentMainService) {
		this.homeBW = homeBW;
		this.workBV = workBV;
		// this.windowState = windowState;
		homeBW.on('resize', () => {
			this.updateBVBounds();
		});
	}


	updateBVBounds() {
		const viewBounds = this.getViewBounds();
		if (viewBounds) {
			this.viewMargins = viewBounds;
			this.workBV.setBounds(viewBounds);
		}
	}

	registerListeners(): void {
		ipcMain.on('lc:showwt', ({ }, args: LcOps) => {
			this.showCodeWork(args);
		});
		ipcMain.on('lc:dissmisswt', () => {
			this.dissmissCodeWork();
		});
		ipcMain.on('lc:showvsmenu', () => {
			this.showVSMenu();
		});
		ipcMain.on('lc:dismissmenu', () => {
			this.dismissVSMenuAndShowMyMenu();
		});
		ipcMain.on('lc:openFolder', (ret, message) => {
			this.openFolder(message);
		});
	}

	async openFolder(path: string) {
		const options = {
			forceNewWindow: false, telemetryExtraData: {
				from:
					'menu'
			}
		};
		if (path) {
			const paths: string[] = [path];
			await this.mINativeHostMainService.doOpenPicked(undefined, paths.map(path => ({ folderUri: URI.file(path) })), options);
		} else {
			this.mINativeHostMainService.pickFolderAndOpen(undefined, options);
		}

	}

	showVSMenu() {
		this.menubarMainService.showVSMenu();
	}

	dismissVSMenuAndShowMyMenu() {
		this.menubarMainService.dismissMenu();
		const template: Electron.MenuItemConstructorOptions[] = [
			{
				label: 'File',
				submenu: [
					{ label: 'New', accelerator: 'CmdOrCtrl+N', click: () => { /* 处理新建操作 */ } },
					{ label: 'Open', accelerator: 'CmdOrCtrl+O', click: () => { /* 处理打开操作 */ } },
					{ type: 'separator' },
					{ label: 'Exit', accelerator: 'CmdOrCtrl+Q', click: () => { app.quit(); } }
				]
			},
			// 其他菜单项...
		];

		const menu = Menu.buildFromTemplate(template);
		Menu.setApplicationMenu(menu);
	}


	dissmissCodeWork(): void {
		if (this._isShowCodeWin && this.workBV) {
			this.homeBW?.removeBrowserView(this.workBV);
		}
		this._isShowCodeWin = false;
	}

	showCodeWork(args: LcOps): void {

		const height = args.height;
		const width = args.width;
		const y = args.y;
		const x = args.x;
		const workspace = args.workspace;

		if (!this.workBV) {
			console.log('codeWin not init');
			return;
		}
		if (!this._AttachCodeWin) {
			// this.workBV.webContents.reload();
			this.homeBW?.setBrowserView(this.workBV);

			this.workBV.setBounds({ x: y || 0, y: x || 0, width: width || 800, height: height || 600 });
			this.workBV.setAutoResize({ width: true, height: true, horizontal: false, vertical: false });
			this.workBV?.webContents.loadURL(FileAccess.asBrowserUri(`vs/code/electron-sandbox/workbench/workbench${this.environmentMainService.isBuilt ? '' : '-dev'}.html`).toString(true));
			if (workspace) {
				this.openFolder(workspace);
			}
			this.workBV?.webContents.openDevTools(); //注册自定义键再打开
			this._AttachCodeWin = true;
		} else {
			this.homeBW?.setBrowserView(this.workBV);
			if (workspace) {
				this.openFolder(workspace);
				this.workBV.webContents.reload();
			}
			// this.updateBVBounds(); 使用setAutoResize
		}
		this._isShowCodeWin = true;
	}

	getWebContents() {
		return this.workBV.webContents;
	}

	getViewBounds(): Electron.Rectangle | undefined {
		if (this.homeBW && this.viewMargins) {
			const size = this.homeBW.getSize();
			const viewMargins = this.viewMargins;
			return {
				x: 0 + Math.round(viewMargins.x),
				y: 0 + Math.round(viewMargins.y),
				width: size[0] - viewMargins.x,
				height: size[1] - viewMargins.y
			};
		}
		return;
	}
}
