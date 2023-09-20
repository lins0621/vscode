/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { net, protocol } from 'electron';
import { Disposable } from 'vs/base/common/lifecycle';
import { AppResourcePath, COI, FileAccess, Schemas } from 'vs/base/common/network';
import { URI } from 'vs/base/common/uri';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { ILCService } from 'vs/platform/lc/electron-main/LCService';
interface CookiesSetDetails {
	url: string;
	name?: string;
	value?: string;
	domain?: string;
	path?: string;
	secure?: boolean;
	httpOnly?: boolean;
	expirationDate?: number;
	sameSite?: ('unspecified' | 'no_restriction' | 'lax' | 'strict');
}

//针对低代码，用于解决mac跨域事件问题
export class WebviewProtocolProviderMac extends Disposable {

	//我相信一个页面里面不会有两个path，写成成员变量
	private path: string = '/';

	private static validWebviewFilePaths = new Map([
		['/fake.html', 'fake.html'],
		['/index-vscode.html', 'index-vscode.html'],
		['/service-worker.js', 'service-worker.js'],
	]);

	constructor(
		@IConfigurationService protected readonly _configurationService: IConfigurationService,
		@ILCService private readonly lcService: ILCService,
	) {
		super();

		const webviewHandler = this.handleWebviewRequest.bind(this);
		protocol.handle(Schemas.vscodeWebview, webviewHandler);
	}



	private parseCookie(cookieString: string): CookiesSetDetails {
		const cookiePairs = cookieString.split(';');
		const result: CookiesSetDetails = { url: '' };
		for (let pair of cookiePairs) {
			pair = pair.trim();
			const [key, value] = pair.split('=').map(part => part.trim());
			if (key === 'path') {
				result[key] = value;
			} else if (key === 'JSESSIONID') {
				result.value = pair;
			}
		}
		return result;
	}

	private async handleWebviewRequest(
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

				const ses = this.lcService.getWebContents().session;

				const session = (await ses.cookies.get({ path: this.path }));
				request.headers.append('Cookie', session[0]?.value);
				const reqInit: RequestInit & { duplex: string } = {
					method: request.method,
					headers: request.headers,
					body: request.body,
					credentials: 'same-origin',
					duplex: 'half',

				};
				const response = await fetch(trueUrl, reqInit);
				if (response.headers.getSetCookie()[0]) {
					const parseCookie = this.parseCookie(response.headers.getSetCookie()[0]);
					ses.cookies.set(parseCookie);
				}
				return response;
			}

		} catch (e) {
			return new Response(`<h1>ta+3 lowcode error or other error</h1>${e}`, {
				headers: { 'content-type': 'text/html' }
			});
			// noop
		}
	}

	override dispose(): void {
		super.dispose();
		// 先不用清理
		// this.lcService.getWebContents().session.cookies.get({ path: this.path }).then(cookies => {
		// 	cookies = [];
		// });
	}
}
