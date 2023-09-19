/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { net, protocol } from 'electron';
import { Disposable } from 'vs/base/common/lifecycle';
import { AppResourcePath, COI, FileAccess, Schemas } from 'vs/base/common/network';
import { URI } from 'vs/base/common/uri';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';


export class WebviewProtocolProvider extends Disposable {

	private static validWebviewFilePaths = new Map([
		['/index.html', 'index.html'],
		['/fake.html', 'fake.html'],
		// ['/local', 'local'],
		['/login.html', 'login.html'],
		['/index-vscode.html', 'index-vscode.html'],
		['/frame.html', 'frame.html'],
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
			const { pathname } = new URL(request.url);
			const entry = WebviewProtocolProvider.validWebviewFilePaths.get(uri.path);
			const param = request.url.indexOf('?') > 0 ? '?' + request.url.split('?')[1] : '';
			if (typeof entry === 'string') {
				//TODO 这块逻辑得改为判断html和资源
				if (entry === 'login.html' || entry === 'index.html') {

					const reqInit: RequestInit & { duplex: string } = {
						method: request.method,
						headers: request.headers,
						body: request.body,
						credentials: 'include',
						duplex: 'half',
					};

					return fetch(this._configurationService.getValue<String>('ta3.lowcode.url') + pathname + param, reqInit);
					// return fetch('http://localhost:3000' + pathname + param, reqInit);
				} else {
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
				}
			} else {
				const { origin } = new URL(this._configurationService.getValue('ta3.lowcode.url'));

				const trueUrl = origin + pathname + param;
				// const trueUrl = 'http://localhost:3000' + pathname + param;

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
			return new Response(`<h1>ta+3 lowcode error</h1>${e}`, {
				headers: { 'content-type': 'text/html' }
			});
			// noop
		}
		//return callback({ error: -2 /* FAILED - https://cs.chromium.org/chromium/src/net/base/net_error_list.h?l=32 */ });
	}
}
