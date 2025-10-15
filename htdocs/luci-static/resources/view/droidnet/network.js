/* This is free software, licensed under the Apache License, Version 2.0
 *
 * Copyright (C) 2024 Hilman Maulana <hilman0.0maulana@gmail.com>, Anas Fanani <anas@anasfanani.com>
 */
'use strict';
'require view';
'require uci';
'require fs';
'require ui';
'require form'
'require droidnet';

function closeUi(type) {
	if (type === 'OK') {
		return E('button', {
			'class': 'btn',
			'click': function () {
				return window.location.reload();
			}
		}, _('OK'));
	} else {
		return E('button', {
			'class': 'btn cbi-button cbi-button-remove',
			'style': 'margin-right: 10px',
			'click': ui.hideModal
		}, _('Cancel'));
	};
};
function writeLog(message) {
	var logFile = '/var/log/droidnet.log';
	fs.read(logFile).then(function (result) {
		var service = _('Network service');
		var date = new Date().toLocaleDateString(undefined, {
			weekday: 'short',
			month: 'short',
			day: '2-digit'
		});
		var time = new Date().toLocaleTimeString(undefined, {
			hour: '2-digit',
			minute: '2-digit'
		});
		var notif = `${date}, ${time} - ${service}: ${message}`;
		var newData = result.trim() + '\n' + notif;
		return fs.write(logFile, newData);
	});
};
function renderTableCell(data, id) {
	if (id === 'sim-1') {
		var tab = 1;
		var sim = 0;
		var display = 'table';
		var imei = data.imei_sim01;
	} else {
		var tab = 2;
		var sim = 1;
		var display = 'none';
		var imei = data.imei_sim02;
	};
	return E('table', { 'class': 'table cbi-section-table', 'id': `sim-${tab}`, 'style': `display: ${display}` }, [
		E('tr', { 'class': 'tr table-titles', 'style': 'display: none;' }),
		E('tr', { 'class': 'tr cbi-rowstyle-1' }, [
			E('td', { 'class': 'td left', 'width': '50%' }, _('Operator name')),
			E('td', { 'class': 'td left', 'width': '50%' }, data.operator[sim] || '-')
		]),
		E('tr', { 'class': 'tr cbi-rowstyle-2' }, [
			E('td', { 'class': 'td left', 'width': '50%' }, _('Network type')),
			E('td', { 'class': 'td left', 'width': '50%' }, data.signal[sim] || '-')
		]),
		E('tr', { 'class': 'tr cbi-rowstyle-1' }, [
			E('td', { 'class': 'td left', 'width': '50%' }, _('Roaming mode')),
			E('td', { 'class': 'td left', 'width': '50%' }, data.roaming[sim] === 'true' ? _('On') :
				_('Off')
			)
		]),
		E('tr', { 'class': 'tr cbi-rowstyle-2' }, [
			E('td', { 'class': 'td left', 'width': '50%' }, _('MCC')),
			E('td', { 'class': 'td left', 'width': '50%' }, data.mcc[sim] || '-')
		]),
		E('tr', { 'class': 'tr cbi-rowstyle-1' }, [
			E('td', { 'class': 'td left', 'width': '50%' }, _('IMEI')),
			E('td', { 'class': 'td left', 'width': '50%' }, imei || '-')
		]),
		E('tr', { 'class': 'tr cbi-rowstyle-2' }, [
			E('td', { 'class': 'td left', 'width': '50%' }, _('Driver')),
			E('td', { 'class': 'td left', 'width': '50%' }, data.driver || '-')
		])
	]);
};
function renderTableWiFi(device) {
	fs.exec('adb', ['-s', device, 'shell', 'dumpsys', 'wifi', '|', 'grep', 'mWifiInfo SSID']).then(function (result) {
		var table, wifiInfo = {};
		var stderr = result.stderr;
		var stdout = result.stdout;
		var properties = {
			'mWifiInfo SSID': 'ssid',
			'BSSID': 'bssid',
			'MAC': 'mac',
			'RSSI': 'rssi',
			'Link speed': 'speed',
			'Frequency': 'frequency'
		};
		if (stderr) {
			table = E('p', stderr);
		} else {
			var lines = stdout.trim().split('\n')[0];
			var parts = lines.split(', ');
			parts.forEach(function (part) {
				var keyValue = part.split(': ');
				var key = keyValue[0].trim();
				var value = keyValue[1].replace(/"/g, '');
				if (properties[key]) {
					if (key === 'Frequency' || key === 'Link speed') {
						value = value.replace(/(\d+)([A-Za-z]+)/g, '$1 $2');
					};
					if (key === 'RSSI') {
						value += ' dBm';
					};
					wifiInfo[properties[key]] = value;
				};
			});
		};
		table = [
			E('h3', { 'class': 'section-title' }, _('Wireless Information')),
			E('table', { 'class': 'table cbi-section-table' }, [
				E('tr', { 'class': 'tr table-titles', 'style': 'display: none;' }),
				E('tr', { 'class': 'tr cbi-rowstyle-1' }, [
					E('td', { 'class': 'td left', 'width': '50%' }, _('SSID')),
					E('td', { 'class': 'td left', 'width': '50%' }, wifiInfo.ssid)
				]),
				E('tr', { 'class': 'tr cbi-rowstyle-2' }, [
					E('td', { 'class': 'td left', 'width': '50%' }, _('BSSID')),
					E('td', { 'class': 'td left', 'width': '50%' }, wifiInfo.bssid)
				]),
				E('tr', { 'class': 'tr cbi-rowstyle-1' }, [
					E('td', { 'class': 'td left', 'width': '50%' }, _('MAC address')),
					E('td', { 'class': 'td left', 'width': '50%' }, wifiInfo.mac)
				]),
				E('tr', { 'class': 'tr cbi-rowstyle-2' }, [
					E('td', { 'class': 'td left', 'width': '50%' }, _('RSSI')),
					E('td', { 'class': 'td left', 'width': '50%' }, wifiInfo.rssi)
				]),
				E('tr', { 'class': 'tr cbi-rowstyle-1' }, [
					E('td', { 'class': 'td left', 'width': '50%' }, _('Link speed')),
					E('td', { 'class': 'td left', 'width': '50%' }, wifiInfo.speed)
				]),
				E('tr', { 'class': 'tr cbi-rowstyle-2' }, [
					E('td', { 'class': 'td left', 'width': '50%' }, _('Frequency')),
					E('td', { 'class': 'td left', 'width': '50%' }, wifiInfo.frequency)
				])
			])
		];
		return document.getElementById('wirelessMenu').append(...table);
	}).catch(function (error) {
		var message = E('p', error);
		return document.getElementById('wirelessMenu').append(...message);
	});
};
// var base = L.require('view/droidnet/base')

return view.extend({
	handleSaveApply: null,
	handleSave: null,
	handleReset: null,
	load: async function () {
		if (! await droidnet.getDeviceId()) return { deviceNotSet: true };
		const networkProperties = {
			'gsm.operator.alpha': 'operator',
			'gsm.network.type': 'signal',
			'gsm.version.ril-impl': 'driver',
			'gsm.version.baseband': 'baseband',
			'gsm.operator.isroaming': 'roaming',
			'gsm.sim.operator.numeric': 'mcc'
		};

		const networkInfoPromise = droidnet.exec(['getprop'], (stdout) => {
			const networkInfo = {};
			const lines = stdout.split('\n');
			for (const line of lines) {
				for (const property in networkProperties) {
					if (line.includes('[' + property + ']')) {
						const value = line.split(']: [')[1].slice(0, -1).trim();
						networkInfo[networkProperties[property]] = value.includes(',')
							? value.split(',').map(item => item.trim())
							: [value, ''];
						break;
					}
				}
			}
			for (const property in networkProperties) {
				if (!networkInfo.hasOwnProperty(networkProperties[property])) {
					networkInfo[networkProperties[property]] = false;
				}
			}
			return networkInfo;
		});

		const imeiInfoPromise = droidnet.exec(['service', 'call', 'iphonesubinfo', '1', 's16', 'com.android.shell'], (stdout) => {
			const matches = stdout.match(/'([^']+)'/g);
			const value = matches.map(match => match.slice(1, -1)).join('').replace(/[.\s]/g, '');
			return { imei_sim01: value };
		});

		const ipInfoPromise = droidnet.exec(['ip', 'route', 'get', '8.8.8.8'], (stdout) => {
			const parts = stdout.trim().split(/\s+/);
			const ipInfo = {};
			for (let i = 1; i < parts.length; i += 2) {
				ipInfo[parts[i]] = parts[i + 1];
			}
			return ipInfo;
		});

		const wifiInfoPromise = droidnet.exec(['dumpsys', 'wifi', '|', 'grep', 'Wi-Fi is'], (stdout) => {
			return { wifi: stdout.trim() === 'Wi-Fi is enabled' };
		});

		const dataInfoPromise = droidnet.exec(['dumpsys', 'telephony.registry', '|', 'grep', 'mDataConnectionState='], (stdout) => {
			return { data: stdout.includes('mDataConnectionState=2') };
		});

		const airplaneInfoPromise = droidnet.exec(['settings', 'get', 'global', 'airplane_mode_on'], (stdout) => {
			return { airplane: stdout.trim() === '1' };
		});

		const apnInfo = await droidnet.suexec(['content query --uri content://telephony/carriers/preferapn']);
		const parseApnToObject = str =>
			Object.fromEntries(
				str.replace(/^Row: \d+\s*/, '')
					.split(', ')
					.map(pair => {
						const [key, ...rest] = pair.split('=');
						const value = rest.length ? rest.join('=').trim() : '';
						return [key.trim(), value];
					})
			);
		let apnObject = { apn: null }
		if(!apnInfo.error){
			apnObject = { apn: parseApnToObject(apnInfo.stdout) }
		}

		const results = await Promise.all([
			networkInfoPromise,
			imeiInfoPromise,
			ipInfoPromise,
			wifiInfoPromise,
			dataInfoPromise,
			airplaneInfoPromise
		]);

		const [networkInfo, imeiInfo, ipInfo, wifiInfo, dataInfo, airplaneInfo] = results;

		if (networkInfo && imeiInfo && ipInfo && wifiInfo && dataInfo && airplaneInfo) {
			return Object.assign(networkInfo, imeiInfo, ipInfo, wifiInfo, dataInfo, airplaneInfo, apnObject);
		} else {
			throw new Error(_('Failed to get complete device information.'));
		}
	},
	render: async function (data) {
		if (data.deviceNotSet) {
			return droidnet.selectDeviceForm();
		}
		if (data.network_section) {
			ui.addNotification(_('Error: Device conflict!'),
				E('p', _('Please check your settings, the configured device and ADB devices are conflicting.')), 'danger'
			);

			return E('div', { 'class': 'cbi-map' }, [
				E(droidnet.header),
				E('div', { 'class': 'cbi-section' }, [
					E('div', { 'class': 'cbi-value', 'style': 'text-align: center; display: block;' }, [
						E('em', _('No device detected or connected.'))
					])
				])
			]);
		} else {
			var createNetworkRow = function (label, value, rowStyle) {
				return E('tr', { 'class': 'tr ' + rowStyle }, [
					E('td', { 'class': 'td left', 'width': '50%' }, _(label)),
					E('td', { 'class': 'td left' }, value || '-'),
					E('td', { 'class': 'td' })
				]);
			};

			var createToggleRow = function (label, state, onEnable, onDisable, rowStyle) {
				return E('tr', { 'class': 'tr ' + rowStyle, 'style': 'display: table-row;' }, [
					E('td', { 'class': 'td left', 'width': '50%' }, _(label)),
					E('td', { 'class': 'td left', 'width': '25%' }, state ? _('On') : _('Off')),
					E('td', { 'class': 'td center', 'width': '25%', 'style': 'padding: 0px;' }, [
						state ? E('button', {
							'class': 'btn cbi-button cbi-button-remove',
							'style': 'padding-block: 5px;',
							'click': onDisable
						}, _('Disable')) :
							E('button', {
								'class': 'btn cbi-button cbi-button-action',
								'style': 'padding-block: 5px;',
								'click': onEnable
							}, _('Enable'))
					])
				]);
			};

			var confirmAction = function (title, message, yesCallback) {
				ui.showModal(_(title), [
					E('p', _(message)),
					E('div', { 'class': 'right' }, [
						E(closeUi('Cancel')),
						E('button', {
							'class': 'btn cbi-button cbi-button-action',
							'click': yesCallback
						}, _('Yes'))
					])
				]);
			};

			function zrenderTable(rows = [], config = {col: 2}) {
				rows = rows.filter(item => item !== null && item !== undefined && item !== '');
				const styles = ['cbi-rowstyle-1', 'cbi-rowstyle-2'];
				const tableHeader = E('tr', { 'class': 'tr table-titles', 'style': 'display: none;' });

				const trKeysCount = new Set(rows.flatMap(Object.keys)).size;
				const widthSizes = {
					1: [50, 50],
					2: [50, 50],
					3: [50, 25, 25],
					4: [25, 25, 25, 25]
				}[trKeysCount] || [];


				const tableRows = rows.map((row, index) => {
					const rowStyle = styles[index % 2];
					let actionButtons = [];
					if (row.action) {
						actionButtons=[
							row.value ? E('button', {
								'class': 'btn cbi-button cbi-button-remove',
								'style': 'padding-block: 5px;',
								'click': row.action.onEnable
							}, _('Disable')) :
								E('button', {
									'class': 'btn cbi-button cbi-button-action',
									'style': 'padding-block: 5px;',
									'click': row.action.onDisable
								}, _('Enable'))
						];
					}
					const cells = widthSizes.map((width, index) => {
						const percentage = `${width}%`;
						if (index === 0) {
							return E('td', { 'class': 'td left', 'width': percentage }, _(row.label));
						} else if (index === 1) {
							return E('td', { 'class': 'td left', 'width': percentage }, _(row.value));
						} else if (index === 2) {
							return E('td', { 'class': 'td left', 'width': percentage, 'style': 'padding: 0px;'}, actionButtons);
						} else {
							return E('td', { 'class': 'td left', 'width': percentage }, actionButtons);
						}
					});
					return E('tr', { 'class': 'tr ' + rowStyle }, cells);
				});
				return E('table', { 'class': 'table cbi-section-table' }, [tableHeader, ...tableRows]);
			}
			function renderTable(rows = [], config = {}) {
				const defaultConfig = {
					col: 2,
					colSizeMap: {
						2: [50, 50],
						4: [25, 25, 25, 25],
						6: [16.6, 16.6, 16.6, 16.6],
					}
				};
				config = { ...defaultConfig, ...config };
				rows = rows.filter(item => item !== null && item !== undefined && item !== '');
				const styles = ['cbi-rowstyle-1', 'cbi-rowstyle-2'];
				const columnsPerRow = config.col;
				const itemsPerRow = Math.floor(columnsPerRow / 2); // 1 item = label + value/action (2 cells)
				const colSizes = config.colSizeMap[columnsPerRow] || [];

				// Group items into rows
				const chunkedRows = [];
				for (let i = 0; i < rows.length; i += itemsPerRow) {
					chunkedRows.push(rows.slice(i, i + itemsPerRow));
				}

				const tableHeader = E('tr', {
					'class': 'tr table-titles',
					'style': 'display: none;'
				});

				const tableRows = chunkedRows.map((rowGroup, rowIndex) => {
					const rowStyle = styles[rowIndex % 2];

					const cells = rowGroup.flatMap((row, idx) => {
						let actionButtons = [];

						if (row.action) {
							actionButtons = [
							row.value
								? E('button', {
								'class': 'btn cbi-button cbi-button-remove',
								'style': 'display: block; margin: 0 auto; padding: 2px 8px; font-size: 12px; line-height: 1.2;',
								'click': row.action.onEnable
								}, _('Disable'))
								: E('button', {
								'class': 'btn cbi-button cbi-button-action',
								'style': 'display: block; margin: 0 auto; padding: 2px 8px; font-size: 12px; line-height: 1.2;',
								'click': row.action.onDisable
								}, _('Enable'))
							];
						}

						const labelIndex = idx * 2;
						const valueIndex = labelIndex + 1;

						const getWidth = (sizes, index) => sizes[index] !== undefined ? `${sizes[index]}%` : 'auto';
						const labelTd = E('td', {
							class: 'td left',
							style: `width: ${getWidth(colSizes, labelIndex)}`
						}, E('b',{},_(row.label)));

						const valueTd = E('td', {
							class: 'td left',
							style: `width: ${getWidth(colSizes, valueIndex)};`
							
						}, row.action ? actionButtons : _(row.value));

						return [labelTd, valueTd];
					});

					return E('tr', { class: 'tr ' + rowStyle }, cells);
				});

				return E('table', { class: 'table cbi-section-table' }, [tableHeader, ...tableRows]);
			}

			function renderTitle(title) {
				return E('h3', { 'class': 'section-title' }, _(title));
			}
			function modalError(message,errorMessage){
				ui.showModal(_('An error occurred'), [
					E('p', _(message)),
					errorMessage?E('em', { 'style': 'color: red;' }, errorMessage):'',
					E('div', { 'class': 'right' }, [E(closeUi('OK'))])
				]);
			}
			function modalSuccess(message,successMessage){
				ui.showModal(_('Success'), [
					E('p', _(message)),
					successMessage ? E('em', { 'style': 'color: green;' }, successMessage) : '',
					E('div', { 'class': 'right' }, [E(closeUi('OK'))])
				]);
			}
			function modalLoading(message){
				ui.showModal(_('Loading...'), [
					E('p', { 'class': 'spinning' }, _(message))
				]);
			}
			const networkMenu = [
				renderTitle('Mobile Network'),
				renderTable([
					{ label: 'IP address', value: data.src },
					{ label: 'Gateway', value: data.via },
					{ label: 'Device', value: data.dev },
					{ label: 'Routing table', value: data.table },
					{
						label: 'Wireless', value: data.wifi, action: {
							onDisable: async function () {
								confirmAction('Wireless network', 'Are you sure you want to switch on the wireless connection?', async function () {
									modalLoading('Waiting for the wireless connection to be turned on…');
									const execute = await droidnet.exec(['svc wifi enable']);

									if (!execute.error) {
										const message = 'Wireless connection has been successfully switched on.';
										modalSuccess(message);
										writeLog(_(message));
									} else {
										const errorMessage = execute.error || 'An unknown error occurred.';
										modalError('Failed to switch on the wireless connection.', errorMessage);
										writeLog(_('Failed to switch on wireless connection: ' + errorMessage));
									}
								});
							},

							onEnable: async function () {
								confirmAction('Wireless network', 'Are you sure you want to switch off the wireless connection?', async function () {
									modalLoading('Waiting for the wireless connection to be turned off…');
									const execute = await droidnet.exec(['svc wifi disable']);
									if (!execute.error) {
										const message = 'The wireless connection has been successfully turned off.';
										modalSuccess(message);
										writeLog(_(message));
									} else {
										const errorMessage = execute.error || 'An unknown error occurred.';
										modalError('Failed to turn off the wireless connection.', errorMessage);
										writeLog(_('Failed to switch off wireless connection: ' + errorMessage));
									}
								});
							}

						}
					},
					{
						label: 'Mobile data', value: data.data, action: {
							onDisable: async function () {
								confirmAction('Mobile network', 'Are you sure you want to switch on mobile data?', async function () {
									if (data.airplane === true) {
										const errorMessage = 'Failed to switch on mobile data because airplane mode is active.';
										modalError(errorMessage);
										writeLog(_(errorMessage));
									} else {
										modalLoading('Waiting for mobile data to be turned on…');
										const execute = await droidnet.exec(['svc data enable']);
										if (!execute.error) {
											const message = 'Mobile data has been successfully switched on.';
											modalSuccess(message);
											writeLog(_(message));
										} else {
											const errorMessage = execute.error || 'An unknown error occurred.';
											modalError('Failed to switch on mobile data.', errorMessage);
											writeLog(_('Failed to switch on mobile data: ' + errorMessage));
										}
									}
								});
							},

							onEnable: async function () {
								confirmAction('Mobile network', 'Are you sure you want to switch off mobile data?', async function () {
									modalLoading('Waiting for mobile data to be turned off…');
									const execute = await droidnet.exec(['svc data disable']);
									if (!execute.error) {
										const message = 'Mobile data has been successfully switched off.';
										modalSuccess(message);
										writeLog(_(message));
									} else {
										const errorMessage = execute.error || _('An unknown error occurred.');
										modalError('Failed to switch off mobile data.', errorMessage);
										writeLog(_('Failed to switch off mobile data: ' + errorMessage));
									}
								});
							}
						}
					},
					{
						label: 'Airplane mode', value: data.airplane, action: {
							onDisable: async function () {
								confirmAction('Airplane mode', 'Are you sure want to switched on airplane mode?', async function () {
									modalLoading('Waiting for the airplane mode to be turned on…');
									const execute = await droidnet.exec(['cmd connectivity airplane-mode enable']);

									if (!execute.error) {
										const message = 'Airplane mode has been successfully switched on.';
										modalSuccess(message);
										writeLog(_(message));
									} else {
										const errorMessage = execute.error || 'An unknown error occurred.';
										modalError('Failed to switch on the airplane mode.', errorMessage);
										writeLog(_('Failed to switch on airplane mode: ' + errorMessage));
									}
								});
							},
							onEnable: async function () {
								confirmAction('Airplane mode', 'Are you sure want to switched off airplane mode?', async function () {
									modalLoading('Waiting for the airplane mode to be turned off…');
									const execute = await droidnet.exec(['cmd connectivity airplane-mode disable']);
									if (!execute.error) {
										const message = 'The airplane mode has been successfully turned off.';
										modalSuccess(message);
										writeLog(_(message));
									} else {
										const errorMessage = execute.error || 'An unknown error occurred.';
										modalError('Failed to turn off the airplane mode.', errorMessage);
										writeLog(_('Failed to switch off airplane mode: ' + errorMessage));
									}
								});
							}
						}
					}
				]),
			];
			const parseWirelessInfo = function(stdout) {
				const properties = {
					'mWifiInfo SSID': 'ssid',
					'BSSID': 'bssid',
					'MAC': 'mac',
					'RSSI': 'rssi',
					'Link speed': 'speed',
					'Frequency': 'frequency',
					'Wi-Fi standard': 'type'
				};

				const wifiInfo = {};
				const lines = stdout.trim().split('\n')[0].split(', ');

				lines.forEach(part => {
					const [key, value] = part.split(': ').map(item => item.trim().replace(/"/g, ''));
					if (properties[key]) {
						let formattedValue = value;
						if (key === 'Frequency' || key === 'Link speed') {
							formattedValue = value.replace(/(\d+)([A-Za-z]+)/, '$1 $2');
						}
						if (key === 'RSSI') {
							formattedValue += ' dBm';
						}
						wifiInfo[properties[key]] = formattedValue;
					}
				});

				return wifiInfo;
			}
			const getWirelessInfo = await droidnet.exec(['dumpsys wifi | grep "mWifiInfo SSID"'])
			let wifiInfo;
			if(!getWirelessInfo.error){
				wifiInfo = parseWirelessInfo(getWirelessInfo.stdout);
			}
			
			const wirelesMenu = data.wifi === true ? [
				renderTitle('Wireless Information'),
				renderTable([
					{ label: 'SSID', value: wifiInfo.ssid },
					{ label: 'BSSID', value: wifiInfo.bssid },
					{ label: 'MAC address', value: wifiInfo.mac },
					{ label: 'RSSI', value: wifiInfo.rssi },
					{ label: 'Link speed', value: wifiInfo.speed },
					{ label: 'Frequency', value: wifiInfo.frequency },
					wifiInfo.type ? { label: 'Type', value: wifiInfo.type } : null,
				])
			] : '';
			function renderTab(tabs = []) {
				tabs = tabs.filter(item => item !== null && item !== undefined && item !== '');
				const tabMenu = E('ul', { 'class': 'cbi-tabmenu' }, tabs.map((tab, index) => {
					const tabId = `tab-${index + 1}-${tab.tabId}`;
					const isActive = index === 0; // Set the first tab as active by default

					return E('li', { 'class': isActive ? 'cbi-tab' : 'cbi-tab-disabled', 'id': tabId }, [
						E('a', {
							'href': `#${tab.tabId}`,
							'click': function () {
								// Set the active tab
								tabs.forEach((_, i) => {
									document.getElementById(`tab-${i + 1}-${tabs[i].tabId}`).className = i === index ? 'cbi-tab' : 'cbi-tab-disabled';
									document.getElementById(tabs[i].tabId).style.display = i === index ? 'contents' : 'none';
								});
							}
						}, _(tab.tabTitle))
					]);
				}));

				const contentSections = tabs.map((tab, index) => {
					return E('div', { 'id': tab.tabId, 'style': index === 0 ? 'display: contents;' : 'display: none;' }, [
						E(tab.tabContent)
					]);
				});

				return E('div', {}, [tabMenu, ...contentSections]);
			}
			const cellularMenu = [
				renderTitle('Cellular Information'),
				renderTab([
					(data.operator && data.operator[0] && {
						tabId: 'sim1',
						tabTitle: 'SIM 1',
						tabContent: renderTable([
							{ label: 'Operator name', value: data.operator[0] || '-' },
							{ label: 'Network type', value: data.signal[0] || '-' },
							{ label: 'Roaming mode', value: data.roaming[0] || '-' },
							{ label: 'MCC', value: data.mcc[0] || '-' },
							{ label: 'IMEI', value: data.imei_sim01 || '-' },
							{ label: 'Driver', value: data.driver || '-' },
							{ label: 'Baseband', value: data.baseband || '-' },
						])
					}) || null,
					(data.operator && data.operator[1] && {
						tabId: 'sim2',
						tabTitle: 'SIM 2',
						tabContent: renderTable([
							{ label: 'Operator name', value: data.operator[1] || '-' },
							{ label: 'Network type', value: data.signal[1] || '-' },
							{ label: 'Roaming mode', value: data.roaming[1] || '-' },
							{ label: 'MCC', value: data.mcc[1] || '-' },
							{ label: 'IMEI', value: data.imei_sim01 || '-' },
							{ label: 'Driver', value: data.driver || '-' },
							{ label: 'Baseband', value: data.baseband || '-' },
						])
					}) || null,
				])];
			const apn = data.apn;
			const apnMenu = [
				renderTitle('APN Information'),
				renderTable([
					{ label: 'Name', value: apn.name },
					{ label: 'APN', value: apn.apn },
					{ label: 'Proxy', value: apn.proxy },
					{ label: 'Port', value: apn.port },
					{ label: 'Username', value: apn.user },
					{ label: 'Password', value: apn.password },
					{ label: 'Server', value: apn.server },
					{ label: 'MMSC', value: apn.mmsc },
					{ label: 'MMS proxy', value: apn.mmsproxy },
					{ label: 'MMS port', value: apn.mmsport },
					{ label: 'MCC', value: apn.mcc },
					{ label: 'MNC', value: apn.mnc },
					{ label: 'Authentication type', value: apn.authtype },
					{ label: 'APN type', value: apn.type },
					{ label: 'APN protocol', value: apn.protocol },
					{ label: 'APN roaming protocol', value: apn.roaming_protocol },
					{ label: 'Bearer', value: apn.bearer },
					{ label: 'MVNO type', value: apn.mvno_type },
					{ label: 'MVNO value', value: apn.mvno_match_data },
				],{ col:4 })
			];
			
			return E('div', { 'class': 'cbi-map' }, [
				E(droidnet.header),
				E('div', { 'class': 'cbi-section' }, networkMenu),
				E('div', { 'class': 'cbi-section' }, wirelesMenu),
				E('div', { 'class': 'cbi-section' }, cellularMenu),
				E('div', { 'class': 'cbi-section' }, apnMenu),
			]);
		};
	}

});

