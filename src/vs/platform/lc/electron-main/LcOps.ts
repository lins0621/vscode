/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { IWindowState } from 'vs/platform/window/electron-main/window';


export interface LcOps extends IWindowState {

	workspace?: string;

	gitUrl?: string;

	localPath?: string;

}
