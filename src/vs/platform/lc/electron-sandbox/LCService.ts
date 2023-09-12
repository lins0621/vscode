/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { registerMainProcessRemoteService } from 'vs/platform/ipc/electron-sandbox/services';
import { ICommonNativeLCService } from 'vs/platform/lc/common/ILC';
import { CommonNativeLCClient } from 'vs/platform/lc/common/LCIpc';

registerMainProcessRemoteService(ICommonNativeLCService, 'lc', { channelClientCtor: CommonNativeLCClient });
