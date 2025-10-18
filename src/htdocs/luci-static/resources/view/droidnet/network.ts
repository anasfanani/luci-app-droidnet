/* This is free software, licensed under the Apache License, Version 2.0
 *
 * Copyright (C) 2024 Hilman Maulana <hilman0.0maulana@gmail.com>, Anas Fanani <anas@anasfanani.com>
 */
"use strict";
"require uci";
"require view";
"require ui";
"require tools/droidnet as DroidNet";
"require tools/ui-renderer as UIRenderer";

// Data-driven architecture
interface NetworkConfig {
  sections: NetworkSection[];
}

interface NetworkSection {
  id: string;
  title: string;
  commands: NetworkCommand[];
  renderer: (data: Record<string, any>) => Record<string, any>;
}

interface NetworkCommand {
  id: string;
  shell: string;
  parser: (stdout: string) => any;
}

const NETWORK_CONFIG: NetworkConfig = {
  sections: [
    {
      id: "network_capabilities",
      title: "Network Configuration",
      commands: [
        {
          id: "connectivity",
          shell: "dumpsys connectivity",
          parser: (stdout) => ({ stdout }),
        },
      ],
      renderer: (data) => {
        const caps = data["connectivity"]?.stdout?.match(
          /Capabilities:\s*([^\s]+)/,
        );
        const dns = data["connectivity"]?.stdout?.match(
          /DnsAddresses:\s*\[\s*([^\]]+)\s*\]/,
        );

        return {
          "Network capabilities": caps?.[1]?.split("&") || [],
          "DNS servers":
            dns?.[1]
              ?.split(",")
              .map((s: string) => s.trim().replace(/^\//, "")) || [],
        };
      },
    },
  ],
};

// Generic engine
async function loadDataDriven(): Promise<Record<string, any>> {
  const sectionData: Record<string, any> = {};

  for (const section of NETWORK_CONFIG.sections) {
    const commandResults: Record<string, any> = {};

    for (const command of section.commands) {
      commandResults[command.id] = await DroidNet.exec(
        command.shell.split(" "),
        command.parser,
      );
    }

    sectionData[section.id] = commandResults;
  }

  return sectionData;
}

function renderDataDriven(data: Record<string, any>): HTMLElement[] {
  const results = NETWORK_CONFIG.sections
    .map((section) => {
      const sectionData = section.renderer(data[section.id] || {});
      const rows = Object.entries(sectionData).map(([label, value]) => ({
        label,
        value: Array.isArray(value) ? value.join(", ") : String(value),
      }));

      return rows.length > 0
        ? [UIRenderer.renderTitle(section.title), UIRenderer.renderTable(rows)]
        : null;
    })
    .filter(Boolean);

  return results.flat() as HTMLElement[];
}

// @ts-expect-error - LuCI baseclass expects a plain object map of methods.
return view.extend({
  handleSaveApply: null,
  handleSave: null,
  handleReset: null,

  load: DroidNet.load(loadDataDriven),

  render: async function (data: Record<string, any>): Promise<HTMLElement> {
    const deviceCheck = await UIRenderer.checkDeviceAndRender(data);
    if (deviceCheck) return deviceCheck;

    // Use only data-driven sections
    const sections = [renderDataDriven(data)];

    return UIRenderer.renderPage(sections);
  },
});
