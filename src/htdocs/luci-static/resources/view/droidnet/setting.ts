/* This is free software, licensed under the Apache License, Version 2.0
 *
 * Copyright (C) 2024 Hilman Maulana <hilman0.0maulana@gmail.com>
 */
"use strict";
"require view";
"require form";
"require uci";
"require fs";
"require tools.widgets as widgets";
"require droidnet";
"require tools/ui-renderer as UIRenderer";

interface SettingData {
  deviceNotSet?: boolean;
  setting_section?: boolean;
  devices?: Record<string, string> | false;
  tunnelService?: Record<string, string> | false;
  status?: boolean;
}

async function loadSettingData(): Promise<SettingData> {
  await uci.load("droidnet");

  const [deviceData, tunnelService, status] = await Promise.all([
    droidnet.getDeviceLists(),
    loadTunnelServices(),
    droidnet.serviceStatus(),
  ]);

  return { devices: deviceData.devices, tunnelService, status };
}

async function loadTunnelServices(): Promise<Record<string, string> | false> {
  const result = await fs.list("/etc/init.d");
  const tunnelService: Record<string, string> = {};
  const fileNames = {
    neko: "Neko",
    openclash: "OpenClash",
    passwall: "PassWall",
    v2ray: "V2Ray",
  };

  result.forEach((file) => {
    if (fileNames[file.name as keyof typeof fileNames]) {
      tunnelService[file.name] = fileNames[file.name as keyof typeof fileNames];
    }
  });

  return Object.keys(tunnelService).length === 0 ? false : tunnelService;
}

function createStatusOption(s: LuCI.form.NamedSection, status: boolean): void {
  const o = s.option(form.DummyValue, "dummy", _("Status"));
  o.rawhtml = true;
  o.cfgvalue = function () {
    const span = '<b><span style="color:%s">%s</span></b>';
    return (String as any).format(
      span,
      status ? "green" : "red",
      status ? _("Running") : _("Not Running"),
    );
  };
}

function createListOption(
  s: LuCI.form.NamedSection,
  id: string,
  title: string,
  description: string,
  values: Record<string, string>,
): void {
  const o = s.option(form.ListValue, id, _(title), _(description));
  Object.entries(values).forEach(([key, value]) => o.value(key, _(value)));
  o.rmempty = false;
}

function createValueOption(
  s: LuCI.form.NamedSection,
  id: string,
  title: string,
  description: string,
  placeholder: string,
): void {
  const o = s.option(form.Value, id, _(title), _(description));
  o.placeholder = _(placeholder);
  o.rmempty = false;
}

function createRangeOption(
  s: LuCI.form.NamedSection,
  id: string,
  title: string,
  description: string,
  range: string,
): void {
  const o = s.option(form.Value, id, _(title), _(description));
  o.placeholder = _(range);
  o.datatype = `range(${range.replace(" - ", ",")})`;
  o.rmempty = false;
}

function renderBaseSection(m: LuCI.form.Map, data: SettingData): void {
  const s = m.section(
    form.NamedSection,
    "device",
    "droidnet",
    _("Base Setting"),
  );

  if (data.devices === false) {
    const o = s.option(form.DummyValue, "dummy", _("Device"));
    o.default = _("No device detected.");
  } else if (data.devices) {
    const o = s.option(form.ListValue, "id", _("Device"));
    Object.keys(data.devices).forEach((deviceID) => {
      o.value(deviceID, (data.devices as Record<string, string>)[deviceID]);
    });
    o.rmempty = false;
  }

  createRangeOption(
    s,
    "display_app",
    "Application limit",
    "Set display limit per page for application manager.",
    "1 - 100",
  );
  createRangeOption(
    s,
    "display_msg",
    "Messages limit",
    "Set display limit per page for messages information.",
    "1 - 100",
  );
}

function renderMonitoringSection(m: LuCI.form.Map, data: SettingData): void {
  const s = m.section(
    form.NamedSection,
    "monitoring",
    "droidnet",
    _("Monitoring Service"),
    _(
      "Monitor network performance on android modem to ensure optimal connectivity stability.",
    ),
  );

  createStatusOption(s, data.status!);

  const enableOption = s.option(form.Flag, "enable", _("Enable"));
  enableOption.rmempty = false;
  enableOption.write = async function (section_id: string, value: string) {
    const isEnabled = value === "1";
    if (isEnabled) {
      await droidnet.serviceRestart();
    } else {
      await droidnet.serviceStop();
    }
    return uci.set("droidnet", section_id, "enable", value);
  };

  createListOption(
    s,
    "ping",
    "Ping method",
    "Set method for pinging host address.",
    {
      http: "HTTP",
      https: "HTTPS",
      icmp: "ICMP",
      tcp: "TCP",
    },
  );

  createValueOption(
    s,
    "host",
    "Host",
    "Host address you want to ping. Recommended to use bug on Tun.",
    "Host address",
  );

  const successValues = {
    "1": "1 successes",
    "2": "2 successes",
    "3": "3 successes",
    "4": "4 successes",
    "5": "5 successes",
    unlimited: "Unlimited",
  };
  createListOption(
    s,
    "success_limit",
    "Max ping successes",
    'Maximum number of successful ping attempts to log "Host reachable" message.',
    successValues,
  );

  const attemptValues = {
    "1": "1 attempts",
    "2": "2 attempts",
    "3": "3 attempts",
    "4": "4 attempts",
    "5": "5 attempts",
  };
  createListOption(
    s,
    "failure_limit",
    "Max ping attempts",
    "Maximum number of unsuccessful ping attempts to trigger service.",
    attemptValues,
  );

  const timeValues = {
    "1": "1 seconds",
    "2": "2 seconds",
    "3": "3 seconds",
    "4": "4 seconds",
    "5": "5 seconds",
  };
  createListOption(
    s,
    "wait_time",
    "Waiting time",
    "Time to wait (in seconds) before activating airplane mode after ping failure.",
    timeValues,
  );

  const interfaceOption = s.option(
    widgets.NetworkSelect,
    "interface",
    _("Interface"),
    _("Name of interface to be restarted."),
  );
  interfaceOption.nocreate = true;
  interfaceOption.rmempty = false;

  const restartOption = s.option(
    form.Flag,
    "restart",
    _("Restart the tunnel"),
    _("Enable to automatically restart tunneling tool."),
  );
  restartOption.rmempty = false;

  if (data.tunnelService === false) {
    const tunnelOption = s.option(
      form.DummyValue,
      "dummy",
      _("Tunneling tool"),
      _("Set tunneling tool to be restarted."),
    );
    tunnelOption.default = _("No tunneling tools found.");
  } else if (data.tunnelService) {
    const tunnelOption = s.option(
      form.ListValue,
      "tunnel_service",
      _("Tunneling tool"),
      _("Set tunneling tool to be restarted."),
    );
    Object.keys(data.tunnelService).forEach((pathID) => {
      tunnelOption.value(
        pathID,
        (data.tunnelService as Record<string, string>)[pathID],
      );
    });
  }
}

function renderHttpingSection(m: LuCI.form.Map, data: SettingData): void {
  const s = m.section(
    form.NamedSection,
    "httping",
    "droidnet",
    _("Httping Service"),
    _(
      "Monitor network performance on android modem to ensure optimal connectivity stability.",
    ),
  );

  createStatusOption(s, data.status!);

  const enableOption = s.option(form.Flag, "enable", _("Enable"));
  enableOption.rmempty = false;
  enableOption.write = async function (section_id: string, value: string) {
    const isEnabled = value === "1";
    if (isEnabled) {
      await droidnet.serviceRestart();
    } else {
      await droidnet.serviceStop();
    }
    return uci.set("droidnet", section_id, "enable", value);
  };

  const httpOptions = [
    {
      id: "http_url",
      title: "URL",
      desc: "The IP-based URL to connect to. It's recommended to use a plain IP address for better compatibility and skip DNS resolution.",
      placeholder: "http://104.17.3.81/cdn-cgi/trace",
    },
    {
      id: "http_timeout",
      title: "Max Timeout to Connect",
      desc: "The maximum amount of time allowed for establishing a connection to the URL.",
      placeholder: "4",
    },
    {
      id: "http_status_expected",
      title: "Expected HTTP Status",
      desc: "The expected HTTP response status. A different status indicates an error or unexpected result.",
      placeholder: "200",
    },
    {
      id: "http_max_retries",
      title: "Max Retries",
      desc: "The number of times to retry connecting if a timeout or connection failure occurs.",
      placeholder: "5",
    },
    {
      id: "http_delay_success",
      title: "Delay After Successful Connection",
      desc: "Wait this long before the next connection attempt if the previous attempt was successful.",
      placeholder: "7",
    },
    {
      id: "http_delay_failed",
      title: "Delay After Failed Connection",
      desc: "Wait this long before retrying if the previous connection attempt failed.",
      placeholder: "0",
    },
    {
      id: "change_ip_delay",
      title: "Change IP Delay",
      desc: "Delay before sending a request to change the device's IP. Useful for older/slower devices.",
      placeholder: "1",
    },
    {
      id: "change_ip_check_delay",
      title: "Change IP Check Delay",
      desc: "Delay before checking if the IP address has successfully changed. Ensures the new IP is different from the previous one.",
      placeholder: "1",
    },
    {
      id: "change_ip_check_max_retries",
      title: "Change IP Check Max Retries",
      desc: "If the IP hasn't changed after this many retries, it will re-trigger the IP change mechanism (e.g., toggle airplane mode again).",
      placeholder: "0",
    },
    {
      id: "deep_failed_trigger",
      title: "Deep Failed Trigger",
      desc: "If the connection fails this many times consecutively, it triggers a longer sleep period to prevent aggressive retrying.",
      placeholder: "25",
    },
    {
      id: "deep_failed_sleep_time",
      title: "Deep Failed Sleep Time",
      desc: "Sleep duration after hitting the deep failure threshold, giving time for issues (e.g., SIM card data subscription expired) to resolve.",
      placeholder: "60",
    },
  ];

  httpOptions.forEach((option) =>
    createValueOption(
      s,
      option.id,
      option.title,
      option.desc,
      option.placeholder,
    ),
  );

  const forcePingOption = s.option(
    form.Flag,
    "force_ping",
    _("Force ping"),
    _(
      "Forces the connection attempt even if no ADB (Android Debug Bridge) devices are connected or if there's a known error.",
    ),
  );
  forcePingOption.rmempty = false;
}

// @ts-expect-error - LuCI baseclass expects a plain object map of methods.
return view.extend({
  load: droidnet.load(loadSettingData),

  render: async function (data: SettingData): Promise<HTMLElement> {
    const deviceCheck = await UIRenderer.checkDeviceAndRender(data);
    if (deviceCheck) return deviceCheck;

    const m = new form.Map("droidnet");

    renderBaseSection(m, data);
    renderMonitoringSection(m, data);
    renderHttpingSection(m, data);

    return UIRenderer.renderPage([[await m.render()]]);
  },
});
