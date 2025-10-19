# UIRenderer Documentation

Complete reference for the UIRenderer component library.

## Table of Contents

- [Tables](#tables)
- [Titles](#titles)
- [Buttons](#buttons)
- [Forms](#forms)
- [Navigation](#navigation)
- [Modals](#modals)
- [Notifications](#notifications)
- [New Components](#new-components)

---

## Tables

### renderTable(rows, config)

Renders a table with automatic CBI styling and row striping.

**Parameters:**
- `rows`: Array of row data (supports two formats)
- `config`: Configuration object

**Format 1: Label-Value Pairs**
```typescript
UIRenderer.renderTable([
  { label: "Device", value: "Samsung Galaxy" },
  { label: "Status", value: "Connected" }
], { col: 6 });
```

**Format 2: Array Format**
```typescript
UIRenderer.renderTable([
  ["Device 1", "192.168.1.1", "Active"],
  ["Device 2", "192.168.1.2", "Inactive"]
], {
  headers: ["Name", "IP Address", "Status"],
  cellClass: "td left",
  headerClass: "th left"
});
```

**Config Options:**
- `col`: Number of columns (2, 4, or 6)
- `headers`: Array of header labels
- `cellClass`: CSS class for cells
- `headerClass`: CSS class for headers

---

## Titles

### renderTitle(title)

Renders a section title with consistent styling.

```typescript
UIRenderer.renderTitle("Network Information")
// Output: <h3 class="section-title">Network Information</h3>
```

---

## Buttons

### renderButton(config)

Renders a button with CBI theming.

```typescript
UIRenderer.renderButton({
  label: "Save",
  type: "save",        // save, remove, action, neutral
  size: "small",       // small, normal
  onClick: () => {},
  disabled: false,
  style: "margin: 5px;",
  class: "custom-class"
})
```

**Button Types:**
- `save` / `positive` - Green button (cbi-button-save)
- `remove` / `negative` - Red button (cbi-button-remove)
- `action` / `primary` - Blue button (cbi-button-action)
- `neutral` - Gray button (cbi-button-neutral)

---

## Forms

### renderInput(config)

Renders an input field.

```typescript
UIRenderer.renderInput({
  type: "text",           // text, password, number, email
  id: "username",
  value: "",
  placeholder: "Enter username...",
  class: "cbi-input-text",
  onChange: (value) => console.log(value)
})
```

### renderTextarea(config)

Renders a textarea field.

```typescript
UIRenderer.renderTextarea({
  id: "description",
  rows: 5,
  readonly: false,
  class: "cbi-input-textarea",
  style: "width: 100%;"
})
```

### renderCheckbox(config)

Renders a checkbox with optional label.

```typescript
UIRenderer.renderCheckbox({
  id: "enable-feature",
  checked: true,
  label: "Enable this feature",
  onChange: (checked) => console.log(checked)
})
```

### renderSelect(config)

Renders a dropdown select.

```typescript
UIRenderer.renderSelect({
  id: "device-select",
  options: [
    { value: "1", label: "Device 1" },
    { value: "2", label: "Device 2" }
  ],
  selected: "1",
  class: "cbi-input-select",
  onChange: (value) => console.log(value)
})
```

### renderLabel(config)

Renders a form label.

```typescript
UIRenderer.renderLabel({
  text: "Username",
  for: "username-input",
  style: "font-weight: bold;",
  suffix: ":"          // Default: " : "
})
```

---

## Navigation

### renderTab(tabs)

Renders a tabbed interface.

```typescript
UIRenderer.renderTab([
  {
    tabId: "overview",
    tabTitle: "Overview",
    tabContent: E("div", {}, "Overview content"),
    active: true
  },
  {
    tabId: "settings",
    tabTitle: "Settings",
    tabContent: E("div", {}, "Settings content")
  }
])
```

### renderFilters(filters)

Renders filter controls (search, select, buttons).

```typescript
UIRenderer.renderFilters([
  {
    type: "input",
    id: "search",
    placeholder: "Search...",
    onChange: (e) => filterData(e.target.value)
  },
  {
    type: "select",
    id: "category",
    options: [
      { value: "all", label: "All" },
      { value: "active", label: "Active" }
    ],
    onChange: (e) => filterByCategory(e.target.value)
  },
  {
    type: "button",
    label: "Reset",
    onClick: () => resetFilters()
  }
])
```

---

## Modals

### modalLoading(message)

Shows a loading modal with spinner.

```typescript
UIRenderer.modalLoading("Processing...");
```

### modalSuccess(message, details)

Shows a success modal.

```typescript
UIRenderer.modalSuccess(
  "Operation completed",
  "Device has been configured successfully"
);
```

### modalError(message, errorDetails)

Shows an error modal.

```typescript
UIRenderer.modalError(
  "Operation failed",
  "Connection timeout: Unable to reach device"
);
```

### confirmAction(title, message, callback)

Shows a confirmation dialog.

```typescript
UIRenderer.confirmAction(
  "Delete Device",
  "Are you sure you want to delete this device?",
  () => {
    // User clicked "Yes"
    deleteDevice();
  }
);
```

---

## Notifications

### addNotification(title, message, type)

Shows a notification toast.

```typescript
UIRenderer.addNotification(
  "Connection Status",
  "Device connected successfully",
  "info"    // info, warning, danger
);
```

**Types:**
- `info` - Blue notification with ℹ️ icon
- `warning` - Yellow notification with ⚠️ icon
- `danger` - Red notification with ❌ icon

---

## New Components

### renderProgressBar(config)

Renders a progress bar with CBI styling.

```typescript
UIRenderer.renderProgressBar({
  value: 75,              // 0-100
  label: "Loading...",
  showPercent: true,
  class: "custom-class"
})
```

**Example: Battery Level**
```typescript
{
  label: "Battery",
  value: UIRenderer.renderProgressBar({
    value: batteryLevel,
    showPercent: true
  })
}
```

### renderBadge(config)

Renders a colored badge/label.

```typescript
UIRenderer.renderBadge({
  text: "Active",
  type: "success"    // success, danger, warning, info, default
})
```

**Badge Types:**
- `success` - Green badge (label-success)
- `danger` - Red badge (label-danger)
- `warning` - Yellow badge (label-warning)
- `info` - Blue badge (label-info)
- `default` - Gray badge

**Example: Connection Status**
```typescript
{
  label: "Status",
  value: UIRenderer.renderBadge({
    text: connected ? "Connected" : "Disconnected",
    type: connected ? "success" : "danger"
  })
}
```

### renderTooltip(config)

Renders text with a tooltip on hover.

```typescript
UIRenderer.renderTooltip({
  text: "Signal: -75 dBm",
  tooltip: "RSRP: -95, RSRQ: -12, SINR: 8"
})
```

**Example: Signal Strength**
```typescript
{
  label: "Signal",
  value: UIRenderer.renderTooltip({
    text: `${rssi} dBm`,
    tooltip: `RSRP: ${rsrp}, RSRQ: ${rsrq}, SINR: ${sinr}`
  })
}
```

### renderAlert(config)

Renders an alert box.

```typescript
UIRenderer.renderAlert({
  message: "Device requires firmware update",
  type: "warning",        // info, warning, danger, success
  dismissible: true
})
```

---

## Page Layout

### renderPage(sections, header)

Renders a complete page with CBI structure.

```typescript
UIRenderer.renderPage([
  [
    UIRenderer.renderTitle("Section 1"),
    UIRenderer.renderTable(data1)
  ],
  [
    UIRenderer.renderTitle("Section 2"),
    UIRenderer.renderTable(data2)
  ]
], customHeader);
```

**Default Header:**
```typescript
UIRenderer.header  // Returns default DroidNet header
```

---

## Advanced Features

### createToggleAction(service, enableCmd, disableCmd, execFunction, options)

Creates a toggle action for enable/disable operations.

```typescript
const toggleAction = UIRenderer.createToggleAction(
  "WiFi",
  ["svc", "wifi", "enable"],
  ["svc", "wifi", "disable"],
  async (cmd) => await DroidNet.exec(cmd),
  {
    onSuccess: (message) => {
      UIRenderer.modalSuccess(message);
    },
    onFailed: (error) => {
      UIRenderer.modalError("Operation failed", error);
    },
    validator: (result) => result.code === 0
  }
);

// Use in table
{
  label: "WiFi",
  value: wifiEnabled,
  action: toggleAction
}
```

---

## Complete Example

```typescript
async function load() {
  const data = await fetchDeviceData();
  return data;
}

function render(data) {
  return UIRenderer.renderPage([
    [
      UIRenderer.renderTitle("Device Status"),
      UIRenderer.renderTable([
        {
          label: "Connection",
          value: UIRenderer.renderBadge({
            text: data.connected ? "Connected" : "Disconnected",
            type: data.connected ? "success" : "danger"
          })
        },
        {
          label: "Battery",
          value: UIRenderer.renderProgressBar({
            value: data.batteryLevel,
            showPercent: true
          })
        },
        {
          label: "Signal",
          value: UIRenderer.renderTooltip({
            text: `${data.rssi} dBm`,
            tooltip: `RSRP: ${data.rsrp}, RSRQ: ${data.rsrq}`
          })
        }
      ], { col: 6 })
    ],
    [
      UIRenderer.renderTitle("Network Information"),
      UIRenderer.renderTable([
        ["Interface", "IP Address", "Status"],
        ["wlan0", "192.168.1.100", "Active"],
        ["rmnet0", "10.0.0.1", "Active"]
      ], {
        headers: ["Interface", "IP", "Status"]
      })
    ]
  ]);
}

return view.extend(
  DroidNet.createView({ load, render })
);
```

---

## CSS Classes Reference

### CBI Classes
- `cbi-map` - Main page container
- `cbi-section` - Section container
- `cbi-section-table` - Table styling
- `cbi-button` - Button base class
- `cbi-button-save` - Green button
- `cbi-button-remove` - Red button
- `cbi-button-action` - Blue button
- `cbi-button-neutral` - Gray button
- `cbi-input-text` - Text input
- `cbi-input-select` - Select dropdown
- `cbi-input-textarea` - Textarea
- `cbi-progressbar` - Progress bar container
- `cbi-tabmenu` - Tab navigation
- `cbi-tab` - Active tab
- `cbi-tab-disabled` - Inactive tab

### Label Classes
- `label` - Badge base class
- `label-success` - Green badge
- `label-danger` - Red badge
- `label-warning` - Yellow badge
- `label-info` - Blue badge

### Alert Classes
- `alert` - Alert box base
- `alert-info` - Blue alert
- `alert-warning` - Yellow alert
- `alert-danger` - Red alert
- `alert-success` - Green alert

---

## Best Practices

1. **Use appropriate button types** - `save` for positive actions, `remove` for destructive actions
2. **Add tooltips for complex data** - Help users understand technical information
3. **Use badges for status** - Visual indicators are easier to scan than text
4. **Show progress for long operations** - Use progress bars or loading modals
5. **Validate user input** - Use confirmAction for destructive operations
6. **Provide feedback** - Use notifications for operation results
7. **Keep tables readable** - Use appropriate column counts (6 for dense data, 2 for simple key-value)

---

## TypeScript Types

```typescript
interface UITableRow {
  label: string;
  value: string | number | HTMLElement;
  action?: UIToggleAction;
}

interface UITableConfig {
  col?: number;
  headers?: string[];
  cellClass?: string;
  headerClass?: string;
}

interface UITabConfig {
  tabId: string;
  tabTitle: string;
  tabContent: HTMLElement;
  active?: boolean;
}

interface UIFilterConfig {
  type: "input" | "select" | "button";
  id?: string;
  label?: string;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  onChange?: (e: Event) => void;
  onClick?: () => void;
}
```
