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
  renderer: (
    data: Record<string, CommandData>,
  ) => Record<string, string[] | string>;
}

interface NetworkCommand {
  id: string;
  shell: string;
  parser: (stdout: string) => CommandData;
}

interface CommandData {
  stdout: string;
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
        const linkProps = data["connectivity"]?.stdout?.match(
          /LinkProperties:\s*\{([^}]+)\}/,
        );
        const routes = data["connectivity"]?.stdout?.match(
          /Routes:\s*\[([^\]]+)\]/,
        );
        const mtu = data["connectivity"]?.stdout?.match(/Mtu:\s*(\d+)/);

        return {
          "Network capabilities": caps?.[1]?.split("&") || [],
          "DNS servers":
            dns?.[1]
              ?.split(",")
              .map((s: string) => s.trim().replace(/^\//, "")) || [],
          "Link properties": linkProps?.[1]?.trim() || "",
          Routes: routes?.[1]?.trim() || "",
          MTU: mtu?.[1] || "",
        };
      },
    },
  ],
};

// Generic engine
async function loadDataDriven(): Promise<
  Record<string, Record<string, CommandData>>
> {
  const sectionData: Record<string, Record<string, CommandData>> = {};

  for (const section of NETWORK_CONFIG.sections) {
    const commandResults: Record<string, CommandData> = {};

    for (const command of section.commands) {
      const result = await DroidNet.exec(command.shell.split(" "));
      commandResults[command.id] = command.parser(result.stdout || "");
    }

    sectionData[section.id] = commandResults;
  }

  return sectionData;
}

function renderDataDriven(
  data: Record<string, Record<string, CommandData>>,
): HTMLElement[] {
  const results = NETWORK_CONFIG.sections
    .map((section) => {
      const sectionData = section.renderer(data[section.id] || {});
      const rows = Object.entries(sectionData).map(([label, value]) => ({
        label,
        value: Array.isArray(value) ? value.join(", ") : String(value),
      }));

      // Check for empty values
      const emptyRows = rows.filter((r) => !r.value);
      if (emptyRows.length > 0) {
        console.warn(
          "DroidNet: Missing data for:",
          emptyRows.map((r) => r.label).join(", "),
        );
      }

      return rows.length > 0
        ? [UIRenderer.renderTitle(section.title), UIRenderer.renderTable(rows)]
        : null;
    })
    .filter(Boolean);

  return results.flat() as HTMLElement[];
}

// @ts-expect-error - LuCI baseclass expects a plain object map of methods.
return view.extend(
  DroidNet.createView({
    load: loadDataDriven,
    render: (
      data: Record<string, Record<string, CommandData>> & DeviceStatus,
    ) => [renderDataDriven(data)],
  }),
);
