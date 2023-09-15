/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { BrowserView, BrowserWindow, Menu, ipcMain, app, dialog } from 'electron';
import { FileAccess } from 'vs/base/common/network';
import { IEnvironmentMainService } from 'vs/platform/environment/electron-main/environmentMainService';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { INativeHostMainService } from 'vs/platform/native/electron-main/nativeHostMainService';
import { Server as ElectronIPCServer } from 'vs/base/parts/ipc/electron-main/ipc.electron';
import { URI } from 'vs/base/common/uri';
import { IMenubarMainService } from 'vs/platform/menubar/electron-main/menubarMainService';
import { ICommonNativeLCService } from 'vs/platform/lc/common/ILC';
import { LcOps } from 'vs/platform/lc/electron-main/LcOps';
import { IWindowsMainService } from 'vs/platform/windows/electron-main/windows';
import { CancellationToken } from 'vs/base/common/cancellation';

export const ILCService = createDecorator<ILCService>('lcService');

export interface ILCService extends ICommonNativeLCService {
	// 添加这个，会使createInstance不报错
	readonly _serviceBrand: undefined;
	bindWindow(homeBW: BrowserWindow, workBV: BrowserView): void;

	registerListeners(): void;
	showVSMenu(): void;

	dismissVSMenuAndShowMyMenu(): void;
	dissmissCodeWork(): void;

	getWebContents(): Electron.WebContents;
	initService(mINativeHostMainService: INativeHostMainService, mainProcessElectronServer: ElectronIPCServer): void;
}

export class LCService implements ILCService {
	declare readonly _serviceBrand: undefined;
	private homeBW: BrowserWindow | undefined;
	private workBV!: BrowserView;
	private _isShowCodeWin: boolean = false;

	private _AttachCodeWin: boolean = false;

	private mINativeHostMainService!: INativeHostMainService;

	constructor(
		@IEnvironmentMainService private readonly environmentMainService: IEnvironmentMainService,
		@IMenubarMainService private readonly menubarMainService: IMenubarMainService,
		@IWindowsMainService private readonly windowsMainService: IWindowsMainService
	) {
		// this.menubarMainService.dismissMenu();
	}

	//绑定主窗口
	bindWindow(homeBW: BrowserWindow, workBV: BrowserView): void {
		this.homeBW = homeBW;
		this.workBV = workBV;
	}

	initService(mINativeHostMainService: INativeHostMainService, mainProcessElectronServer: ElectronIPCServer) {
		this.mINativeHostMainService = mINativeHostMainService;
		// this.dismissVSMenuAndShowMyMenu();
	}


	registerListeners(): void {
		//注册关闭 vscode 窗口事件
		ipcMain.on('lc:close', () => {
			this.dissmissCodeWork();
		});
		//注册打开 vscode 窗口事件
		ipcMain.on('lc:open', ({ }, args: LcOps) => {
			this.openVscode(args);
		});

		//注册打开 vscode 窗口事件
		ipcMain.on('lc:show', ({ }) => {
			this.newOrOpenVsCode();
		});

		ipcMain.on('lc:showMenu', () => {
			this.dismissVSMenuAndShowMyMenu();
		});

		// 通过electron获取用户本地目录
		ipcMain.on('lc:open-directory-dialog', function (event, p) {
			dialog.showOpenDialog({
				properties: [p],
				title: '请选择保存目录',
				buttonLabel: '选择'
			}).then(result => {
				console.log(result)
				event.sender.send('lc:selectedItem', result.filePaths[0])
			})
		});

		// 获取electron运行平台类型
		ipcMain.on('lc:get-platform', function (event, p) {
			event.sender.send('lc:electronPlatform', process.platform)
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
				label: 'Ta+3 低代码平台',
				submenu: [
					{ label: '关于' },
					{ type: 'separator' },
					{ label: 'Exit', accelerator: 'Cmdorctrl+Q', click: () => { app.quit(); } }
				]
			},
			{
				label: '编辑',
				submenu: [
					{ role: 'undo' },
					{ role: 'redo' },
					{ type: 'separator' },
					{ role: 'cut' },
					{ role: 'copy' },
					{ role: 'paste' },
					{ role: 'selectAll' }
				]
			}
		];

		const menu = Menu.buildFromTemplate(template);
		Menu.setApplicationMenu(menu);
	}


	dissmissCodeWork(): void {
		this.dismissVSMenuAndShowMyMenu();
		if (this._isShowCodeWin && this.workBV) {
			this.homeBW?.removeBrowserView(this.workBV);
		}
		this._isShowCodeWin = false;
		this.homeBW?.webContents.executeJavaScript('top.document.getElementsByClassName("header")[0].style.display = ""');
	}

	private newOrOpenVsCode(): void {
		if (!this.workBV) {
			console.log('codeWin not init');
			return;
		}
		const mainOps = this.homeBW?.getBounds();
		const ops: LcOps = {};
		ops.width = mainOps?.width;
		ops.height = mainOps?.height;
		ops.x = 0;
		ops.y = 0;
		this.menubarMainService.showVSMenu();
		if (!this._AttachCodeWin) {

			//创建
			this.homeBW?.setBrowserView(this.workBV);
			this.workBV.setBounds({ x: ops.y || 0, y: ops.x || 0, width: ops.width || 800, height: ops.height || 600 });
			this.workBV.setAutoResize({ width: true, height: true, horizontal: false, vertical: false });
			this.workBV?.webContents.loadURL(FileAccess.asBrowserUri(`vs/code/electron-sandbox/workbench/workbench${this.environmentMainService.isBuilt ? '' : '-dev'}.html`).toString(true));
			// this.workBV?.webContents.openDevTools(); //注册自定义键再打开
			this._AttachCodeWin = true;

		} else {
			// 还原
			this.homeBW?.setBrowserView(this.workBV);
			this.workBV.setBounds({ x: ops.y || 0, y: ops.x || 0, width: ops.width || 800, height: ops.height || 600 });

		}
		this._isShowCodeWin = true;
	}

	getWebContents() {
		return this.workBV.webContents;
	}

	//下载 git 并打开
	private fromGitProject(args: LcOps) {
		const gitUrl = args.gitUrl;
		const localPath = args.localPath;
		const window = this.windowsMainService.getFocusedWindow();
		window?.sendWhenReady('vscode:runAction', CancellationToken.None, { id: 'git.clone', from: 'menu', args: [gitUrl, localPath] });
		// this.workspaceTrustManagementService.setParentFolderTrust(true);
	}

	//打开 vscode
	private openVscode(args: LcOps) {
		//创建或者还原vscode窗口
		this.newOrOpenVsCode();

		//有本地参数
		if (args.workspace) {
			//则打开本地项目
			this.openFolder(args.workspace);

		} else if (args.gitUrl) {
			//没有则打开 git 下载
			this.fromGitProject(args);
		} else {
			//都没有则空工程
			this.openFolder('');
		}

	}
}
