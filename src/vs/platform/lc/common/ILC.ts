/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';

export interface ICommonNativeLCService {
	// 添加这个，会使createInstance不报错
	readonly _serviceBrand: undefined;
	dissmissCodeWork(): void;
}

export const ICommonNativeLCService = createDecorator<ICommonNativeLCService>('lcService');
