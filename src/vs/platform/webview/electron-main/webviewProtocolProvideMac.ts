/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { net, protocol } from 'electron';
import { Disposable } from 'vs/base/common/lifecycle';
import { AppResourcePath, COI, FileAccess, Schemas } from 'vs/base/common/network';
import { URI } from 'vs/base/common/uri';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';

//针对低代码，用于解决mac跨域事件问题
export class WebviewProtocolProviderMac extends Disposable {

	private static validWebviewFilePaths = new Map([
		['/fake.html', 'fake.html'],
		['/index-vscode.html', 'index-vscode.html'],
		['/service-worker.js', 'service-worker.js'],
	]);

	constructor(
		@IConfigurationService protected readonly _configurationService: IConfigurationService,
	) {
		super();
		const webviewHandler = this.handleWebviewRequest.bind(this);
		protocol.handle(Schemas.vscodeWebview, webviewHandler);
	}

	private handleWebviewRequest(
		request: GlobalRequest,
	) {
		try {
			const uri = URI.parse(request.url);

			const entry = WebviewProtocolProviderMac.validWebviewFilePaths.get(uri.path);
			const param = request.url.indexOf('?') > 0 ? '?' + request.url.split('?')[1] : '';
			if (typeof entry === 'string') {
				//如果是系统资源走文件逻辑
				const relativeResourcePath: AppResourcePath = `vs/workbench/contrib/webview/browser/pre/${entry}`;
				const url = FileAccess.asFileUri(relativeResourcePath);
				const response = net.fetch('vscode-file://' + url.fsPath, {
					headers: {
						...COI.getHeadersFromQuery(request.url),
						'Cross-Origin-Resource-Policy': 'cross-origin',
						'Access-Control-Allow-Origin': '*'
					}
				});
				return response;
			} else {
				//如果是外部资源，走模拟逻辑
				//如 https://lc.yinhaiyun.com/lcui-test/lowcode-ui/index.html
				//index.html 加载资源路径如下
				//<script type="module" crossorigin="" src="/lcui-test/lowcode-ui/assets/vendor.92ec9fbf.js"></script>
				//end

				//lowcode.url 取根目录
				const { origin } = new URL(this._configurationService.getValue('lowcode.url'));
				const { pathname } = new URL(request.url);
				const trueUrl = origin + pathname + param;
				console.log(trueUrl);
				const reqInit: RequestInit & { duplex: string } = {
					method: request.method,
					headers: request.headers,
					body: request.body,
					credentials: 'include',
					duplex: 'half',
				};
				const response = fetch(trueUrl, reqInit);
				return response;
			}

		} catch (e) {
			return new Response(`<h1>ta+3 lowcode error or other error</h1>${e}`, {
				headers: { 'content-type': 'text/html' }
			});
			// noop
		}
	}
}
