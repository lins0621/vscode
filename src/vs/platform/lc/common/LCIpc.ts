/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from 'vs/base/common/event';
import { IChannel, IServerChannel } from 'vs/base/parts/ipc/common/ipc';
import { ICommonNativeLCService } from 'vs/platform/lc/common/ILC';

export class LCChannel implements IServerChannel {

	constructor(private service: ICommonNativeLCService) { }

	listen(_: unknown, event: string): Event<any> {


		throw new Error(`Event not found: ${event}`);
	}

	call(_: unknown, command: string, arg?: any): Promise<any> {
		switch (command) {
			case 'dissmissCodeWork':
				this.service.dissmissCodeWork();
				return Promise.resolve();
			case 'showCodeWork':
				this.service.showCodeWork();
				return Promise.resolve();
		}

		throw new Error(`Call not found: ${command}`);
	}
}

export class CommonNativeLCClient implements ICommonNativeLCService {

	declare readonly _serviceBrand: undefined;


	constructor(private readonly channel: IChannel) {
	}

	dissmissCodeWork(): void {
		this.channel.call('dissmissCodeWork');
	}

	showCodeWork(): void {
		this.channel.call('showCodeWork');
	}
}
