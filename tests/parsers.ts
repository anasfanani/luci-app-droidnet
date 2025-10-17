import * as cheerio from "cheerio";

// Parser registry - maps page titles to their specific parsers
const parsers: Record<string, ($: cheerio.CheerioAPI) => Record<string, any>> =
  {
    Device: parseDevicePage,
    Network: parseNetworkPage,
    Service: parseServicePage,
    Inbox: parseInboxPage,
    Logs: parseLogsPage,
    Setting: parseSettingPage,
  };

// Main parser function - dynamically selects parser based on title
export function parsePage(title: string, $: cheerio.CheerioAPI) {
  const parser = parsers[title];
  if (parser) {
    console.debug(`Using specific parser for ${title} page`);
    return parser($);
  } else {
    console.debug(
      `No specific parser for ${title} page, using basic validation`,
    );
    return {
      title: $("title").text(),
      hasContent: $("body").text().length > 0,
    };
  }
}

// Device page parser
function parseDevicePage($: cheerio.CheerioAPI) {
  const deviceInfo: Record<string, string> = {};
  const batteryInfo: Record<string, string> = {};

  // Parse device info (first table)
  $("table")
    .eq(0)
    .find("tr")
    .each((i, row) => {
      const cells = $(row).find("td");
      if (cells.length >= 4) {
        const key1 = $(cells[0]).find("b").text().trim();
        const value1 = $(cells[1]).text().trim();
        const key2 = $(cells[2]).find("b").text().trim();
        const value2 = $(cells[3]).text().trim();

        if (key1) deviceInfo[key1] = value1;
        if (key2) deviceInfo[key2] = value2;
      }
    });

  // Parse battery info (second table)
  $("table")
    .eq(1)
    .find("tr")
    .each((i, row) => {
      const cells = $(row).find("td");
      if (cells.length >= 2) {
        const key = $(cells[0]).find("b").text().trim();
        const value = $(cells[1]).text().trim();
        if (key) batteryInfo[key] = value;
      }
    });

  return { deviceInfo, batteryInfo };
}

// Network page parser
function parseNetworkPage($: cheerio.CheerioAPI) {
  const networkInfo: Record<string, string> = {};
  const cellularInfo: Record<string, string> = {};
  const simInfo: Record<string, string> = {};
  const apnInfo: Record<string, string> = {};

  // Parse mobile network (first table)
  $("table")
    .eq(0)
    .find("tr")
    .each((i, row) => {
      const cells = $(row).find("td");
      if (cells.length >= 2) {
        const key = $(cells[0]).find("b").text().trim();
        const value = $(cells[1]).text().trim();
        if (key) networkInfo[key] = value;
      }
    });

  // Parse cellular info (second table)
  $("table")
    .eq(1)
    .find("tr")
    .each((i, row) => {
      const cells = $(row).find("td");
      if (cells.length >= 2) {
        const key = $(cells[0]).find("b").text().trim();
        const value = $(cells[1]).text().trim();
        if (key) cellularInfo[key] = value;
      }
    });

  // Parse SIM info
  $("#sim1 table")
    .find("tr")
    .each((i, row) => {
      const cells = $(row).find("td");
      if (cells.length >= 2) {
        const key = $(cells[0]).find("b").text().trim();
        const value = $(cells[1]).text().trim();
        if (key) simInfo[key] = value;
      }
    });

  // Parse APN info (last table)
  $("table")
    .last()
    .find("tr")
    .each((i, row) => {
      const cells = $(row).find("td");
      if (cells.length >= 4) {
        const key1 = $(cells[0]).find("b").text().trim();
        const value1 = $(cells[1]).text().trim();
        const key2 = $(cells[2]).find("b").text().trim();
        const value2 = $(cells[3]).text().trim();

        if (key1) apnInfo[key1] = value1;
        if (key2) apnInfo[key2] = value2;
      }
    });

  return { networkInfo, cellularInfo, simInfo, apnInfo };
}

// Service page parser
function parseServicePage($: cheerio.CheerioAPI) {
  const powerOptions: string[] = [];
  const appManager = { totalApps: 0, installedApps: [], systemApps: [] };

  // Parse power options buttons - only the first 4 buttons in the power section
  $('h3:contains("Power Options")')
    .parent()
    .nextAll(".cbi-section")
    .first()
    .find("button")
    .each((i, btn) => {
      const buttonText = $(btn).text().trim();
      if (buttonText && i < 4) {
        // Only first 4 buttons are power options
        powerOptions.push(buttonText);
      }
    });

  return { powerOptions, appManager };
}

// Inbox page parser
function parseInboxPage($: cheerio.CheerioAPI) {
  const stats: Record<string, number> = {};
  const filters: Record<string, string[]> = {};

  // Parse message stats from description
  const statsText = $(".cbi-section-descr").first().text();
  const statsMatch = statsText.match(
    /(\d+) messages, (\d+) unread, (\d+) conversations, (\d+) SIM cards/,
  );
  if (statsMatch) {
    stats["totalMessages"] = parseInt(statsMatch[1]);
    stats["unreadMessages"] = parseInt(statsMatch[2]);
    stats["conversations"] = parseInt(statsMatch[3]);
    stats["simCards"] = parseInt(statsMatch[4]);
  }

  // Parse filter options
  $("select").each((i, select) => {
    const id = $(select).attr("id");
    if (id) {
      const options: string[] = [];
      $(select)
        .find("option")
        .each((j, option) => {
          options.push($(option).text().trim());
        });
      filters[id] = options;
    }
  });

  return { stats, filters };
}

// Logs page parser
function parseLogsPage($: cheerio.CheerioAPI) {
  const controls: Record<string, string[]> = {};

  // Parse log controls
  $("select").each((i, select) => {
    const id = $(select).attr("id");
    if (id) {
      const options: string[] = [];
      $(select)
        .find("option")
        .each((j, option) => {
          options.push($(option).text().trim());
        });
      controls[id] = options;
    }
  });

  // Check if log content exists
  const hasLogContent = $("#syslog").length > 0;

  return { controls, hasLogContent };
}

// Setting page parser
function parseSettingPage($: cheerio.CheerioAPI) {
  const settings: Record<string, string> = {};

  // Parse form fields
  $(".cbi-value").each((i, value) => {
    const label = $(value).find(".cbi-value-title").text().trim();
    const field = $(value).find("select, input, textarea").first();

    if (label && field.length > 0) {
      if (field.is("select")) {
        const selectedOption = field.find("option:selected").text().trim();
        settings[label] = selectedOption;
      } else {
        settings[label] = (field.val() as string) || "";
      }
    }
  });

  return { settings };
}
