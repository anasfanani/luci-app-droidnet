/* This is free software, licensed under the Apache License, Version 2.0
 *
 * Copyright (C) 2024 Hilman Maulana <hilman0.0maulana@gmail.com>
 */
"use strict";
"require view";
"require uci";
"require fs";
"require ui";
"require tools/droidnet as DroidNet";
"require tools/ui-renderer as UIRenderer";

interface InboxData {
  deviceNotSet?: boolean;
  inbox_section?: boolean;
  messages?: InboxMessage[];
  display?: number;
  messages_section?: string;
  messages_info?: string;
}

interface InboxMessage {
  _id: string;
  address: string;
  body: string;
  date: number;
  date_sent: number;
  read: boolean;
  thread_id: string;
  person: string | null;
  sub_id: string;
  sim_slot: string;
  received: {
    date: string;
    time: string;
  };
  sent: {
    date: string;
    time: string;
  };
  [key: string]: unknown;
}

interface FilterSettings {
  readFilter: string;
  senderFilter: string;
  simFilter: string;
  perPage: string;
}

function saveFilterSettings(): void {
  const settings = {
    readFilter:
      (document.getElementById("read-filter") as HTMLSelectElement)?.value ||
      "all",
    senderFilter:
      (document.getElementById("sender-filter") as HTMLSelectElement)?.value ||
      "all",
    simFilter:
      (document.getElementById("sim-filter") as HTMLSelectElement)?.value ||
      "all",
    perPage:
      (document.getElementById("per-page") as HTMLSelectElement)?.value || "10",
  };
  localStorage.setItem("droidnet-inbox-filters", JSON.stringify(settings));
}

function loadFilterSettings(): FilterSettings {
  const saved = localStorage.getItem("droidnet-inbox-filters");
  const settings = saved
    ? JSON.parse(saved)
    : {
        readFilter: "all",
        senderFilter: "all",
        simFilter: "all",
        perPage: "10",
      };
  return settings;
}

let inboxCurrentPage = 1;

async function loadInboxData(): Promise<InboxData> {
  await uci.load("droidnet");
  const display = parseInt(
    uci.get("droidnet", "device", "display_msg") || "10",
  );

  const result = await DroidNet.exec([
    "content",
    "query",
    "--uri",
    "content://sms/inbox",
    "--projection",
    "_id,address,body,date,date_sent,read,thread_id,person,sub_id,sim_slot",
  ]);

  if (result.stderr) {
    return { messages_section: result.stderr.trim() };
  }

  if (result.stdout?.includes("Error")) {
    return { messages_info: result.stdout.trim() };
  }

  const messages = parseMessages(result.stdout || "");
  return { messages, display };
}

function parseMessages(stdout: string): InboxMessage[] {
  const messages: InboxMessage[] = [];
  const lines = stdout.trim().split("Row: ");
  lines.shift();

  const properties = {
    _id: "_id",
    address: "address",
    body: "body",
    date: "date",
    date_sent: "date_sent",
    read: "read",
    thread_id: "thread_id",
    person: "person",
    sub_id: "sub_id",
    sim_slot: "sim_slot",
  };

  lines.forEach((line) => {
    const pairs = line.split(",");
    const inbox: Partial<InboxMessage> = {};

    // eslint-disable-next-line complexity
    pairs.forEach((pair) => {
      const keyValue = pair.split("=");
      if (keyValue.length === 2 && keyValue[0] && keyValue[1]) {
        const key = keyValue[0].trim();
        const value = keyValue[1].trim();

        if (properties.hasOwnProperty(key as keyof typeof properties)) {
          if (key === "body") {
            const start = line.indexOf("body=") + 5;
            const bodyEnd = line.indexOf(", date=");
            const message = line.substring(
              start,
              bodyEnd > 0 ? bodyEnd : line.length,
            );
            inbox.body = message;
          } else if (key === "date" || key === "date_sent") {
            const timestamp = parseInt(value);
            inbox[key] = timestamp;

            if (key === "date") {
              const date = new Date(timestamp).toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "2-digit",
                year: "numeric",
              });
              const time = new Date(timestamp).toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
              });
              inbox.received = { date: `${date} ${time}`, time };
            } else if (key === "date_sent") {
              const date = new Date(timestamp).toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "2-digit",
                year: "numeric",
              });
              const time = new Date(timestamp).toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
              });
              inbox.sent = { date: `${date} ${time}`, time };
            }
          } else if (key === "read") {
            inbox.read = value === "1";
          } else if (key === "person" && value === "NULL") {
            inbox.person = null;
          } else if (key === "sim_slot") {
            inbox.sim_slot = `SIM ${parseInt(value) + 1}`;
          } else if (key === "sub_id") {
            inbox.sub_id = value;
          } else {
            inbox[key] = value;
          }
        }
      }
    });

    if (inbox.body && inbox.address && inbox.received) {
      messages.push(inbox as InboxMessage);
    }
  });

  return messages;
}

// eslint-disable-next-line max-lines-per-function
function renderMessageTable(
  messages: InboxMessage[],
  display: number,
): HTMLElement {
  const startIndex = (inboxCurrentPage - 1) * display;
  const endIndex = Math.min(startIndex + display, messages.length);
  const currentPageData = messages.slice(startIndex, endIndex);

  const rows = currentPageData.map((inbox) => {
    const readIcon = inbox.read ? "📖" : "📩";
    const preview =
      inbox.body.length > 50 ? inbox.body.substring(0, 50) + "..." : inbox.body;
    const messageHtml = inbox.body.replace(/\n/g, "<br>");

    const viewButton = UIRenderer.renderButton({
      label: "View",
      type: "action",
      size: "normal",
      style: "margin-right: 5px;",
      onClick: () => {
        ui.showModal(inbox.address, [
          E("div", { style: "margin-bottom: 10px;" }, [
            E("strong", `From: ${inbox.address}`),
            E("br"),
            E("em", `Received: ${inbox.received.date}`),
            E("br"),
            E(
              "span",
              { style: inbox.read ? "" : "font-weight: bold;" },
              inbox.read ? "Read" : "Unread",
            ),
          ]),
          E("div", {
            style: "border-top: 1px solid #ccc; padding-top: 10px;",
          }),
          E(
            "p",
            {},
            messageHtml
              .split("<br>")
              .map((line, i, arr) =>
                i < arr.length - 1 ? [line, E("br")] : line,
              )
              .flat(),
          ),
          E("div", { class: "right" }, [
            UIRenderer.renderButton({
              label: "OK",
              onClick: ui.hideModal,
            }),
          ]),
        ]);
      },
    });

    const markReadButton = !inbox.read
      ? UIRenderer.renderButton({
          label: "Read",
          type: "neutral",
          size: "small",
          onClick: async () => {
            await DroidNet.exec([
              "content",
              "update",
              "--uri",
              `content://sms/${inbox._id}`,
              "--bind",
              "read:i:1",
            ]);
            location.reload();
          },
        })
      : null;

    return [
      readIcon,
      inbox.received.date,
      inbox.address,
      preview,
      `#${inbox.thread_id}`,
      inbox.sim_slot,
      E("div", [viewButton, markReadButton].filter(Boolean)),
    ];
  });

  return UIRenderer.renderTable(rows, {
    headers: ["", "Date", "From", "Message", "Thread", "SIM", "Actions"],
    cellClass: "td left",
    headerClass: "th left",
  });
}

function updateMessageTable(messages: InboxMessage[], display: number): void {
  const container = document.querySelector(".table-container") as HTMLElement;
  const prev = document.querySelector(".prev") as HTMLButtonElement;
  const next = document.querySelector(".next") as HTMLButtonElement;

  if (container) {
    container.innerHTML = "";
    const table = renderMessageTable(messages, display);
    container.appendChild(table);
  }

  const total = messages.length;
  const pages = Math.ceil(total / display);

  if (pages <= 1) {
    if (prev) prev.disabled = true;
    if (next) next.disabled = true;
  } else if (inboxCurrentPage <= 1) {
    if (prev) prev.disabled = true;
    if (next) next.disabled = false;
  } else if (inboxCurrentPage >= pages) {
    if (prev) prev.disabled = false;
    if (next) next.disabled = true;
  } else {
    if (prev) prev.disabled = false;
    if (next) next.disabled = false;
  }

  const start = (inboxCurrentPage - 1) * display + 1;
  const end = Math.min(start + display - 1, total);
  const pageInfo = document.getElementById("page-info");
  if (pageInfo) {
    pageInfo.innerText = (
      String as unknown as {
        format: (template: string, ...args: Array<string | number>) => string;
      }
    ).format(_("Displaying %s - %s of %s"), start, end, total);
  }
}

// eslint-disable-next-line max-lines-per-function
function renderInboxControls(
  messages: InboxMessage[],
  display: number,
): HTMLElement[] {
  const unreadCount = messages.filter((m) => !m.read).length;
  const threadCount = new Set(messages.map((m) => m.thread_id)).size;
  const simCards = Array.from(new Set(messages.map((m) => m.sim_slot))).sort();
  const savedSettings = loadFilterSettings();

  const applyFiltersHandler = () => {
    saveFilterSettings();
    applyFilters(
      messages,
      parseInt(
        (document.getElementById("per-page") as HTMLSelectElement).value,
      ),
    );
  };

  return [
    UIRenderer.renderTitle("Inbox Messages"),
    E(
      "div",
      { class: "cbi-section-descr" },
      `${messages.length} messages, ${unreadCount} unread, ${threadCount} conversations, ${simCards.length} SIM cards`,
    ),

    E(
      "div",
      { class: "filter-controls", style: "margin: 10px 0;" },
      UIRenderer.renderFilters([
        {
          label: "Filter",
          type: "select",
          id: "read-filter",
          style: "margin-right: 15px;",
          options: [
            { value: "all", label: "All Messages" },
            { value: "unread", label: `Unread (${unreadCount})` },
            { value: "read", label: `Read (${messages.length - unreadCount})` },
          ],
          onChange: applyFiltersHandler,
        },
        {
          label: "",
          type: "select",
          id: "sender-filter",
          style: "margin-right: 15px;",
          options: [
            { value: "all", label: "All Senders" },
            ...Array.from(new Set(messages.map((m) => m.address))).map(
              (sender) => ({
                value: sender,
                label: sender,
              }),
            ),
          ],
          onChange: applyFiltersHandler,
        },
        {
          label: "",
          type: "select",
          id: "sim-filter",
          style: "margin-right: 15px;",
          options: [
            { value: "all", label: "All SIMs" },
            ...simCards.map((sim) => ({ value: sim, label: sim })),
          ],
          onChange: applyFiltersHandler,
        },
        {
          label: "Per page",
          type: "select",
          id: "per-page",
          style: "margin-left: 20px; margin-right: 15px;",
          options: [
            { value: "5", label: "5" },
            { value: "10", label: "10" },
            { value: "20", label: "20" },
            { value: "50", label: "50" },
            { value: "100", label: "100" },
          ],
          onChange: applyFiltersHandler,
        },
      ]),
    ),

    // Pagination Controls
    E(
      "div",
      {
        class: "controls",
        style:
          "display: flex; flex-wrap: wrap; justify-content: space-around; padding: 1em 0;",
      },
      [
        UIRenderer.renderButton({
          label: "«",
          type: "neutral",
          class: "btn cbi-button-neutral prev",
          style: "flex-basis: 20%; text-align: center;",
          disabled: true,
          onClick: () => {
            inboxCurrentPage--;
            const newDisplay = parseInt(
              (document.getElementById("per-page") as HTMLSelectElement)
                ?.value || display.toString(),
            );
            updateMessageTable(getFilteredMessages(messages), newDisplay);
          },
        }),
        E(
          "div",
          {
            class: "text",
            id: "page-info",
            style: "flex-grow: 1; align-self: center; text-align: center;",
          },
          (
            String as unknown as {
              format: (
                template: string,
                ...args: Array<string | number>
              ) => string;
            }
          ).format(
            _("Displaying 1-%s of %s"),
            Math.min(display, messages.length),
            messages.length,
          ),
        ),
        UIRenderer.renderButton({
          label: "»",
          type: "neutral",
          class: "btn cbi-button-neutral next",
          style: "flex-basis: 20%; text-align: center;",
          onClick: () => {
            inboxCurrentPage++;
            const newDisplay = parseInt(
              (document.getElementById("per-page") as HTMLSelectElement)
                ?.value || display.toString(),
            );
            updateMessageTable(getFilteredMessages(messages), newDisplay);
          },
        }),
      ],
    ),
    E("div", { class: "table-container" }, [
      renderMessageTable(messages, parseInt(savedSettings.perPage) || display),
    ]),
  ];
}

function getFilteredMessages(messages: InboxMessage[]): InboxMessage[] {
  const readFilter =
    (document.getElementById("read-filter") as HTMLSelectElement)?.value ||
    "all";
  const senderFilter =
    (document.getElementById("sender-filter") as HTMLSelectElement)?.value ||
    "all";
  const simFilter =
    (document.getElementById("sim-filter") as HTMLSelectElement)?.value ||
    "all";

  const filtered = messages.filter((msg) => {
    const readMatch =
      readFilter === "all" ||
      (readFilter === "read" && msg.read) ||
      (readFilter === "unread" && !msg.read);
    const senderMatch = senderFilter === "all" || msg.address === senderFilter;
    const simMatch = simFilter === "all" || msg.sim_slot === simFilter;
    return readMatch && senderMatch && simMatch;
  });

  return filtered;
}

function applyFilters(messages: InboxMessage[], newDisplay: number): void {
  inboxCurrentPage = 1;
  const filtered = getFilteredMessages(messages);
  updateMessageTable(filtered, newDisplay);
}

// @ts-expect-error - LuCI baseclass expects a plain object map of methods.
return view.extend({
  handleSaveApply: null,
  handleSave: null,
  handleReset: null,

  load: DroidNet.load(loadInboxData),

  render: async function (data: InboxData): Promise<HTMLElement> {
    const deviceCheck = await UIRenderer.checkDeviceAndRender(data);
    if (deviceCheck) return deviceCheck;

    if (data.messages_section) {
      UIRenderer.addNotification(
        "Error: Device conflict!",
        "Please check your settings, the configured device and ADB devices are conflicting.",
        "danger",
      );

      const sections = [
        [
          E(
            "div",
            {
              class: "cbi-value",
              style: "text-align: center; display: block;",
            },
            [E("em", _("No device detected or connected."))],
          ),
        ],
      ];

      return UIRenderer.renderPage(sections);
    }

    if (data.messages_info) {
      UIRenderer.addNotification(
        "Error: Device not supported!",
        "Unable to read message because the device version cannot execute the command. Please ensure the device is rooted or has Android version 10 or above.",
        "danger",
      );

      const sections = [
        [
          UIRenderer.renderTitle("Error Information"),
          E(
            "textarea",
            {
              id: "syslog",
              class: "cbi-input-textarea",
              style: "height: 500px; overflow-y: scroll;",
              readonly: "readonly",
              wrap: "off",
              rows: 1,
            },
            data.messages_info,
          ),
        ],
      ];

      return UIRenderer.renderPage(sections);
    }

    const sections = [
      renderInboxControls(data.messages || [], data.display || 10),
    ];
    const page = UIRenderer.renderPage(sections);

    // Auto-apply saved filters after render
    setTimeout(() => {
      const savedSettings = loadFilterSettings();

      // Set dropdown values to saved settings
      const readFilter = document.getElementById(
        "read-filter",
      ) as HTMLSelectElement;
      const senderFilter = document.getElementById(
        "sender-filter",
      ) as HTMLSelectElement;
      const simFilter = document.getElementById(
        "sim-filter",
      ) as HTMLSelectElement;
      const perPage = document.getElementById("per-page") as HTMLSelectElement;

      if (readFilter) readFilter.value = savedSettings.readFilter;
      if (senderFilter) senderFilter.value = savedSettings.senderFilter;
      if (simFilter) simFilter.value = savedSettings.simFilter;
      if (perPage) perPage.value = savedSettings.perPage;

      applyFilters(
        data.messages || [],
        parseInt(savedSettings.perPage) || data.display || 10,
      );
    }, 100);

    return page;
  },
});
