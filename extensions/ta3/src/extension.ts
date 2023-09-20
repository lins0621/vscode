/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as open from 'open';
import * as crypto from 'crypto';

const DB_PATH = path.join(__dirname, './data/db.json');

const VUE_TEMPLATE = '';

//配置
const url = vscode.workspace.getConfiguration().get('lowcode.url')?.toString() || '';
const { pathname } = new URL(url);

export function activate(context: vscode.ExtensionContext) {
	init(context);
}

async function hash(parentOrigin: string, salt: string): Promise<string> {
	const strData = JSON.stringify({ parentOrigin, salt });
	const encoder = new TextEncoder();
	const arrData = encoder.encode(strData);
	const hash = await crypto.subtle.digest('sha-256', arrData);
	return sha256AsBase32(hash);
}

function sha256AsBase32(bytes: ArrayBuffer): string {
	const array = Array.from(new Uint8Array(bytes));
	const hexArray = array.map(b => b.toString(16).padStart(2, '0')).join('');
	return BigInt(`0x${hexArray}`).toString(32).padStart(52, '0');
}

async function getWebViewContent(context: vscode.ExtensionContext, templatePath: string) {
	const resourcePath = getExtensionFileAbsolutePath(context, templatePath);
	const dirPath = path.dirname(resourcePath);
	let html = fs.readFileSync(resourcePath, 'utf-8');
	// vscode不支持直接加载本地资源，需要替换成其专有路径格式，这里只是简单的将样式和JS的路径替换
	html = html.replace(/(<link.+?href="|<script.+?src="|<img.+?src=")(.+?)"/g, (_m, $1, $2) => {
		return $1 + vscode.Uri.file(path.resolve(dirPath, $2)).with({ scheme: 'vscode-resource' }).toString() + '"';
	});
	return html;
}

function getExtensionFileAbsolutePath(context: vscode.ExtensionContext, relativePath: string) {
	return path.join(context.extensionPath, relativePath);
}

/**
 * 从某个HTML文件读取能被Webview加载的HTML内容
 * @param context 上下文
 * @param templatePath 相对于插件根目录的html文件相对路径
 */
async function init(context: vscode.ExtensionContext): Promise<string> {
	const panelList: any[] = [];
	// 创建低代码页面
	context.subscriptions.push(vscode.commands.registerCommand('extension.openLowcodePage', (uri): any => {

		openLowcodePage(uri, context, panelList);


	}));

	// 更新低代码页面数据
	context.subscriptions.push(vscode.commands.registerCommand('extension.updateLowcodePage', (uri) => {
		const serverId = btoa(uri._fsPath);
		const serverFileIdPromise = hash('vscode-file://vscode-app', serverId);
		serverFileIdPromise.then(id => {
			const fileId = uri._fsPath;// 路径作为文件的id
			if (panelList[fileId]) {
				panelList[fileId].webview.postMessage({
					cmd: 'updateData',
					data: {
						// src: vscode.workspace.getConfiguration().get('openLowcodePage.src'), //src
						src: `vscode-webview://${id}` + pathname, //src
						// src: 'http://192.168.73.169:3000/',
						db: JSON.parse(fs.readFileSync(DB_PATH).toString() || '{}'), // 数据资源
						code: fs.readFileSync(uri._fsPath).toString(), // 打开的页面数据
						path: uri._fsPath // 文件路径
					}
				});
			} else {
				// vscode.window.showInformationMessage(`请先打开低代码设计器`)
			}
		});
	}));


	context.subscriptions.push(vscode.commands.registerCommand('extension.newVueFile', async (resourceUri) => {
		if (resourceUri) {
			const folderPath = resourceUri.fsPath;

			let fileName = await vscode.window.showInputBox({
				prompt: '输入文件名称',
				placeHolder: 'example.vue'
			});

			if (fileName) {
				fileName = fileName + '.vue';
				const filePath = path.join(folderPath, fileName);

				try {
					fs.writeFileSync(filePath, VUE_TEMPLATE, 'utf-8');
					vscode.window.showInformationMessage(`文件 "${fileName}"创建成功.`);
					// vscode.workspace.openTextDocument(filePath).then(vscode.window.showTextDocument);
					const uri: any = { fsPath: filePath, scheme: 'file', path: filePath, _fsPath: filePath };
					openLowcodePage(uri, context, panelList);
				} catch (error) {
					vscode.window.showErrorMessage(`创建文件失败: ${error.message}`);
				}
			}
		}

	}));

	context.subscriptions.push(vscode.commands.registerCommand('extension.newVuecomponentFile', (uri) => {
		console.log(uri);
		if (uri) {
			const dirPath = uri.fsPath;
			vscode.window.showInformationMessage(`请先打开低代码设计器` + dirPath);
		}

	}));



	context.subscriptions.push(vscode.workspace.onDidSaveTextDocument((params) => {
		vscode.commands.executeCommand('extension.updateLowcodePage', params.uri);
	}));
	return '';
}

function openLowcodePage(uri: any, context: vscode.ExtensionContext, panelList: any[]): void {
	if (uri) {
		let dirPath = uri.fsPath;
		const stat = fs.lstatSync(dirPath);
		const fileId = uri._fsPath;// 路径作为文件的id
		const appPath = methods.getAppPath(uri);// 当前所在工程根目录中的排至文件app.json //改为从context获取
		const serverId = btoa(uri._fsPath);
		const serverFileIdPromise = hash('vscode-file://vscode-app', serverId);

		// 获取index.html

		serverFileIdPromise.then(id => {
			if (panelList[fileId]) {// 如果已经是打开的那么直接激活
				const columnToShowIn = vscode.window.activeTextEditor
					? vscode.window.activeTextEditor.viewColumn
					: undefined;
				panelList[fileId].reveal(columnToShowIn);
				return;
			}

			if (stat.isFile()) { dirPath = path.dirname(dirPath); }
			const fileName = path.basename(uri._fsPath);
			const pclintBar = vscode.window.createStatusBarItem();
			pclintBar.text = `目标文件夹：${dirPath}`;
			pclintBar.show();


			const panel = vscode.window.createWebviewPanel(
				uri._fsPath, // viewType
				fileName, //视图标题
				vscode.ViewColumn.One,
				{
					enableScripts: true, // 启用JS，默认禁用
					retainContextWhenHidden: true, // webview被隐藏时保持状态，避免被重置
				}
			);
			panel.onDidChangeViewState(() => {
				if (panel.visible) {
					pclintBar.show();
				} else {
					pclintBar.hide();
				}
			});
			// 获取index.html

			getWebViewContent(context, 'src/view/index.html').then((html) => {
				panel.webview.html = html;
				// 给index.html 发送编辑器iframe初始信息
				panel.webview.postMessage({
					cmd: 'setSrc',
					data: {
						// src: vscode.workspace.getConfiguration().get('openLowcodePage.src'), //src
						src: `vscode-webview://${id}` + pathname, //src
						// src: 'http://192.168.73.169:3000/', //src
						// db: JSON.parse(fs.readFileSync(DB_PATH).toString() || '{}'), // 数据资源
						db: fs.readFileSync(appPath).toString(),
						code: fs.readFileSync(uri._fsPath).toString(), // 打开的页面数据
						path: uri._fsPath // 文件路径
					}
				});
				panel.webview.onDidReceiveMessage(message => {
					if (message.cmd && message.data) {
						const method = methods[message.cmd];
						if (method) {
							// 如果是获取文件的话 那么需要返回到index.html
							if (message.cmd === 'getFile') {
								method(message, vscode, dirPath).then((data: any) => {
									panel.webview.postMessage({
										cmd: 'returnFile',
										data: {
											file: data,
										}
									});
								});
							} else {
								method(message, vscode, dirPath);
							}

						}
					} else {
						vscode.window.showInformationMessage(`没有与消息对应的方法`);
					}
				}, undefined, context.subscriptions);

			});

			panel.onDidDispose(() => {
				pclintBar.dispose();
				// 关闭的时候删除panel
				panelList[fileId] = undefined;
				delete panelList[fileId];
			});
			// 添加panelList
			panelList[fileId] = panel;
		});

	} else {
		vscode.window.showInformationMessage(`无法获取文件夹路径`);
	}
}


const methods: any = {
	writeFile: function (message: any, vscode: any) {
		// let { fileName, code } = message.data
		// let filePath = path.join(dirPath, fileName)
		const { path, code } = message.data;
		fs.writeFileSync(path, code);
		vscode.window.showInformationMessage(`文件${path}保存成功`);
	},
	getFile: async function (message: any, vscode: any, dirPath: string) {
		const pathStr = path.resolve(dirPath, message.data.path);
		let code = 'false';
		try {
			code = await fs.readFileSync(pathStr, 'utf-8');
		} catch (error) {
			vscode.window.showErrorMessage(`文件${pathStr}不存在`);
		}
		return code;
	},
	openUrl: function (message: any) {
		open(message.data.url);
	},
	setStorageItem: function (message: any) {
		const { key, val } = message.data;
		const str = fs.readFileSync(DB_PATH).toString();
		let json;
		if (str) {
			json = JSON.parse(str);
		}
		json[key] = val;
		fs.writeFileSync(DB_PATH, JSON.stringify(json));
	},
	// 获取app.json配置文件
	getAppPath: function (document: any) {
		if (!document) {
			document = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.document : null;
		}
		if (!document) {
			vscode.window.showInformationMessage('当前激活的编辑器不是文件或者没有文件被打开！');
			return '';
		}
		const currentFile = (document.uri ? document.uri : document).fsPath;
		let projectPath = '';
		const workspaceFolders = vscode.workspace.workspaceFolders?.map(item => item.uri?.fsPath);
		workspaceFolders?.forEach(folder => {
			if (currentFile.indexOf(folder) === 0) {
				projectPath = folder;
			}
		});
		if (!projectPath) {
			vscode.window.showInformationMessage('获取工程根路径异常！');
			return '';
		}
		// 获取app.json配置文件
		const files = fs.readdirSync(projectPath);
		const appData = files.filter(name => name === 'app.json').map(name => path.resolve(projectPath, name));
		if (!appData[0]) {
			vscode.window.showInformationMessage('工程中缺少app.json配置文件');
		}
		console.log('收到', appData[0]);
		return appData[0];
	},

};
