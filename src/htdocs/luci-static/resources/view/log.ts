/* This is free software, licensed under the Apache License, Version 2.0
 *
 * Copyright (C) 2024 Hilman Maulana <hilman0.0maulana@gmail.com>
 */
"use strict";
"require view";
"require fs";
"require ui";
"require poll";
"require droidnet";

interface LogData {
  deviceNotSet?: boolean;
  log_section?: boolean;
}

async function loadLogData(): Promise<LogData> {
  if (!(await droidnet.getDeviceId())) {
    return { deviceNotSet: true };
  }

  if (!(await droidnet.isDeviceConnected())) {
    return { log_section: true };
  }

  return {};
}

function renderLogControls(): HTMLElement[] {
  return [
    E(
      "label",
      { for: "log-filter", style: "margin-right: 8px;" },
      _("Filter by service") + " : ",
    ),
    E("select", { id: "log-filter", style: "margin: 8px 8px 8px 0;" }, [
      E("option", { value: "all", selected: "selected" }, _("All")),
      E("option", { value: "Application" }, _("Application")),
      E("option", { value: "Monitoring" }, _("Monitoring")),
      E("option", { value: "Network" }, _("Network")),
      E("option", { value: "Power" }, _("Power")),
    ]),
    E(
      "label",
      { for: "log-direction", style: "margin-right: 8px;" },
      _("Log direction") + " : ",
    ),
    E("select", { id: "log-direction", style: "margin: 8px 8px 8px 0;" }, [
      E("option", { value: "down", selected: "selected" }, _("Down")),
      E("option", { value: "up" }, _("Up")),
    ]),
    E(
      "div",
      {
        class: "log-button",
        style: "display: inline-block; margin: 0 8px 8px 0;",
      },
      [
        E(
          "button",
          {
            class: "btn cbi-button cbi-button-remove",
            style: "margin-right: 10px",
            click: async function () {
              const message = _(
                "DroidNet logs have been successfully cleared.",
              );
              const date = new Date().toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "2-digit",
              });
              const time = new Date().toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
              });
              const notif = `${date}, ${time} - Network service: ${message}\n`;
              await fs.write("/var/log/droidnet.log", notif);
              (
                document.getElementById("syslog") as HTMLTextAreaElement
              ).textContent = notif;
            },
          },
          _("Clear"),
        ),
        E(
          "button",
          {
            class: "btn cbi-button cbi-button-save",
            click: function () {
              const logs = (
                document.getElementById("syslog") as HTMLTextAreaElement
              ).value;
              const blob = new Blob([logs], { type: "text/plain" });
              const link = document.createElement("a");
              link.href = window.URL.createObjectURL(blob);
              link.download = "droidnet.log";
              link.click();
            },
          },
          _("Download"),
        ),
      ],
    ),
  ];
}

function renderLogViewer(): HTMLElement {
  return E("textarea", {
    id: "syslog",
    class: "cbi-input-textarea",
    style: "height: 500px; overflow-y: scroll;",
    readonly: "readonly",
    wrap: "off",
    rows: 1,
  });
}

function startLogPolling(): void {
  poll.add(function () {
    return fs
      .exec("/usr/bin/tail", ["/var/log/droidnet.log"])
      .then(function (res) {
        const out = res && res.stdout ? res.stdout.trim() : "";
        const err = res && res.stderr ? res.stderr.trim() : "";

        if (err || !out) {
          droidnet.addNotification(
            "Error: Read log file!",
            "Unable to read the interface info from /var/log/droidnet.log." +
              (err ? ` (${err})` : ""),
            "danger",
          );
          return;
        }

        let data = out;
        const syslog = document.getElementById("syslog") as HTMLTextAreaElement;
        const filter = (
          document.getElementById("log-filter") as HTMLSelectElement
        ).value;
        const direction = (
          document.getElementById("log-direction") as HTMLSelectElement
        ).value;

        if (filter !== "all") {
          data = data
            .split("\n")
            .filter(function (log) {
              return log.includes(filter);
            })
            .join("\n");
        }

        if (direction === "up") {
          data = data.split("\n").reverse().join("\n");
        }

        syslog.textContent = data;
      })
      .catch(function (error) {
        droidnet.addNotification(
          "Error: Read log file!",
          "An error occurred while reading the file: " + String(error),
          "danger",
        );
      });
  }, 2);
}

// @ts-ignore
return view.extend({
  handleSaveApply: null,
  handleSave: null,
  handleReset: null,

  load: loadLogData,

  render: async function (data: LogData): Promise<HTMLElement> {
    if (data.deviceNotSet) {
      return droidnet.selectDeviceForm();
    }

    if (data.log_section) {
      droidnet.addNotification(
        "Device Not Connected",
        "Your Android device appears to be disconnected. Please check the USB connection and ensure ADB debugging is enabled.",
        "warning",
      );

      return droidnet.selectDeviceForm();
    }

    startLogPolling();

    const sections = [
      [
        E("div", { class: "cbi-control" }, renderLogControls()),
        E("div", { class: "cbi-body" }, [renderLogViewer()]),
      ],
    ];

    return droidnet.renderPage(sections);
  },
});
