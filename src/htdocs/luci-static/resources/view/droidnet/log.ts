/* This is free software, licensed under the Apache License, Version 2.0
 *
 * Copyright (C) 2024 Hilman Maulana <hilman0.0maulana@gmail.com>
 */
"use strict";
"require uci";
"require view";
"require fs";
"require ui";
"require poll";
"require tools/droidnet as DroidNet";
"require tools/ui-renderer as UIRenderer";

interface LogData {
  deviceNotSet?: boolean;
  log_section?: boolean;
}

interface LogSettings {
  filter: string;
  direction: string;
  lines: string;
}

function saveLogSettings(): void {
  const settings = {
    filter:
      (document.getElementById("log-filter") as HTMLSelectElement)?.value ||
      "all",
    direction:
      (document.getElementById("log-direction") as HTMLSelectElement)?.value ||
      "down",
    lines:
      (document.getElementById("log-lines") as HTMLSelectElement)?.value ||
      "20",
  };
  localStorage.setItem("droidnet-log-settings", JSON.stringify(settings));
}

function loadLogSettings(): LogSettings {
  const saved = localStorage.getItem("droidnet-log-settings");
  return saved
    ? JSON.parse(saved)
    : {
        filter: "all",
        direction: "down",
        lines: "20",
      };
}

async function loadLogData(): Promise<LogData> {
  return {};
}

function renderLogControls(): HTMLElement[] {
  return [
    E(
      "div",
      { class: "filter-controls", style: "margin: 10px 0;" },
      UIRenderer.renderFilters([
        {
          label: "Filter by service",
          type: "select",
          id: "log-filter",
          options: [
            { value: "all", label: "All" },
            { value: "Application", label: "Application" },
            { value: "Monitoring", label: "Monitoring" },
            { value: "Network", label: "Network" },
            { value: "Power", label: "Power" },
          ],
          onChange: saveLogSettings,
        },
        {
          label: "Log direction",
          type: "select",
          id: "log-direction",
          options: [
            { value: "down", label: "Down" },
            { value: "up", label: "Up" },
          ],
          onChange: saveLogSettings,
        },
        {
          label: "Lines",
          type: "select",
          id: "log-lines",
          options: [
            { value: "10", label: "10" },
            { value: "20", label: "20" },
            { value: "50", label: "50" },
            { value: "100", label: "100" },
            { value: "200", label: "200" },
            { value: "500", label: "500" },
          ],
          onChange: saveLogSettings,
        },
        {
          label: "Clear",
          type: "button",
          class: "btn cbi-button cbi-button-remove",
          style: "margin-right: 10px;",
          onClick: async () => {
            const message = _("DroidNet logs have been successfully cleared.");
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
        {
          label: "Download",
          type: "button",
          class: "btn cbi-button cbi-button-save",
          onClick: () => {
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
      ]),
    ),
  ];
}

function renderLogViewer(): HTMLElement {
  return UIRenderer.renderTextarea({
    id: "syslog",
    style: "height: 500px; overflow-y: scroll;",
    readonly: true,
    wrap: "off",
    rows: 1,
  });
}

function startLogPolling(): void {
  poll.add(() => {
    const lines =
      (document.getElementById("log-lines") as HTMLSelectElement)?.value ||
      "20";
    return fs
      .exec("/usr/bin/tail", ["-n", lines, "/var/log/droidnet.log"])
      .then((res) => {
        const out = res && res.stdout ? res.stdout.trim() : "";
        const err = res && res.stderr ? res.stderr.trim() : "";

        if (err || !out) {
          UIRenderer.addNotification(
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
            .filter((log) => {
              return log.includes(filter);
            })
            .join("\n");
        }

        if (direction === "up") {
          data = data.split("\n").reverse().join("\n");
        }

        syslog.textContent = data;
      })
      .catch((error) => {
        UIRenderer.addNotification(
          "Error: Read log file!",
          "An error occurred while reading the file: " + String(error),
          "danger",
        );
      });
  }, 2);
}

// @ts-expect-error - LuCI baseclass expects a plain object map of methods.
return view.extend({
  handleSaveApply: null,
  handleSave: null,
  handleReset: null,

  load: DroidNet.load(loadLogData),

  render: DroidNet.render(
    () => [
      [
        E("div", { class: "cbi-control" }, renderLogControls()),
        E("div", { class: "cbi-body" }, [renderLogViewer()]),
      ],
    ],
    () => {
      // Auto-restore saved settings after render
      setTimeout(() => {
        const savedSettings = loadLogSettings();

        const filterSelect = document.getElementById(
          "log-filter",
        ) as HTMLSelectElement;
        const directionSelect = document.getElementById(
          "log-direction",
        ) as HTMLSelectElement;
        const linesSelect = document.getElementById(
          "log-lines",
        ) as HTMLSelectElement;

        if (filterSelect) filterSelect.value = savedSettings.filter;
        if (directionSelect) directionSelect.value = savedSettings.direction;
        if (linesSelect) linesSelect.value = savedSettings.lines;

        startLogPolling();
      }, 100);
    },
  ),
});
