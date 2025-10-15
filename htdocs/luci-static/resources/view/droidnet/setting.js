/* This is free software, licensed under the Apache License, Version 2.0
 *
 * Copyright (C) 2024 Hilman Maulana <hilman0.0maulana@gmail.com>
 */

'use strict';
'require view';
'require form';
'require uci';
'require fs';
'require tools.widgets as widgets';

return view.extend({
	load: function() {
		return uci.load('droidnet').then(function() {
			return Promise.all([
				fs.exec('adb', ['devices', '-l']).then(function(result) {
					var devices = {};
					var stdout = result.stdout;
					var stderr = result.stderr;
					if (stderr || stdout === 'List of devices attached \n\n') {
						devices = false;
					} else {
						var lines = stdout.trim().split('\n');
						lines.shift();
						lines.forEach(function(line) {
							var model = '';
							var parts = line.split(/\s+/);
							var device = parts[0].trim();
							parts.forEach(function(part) {
								if (part.startsWith('model:')) {
									model = part.substring(6);
								};
							});
							devices[device] = model;
						});
					};
					return {devices};
				}).catch(function(error) {
					throw new Error(error);
				}),
				fs.list('/etc/init.d').then(function(result) {
					var tunnelService = {};
					var fileNames = {
						'neko': 'Neko',
						'openclash': 'OpenClash',
						'passwall': 'PassWall',
						'v2ray': 'V2Ray'
					};
					result.forEach(function(file) {
						if (fileNames[file.name]) {
							tunnelService[file.name] = fileNames[file.name];
						};
					});
					if (Object.keys(tunnelService).length === 0) {
						tunnelService = false;
					}
					return {tunnelService};
				}).catch(function(error) {
					throw new Error(error);
				}),
				fs.exec('pgrep', ['-f', '/usr/share/droidnet/monitoring']).then(function(result) {
					var status = {};
					if (result && result.code === 1) {
						status = false;
					} else {
						status = true;
					};
					return {status};
				}).catch(function(error) {
					throw new Error(error);
				})
			]).then(function(results) {
				var devices = results[0];
				var tunnelService = results[1];
				var status = results[2];
				return Object.assign(devices, tunnelService, status)
			}).catch(function(error) {
				throw new Error(error);
			});
		});
	},
	render: function(data) {
		var m, s, o;
		m = new form.Map('droidnet', _('DroidNet'),
			_('Manage Android modem and optimize network settings.'));

		s = m.section(form.NamedSection, 'device', 'droidnet', _('Base Setting'));
		if (data.devices == false) {
			o = s.option(form.DummyValue, 'dummy', _('Device'));
			o.default = _('No device detected.');
		} else {
			o = s.option(form.ListValue, 'id', _('Device'));
			Object.keys(data.devices).forEach(function(deviceID) {
				o.value(deviceID, data.devices[deviceID]);
			});
			o.rmempty = false;
		};
		o = s.option(form.Value, 'display_app', _('Application limit'),
			_('Set display limit per page for application manager.'));
		o.placeholder = _('1 - 100');
		o.datatype = 'range(1,100)';
		o.rmempty = false;
		o = s.option(form.Value, 'display_msg', _('Messages limit'),
			_('Set display limit per page for messages information.'));
		o.placeholder = _('1 - 100');
		o.datatype = 'range(1,100)';
		o.rmempty = false;

		s = m.section(form.NamedSection, 'monitoring', 'droidnet', _('Monitoring Service'),
			_('Monitor network performance on android modem to ensure optimal connectivity stability.'));
		o = s.option(form.DummyValue, 'dummy', _('Status'));
		o.rawhtml = true;
		o.cfgvalue = function(section_id) {
			var span = '<b><span style="color:%s">%s</span></b>';
			var renderHTML = data.status ?
				String.format(span, 'green', _('Running')) :
				String.format(span, 'red', _('Not Running'));
			return renderHTML;
		};
		o = s.option(form.Flag, 'enable', _('Enable'));
		o.rmempty = false;
		o = s.option(form.ListValue, 'ping', _('Ping method'),
			_('Set method for pinging host address.'));
		o.value('http', _('HTTP'));
		o.value('https', _('HTTPS'));
		o.value('icmp', _('ICMP'));
		o.value('tcp', _('TCP'));
		o.rmempty = false;
		o = s.option(form.Value, 'host', _('Host'),
			_('Host address you want to ping. Recommended to use bug on Tun.'));
		o.placeholder = _('Host address');
		o.rmempty = false;
		o = s.option(form.ListValue, 'success_limit', _('Max ping successes'),
			_('Maximum number of successful ping attempts to log "Host reachable" message.'));
		o.value('1', _('1 successes'));
		o.value('2', _('2 successes'));
		o.value('3', _('3 successes'));
		o.value('4', _('4 successes'));
		o.value('5', _('5 successes'));
		o.value('unlimited', _('Unlimited'));
		o.rmempty = false;
		o = s.option(form.ListValue, 'failure_limit', _('Max ping attempts'),
			_('Maximum number of unsuccessful ping attempts to trigger service.'));
		o.value('1', _('1 attempts'));
		o.value('2', _('2 attempts'));
		o.value('3', _('3 attempts'));
		o.value('4', _('4 attempts'));
		o.value('5', _('5 attempts'));
		o.rmempty = false;
		o = s.option(form.ListValue, 'wait_time', _('Waiting time'),
			_('Time to wait (in seconds) before activating airplane mode after ping failure.'));
		o.value('1', _('1 seconds'));
		o.value('2', _('2 seconds'));
		o.value('3', _('3 seconds'));
		o.value('4', _('4 seconds'));
		o.value('5', _('5 seconds'));
		o.rmempty = false;
		o = s.option(widgets.NetworkSelect, 'interface', _('Interface'),
			_('Name of interface to be restarted.'));
		o.nocreate = true;
		o.rmempty = false;
		o = s.option(form.Flag, 'restart', _('Restart the tunnel'),
			_('Enable to automatically restart tunneling tool.'));
		o.rmempty = false;
		if (data.tunnelService === false) {
			o = s.option(form.DummyValue, 'dummy', _('Tunneling tool'),
				_('Set tunneling tool to be restarted.'));
			o.default = _('No tunneling tools found.');
		} else {
			o = s.option(form.ListValue, 'tunnel_service', _('Tunneling tool'),
				_('Set tunneling tool to be restarted.'));
			Object.keys(data.tunnelService).forEach(function(pathID) {
				o.value(pathID, data.tunnelService[pathID]);
			});
		};



		s = m.section(form.NamedSection, 'httping', 'droidnet', _('Httping Service'),
			_('Monitor network performance on android modem to ensure optimal connectivity stability.'));
		o = s.option(form.DummyValue, 'dummy', _('Status'));
		o.rawhtml = true;
		o.cfgvalue = function(section_id) {
			var span = '<b><span style="color:%s">%s</span></b>';
			var renderHTML = data.status ?
				String.format(span, 'green', _('Running')) :
				String.format(span, 'red', _('Not Running'));
			return renderHTML;
		};
		o = s.option(form.Flag, 'enable', _('Enable'));
		o.rmempty = false;

		o = s.option(form.Value, 'http_url', _('URL'),
			_('The IP-based URL to connect to. It\'s recommended to use a plain IP address for better compatibility and skip DNS resolution.'));
		o.placeholder = _('http://104.17.3.81/cdn-cgi/trace');
		o.rmempty = false;

		o = s.option(form.Value, 'http_timeout', _('Max Timeout to Connect'),
			_('The maximum amount of time allowed for establishing a connection to the URL.'));
		o.placeholder = _('4');
		o.rmempty = false;

		o = s.option(form.Value, 'http_status_expected', _('Expected HTTP Status'),
			_('The expected HTTP response status. A different status indicates an error or unexpected result.'));
		o.placeholder = _('200');
		o.rmempty = false;

		o = s.option(form.Value, 'http_max_retries', _('Max Retries'),
			_('The number of times to retry connecting if a timeout or connection failure occurs.'));
		o.placeholder = _('5');
		o.rmempty = false;

		o = s.option(form.Value, 'http_delay_success', _('Delay After Successful Connection'),
			_('Wait this long before the next connection attempt if the previous attempt was successful.'));
		o.placeholder = _('7');
		o.rmempty = false;

		o = s.option(form.Value, 'http_delay_failed', _('Delay After Failed Connection'),
			_('Wait this long before retrying if the previous connection attempt failed.'));
		o.placeholder = _('0');
		o.rmempty = false;

		o = s.option(form.Value, 'change_ip_delay', _('Change IP Delay'),
			_('Delay before sending a request to change the device\'s IP. Useful for older/slower devices.'));
		o.placeholder = _('1');
		o.rmempty = false;

		o = s.option(form.Value, 'change_ip_check_delay', _('Change IP Check Delay'),
			_('Delay before checking if the IP address has successfully changed. Ensures the new IP is different from the previous one.'));
		o.placeholder = _('1');
		o.rmempty = false;

		o = s.option(form.Value, 'change_ip_check_max_retries', _('Change IP Check Max Retries'),
			_('If the IP hasn’t changed after this many retries, it will re-trigger the IP change mechanism (e.g., toggle airplane mode again).'));
		o.placeholder = _('0');
		o.rmempty = false;

		o = s.option(form.Flag, 'force_ping', _('Force ping'),
			_('Forces the connection attempt even if no ADB (Android Debug Bridge) devices are connected or if there\'s a known error.'));
		o.rmempty = false;

		o = s.option(form.Value, 'deep_failed_trigger', _('Deep Failed Trigger'),
			_('If the connection fails this many times consecutively, it triggers a longer sleep period to prevent aggressive retrying.'));
		o.placeholder = _('25');
		o.rmempty = false;

		o = s.option(form.Value, 'deep_failed_sleep_time', _('Deep Failed Sleep Time'),
			_('Sleep duration after hitting the deep failure threshold, giving time for issues (e.g., SIM card data subscription expired) to resolve.'));
		o.placeholder = _('60');
		o.rmempty = false;

		return m.render();
	}
});

