"use strict";
"require uci";
"require fs";
"require ui";
"require form";
"require baseclass";

const title = _(
  `<p><strong><span style="margin-right: 5px;"><img src="/luci-static/resources/svg/droidnet.svg" style="height: 1em;width: auto;vertical-align: -0.15em;"></img></span><span style="color: rgb(102, 153, 51);">Droid</span> <span style="color: rgb(250, 197, 28);">Net</span></strong></p>`,
);
const description = "Manage Android modem and optimize network settings.";
const header = [
  E("h2", { class: "section-title" }, title),
  E("div", { class: "cbi-map-descr" }, _(description)),
];

let deviceId = null;
async function getDeviceId() {
  if (deviceId === null) {
    await uci.load("droidnet");
    deviceId = uci.get("droidnet", "device", "id");
  }
  return deviceId;
}
const toArray = (cmd) => (Array.isArray(cmd) ? cmd : [String(cmd)]);

async function _adbExec(command, callback, { asSu = false } = {}) {
  try {
    const id = await getDeviceId();
    const shellArgs = asSu
      ? ["-s", id, "shell", "su", "-c", toArray(command).join(" ")]
      : ["-s", id, "shell", ...toArray(command)];

    const result = await fs.exec("adb", shellArgs);
    const hadError =
      (typeof result.code === "number" && result.code !== 0) ||
      (result.stderr && result.stderr.trim().length > 0);

    if (hadError) {
      return { ...result, error: true };
    }

    if (!callback) return { ...result, error: false };
    const cbOut = await callback(result.stdout);
    return cbOut;
  } catch (error) {
    return { error: true, stderr: String(error), stdout: "" };
  }
}

async function exec(command, callback) {
  return _adbExec(command, callback, { asSu: false });
}

async function suexec(command, callback) {
  return _adbExec(command, callback, { asSu: true });
}

async function selectDevices() {
  try {
    const result = await fs.exec("/usr/bin/env", [
      "HOME=/root",
      "/usr/bin/adb",
      "devices",
      "-l",
    ]);
    const devices = {};
    const stdout = result.stdout.trim();
    const stderr = result.stderr;
    if (
      stderr ||
      stdout === "List of devices attached" ||
      !stdout.includes("List of devices attached")
    ) {
      return { devices: false };
    }
    const lines = stdout.split("\n").filter((line) => {
      return (
        !line.startsWith("*") && line.trim() !== "List of devices attached"
      );
    });
    if (lines.length > 0) {
      lines.forEach((line) => {
        const parts = line.split(/\s+/);
        const device = parts[0].trim();
        const model = line.includes("unauthorized")
          ? "unauthorized"
          : parts.find((part) => part.startsWith("model:"))?.substring(6) ||
            device;
        devices[device] = model;
      });
    }
    return { devices };
  } catch (error) {
    throw new Error(error);
  }
}

async function selectDeviceForm() {
  const getDevices = await selectDevices();
  let m, s, o;
  m = new form.Map("droidnet", title, description);
  s = m.section(form.NamedSection, "device", "droidnet", _("Device Selection"));
  s.anonymous = true;
  let deviceSelected;
  if (getDevices.devices === false) {
    o = s.option(form.DummyValue, "dummy", _("Device"));
    o.default = _("No device detected.");
  } else {
    o = s.option(form.ListValue, "id", _("Select Device ID"));
    Object.entries(getDevices.devices).forEach(([deviceID, deviceModel]) => {
      o.value(deviceID, deviceID + " - " + deviceModel);
    });
    o.validate = function (section, value) {
      deviceSelected = value;
      const saveBtn = document.querySelector(
        "#cbi-droidnet-device-save button",
      );
      if (getDevices.devices[deviceSelected] === "unauthorized") {
        if (saveBtn) {
          saveBtn.disabled = true;
        }
        return `Device ${deviceSelected} is unauthorized !`;
      }
      if (saveBtn) {
        saveBtn.disabled = false;
      }
      return true;
    };
    o.rmempty = false;
  }

  o = s.option(form.Button, "save", _("Action"));
  o.inputstyle = "positive";
  o.inputtitle = _("Save Setting");
  o.write = function () {};
  o.remove = function () {};
  o.readonly = (function () {
    const noDevices = getDevices.devices === false;
    const allUnauthorized = Object.values(getDevices.devices).every(
      (model) => model === "unauthorized",
    );
    const firstDeviceisUnauthorized = Object.entries(getDevices.devices)[0][1];
    return noDevices || allUnauthorized || firstDeviceisUnauthorized;
  })();
  o.onclick = async function () {
    uci.set("droidnet", "device", "id", deviceSelected);
    uci.save();
    window.location.reload();
  };
  o = s.option(form.Button, "reload", _("ADB Daemon"));
  o.inputstyle = "negative";
  o.inputtitle = _("⟳ Reload ADB Daemon");
  o.onclick = async function () {
    await droidnet.reloadAdbd();
    window.location.reload();
  };
  o.write = function () {};
  o.remove = function () {};
  return m.render();
}
return baseclass.extend({
  title: title,
  header: header,
  selectDeviceForm: selectDeviceForm,
  exec: exec,
  suexec: suexec,
  getDeviceId: getDeviceId,
  selectDevices: selectDevices,
  reloadAdbd: async function () {
    const result = await fs.exec("adb", ["kill-server"]);
  },
});
