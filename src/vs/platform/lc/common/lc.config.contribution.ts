/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { Extensions as ConfigurationExtensions, ConfigurationScope, IConfigurationRegistry } from 'vs/platform/configuration/common/configurationRegistry';
import { Registry } from 'vs/platform/registry/common/platform';

const configurationRegistry = Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration);


configurationRegistry.registerConfiguration({
	id: 'lowcode',
	order: 1,
	type: 'object',
	title: localize('lowcode', "低代码配置"),
	properties: {
		'lowcode.url': {
			type: 'string',
			scope: ConfigurationScope.APPLICATION,
			description: localize('lowcodeurl', "配置低代码设计器地址，默认为https://lc.yinhaiyun.com/lcui-test/lowcode-ui/index.html"),
			default: 'https://lc.yinhaiyun.com/lcui-test/lowcode-ui',
		}
	}
});
