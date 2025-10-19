# Enhanced renderTable Usage

The `renderTable` method now supports two formats:

## 1. Label-Value Format (device.ts style)

```typescript
UIRenderer.renderTable([
  { label: "Device ID", value: data.device_id },
  { label: "Brand", value: data.brand },
  { label: "Model", value: data.model }
], { col: 2 });
```

**Output:** Traditional 2-column table with labels and values

## 2. Array Format (service.ts, inbox.ts style)

```typescript
UIRenderer.renderTable([
  ["Package Name", "Version", "UID", actionsElement],
  ["com.android.app", "1.0", "10001", actionsElement],
  ["com.google.app", "2.0", "10002", actionsElement]
], { 
  headers: ["Package", "Version", "UID", "Actions"]
});
```

**Output:** Standard table with headers and custom cells (including HTMLElements)

## Examples

### Service.ts - Application Table
```typescript
const rows = packages.map(pkg => [
  pkg.name,
  pkg.versionCode,
  pkg.uid,
  E("div", [
    E("button", { class: "btn", click: () => remove(pkg) }, "Remove"),
    E("button", { class: "btn", click: () => disable(pkg) }, "Disable")
  ])
]);

return UIRenderer.renderTable(rows, {
  headers: ["Package Name", "Version", "UID", "Actions"]
});
```

### Inbox.ts - Message Table
```typescript
const rows = messages.map(msg => [
  msg.address,
  msg.body,
  new Date(msg.date).toLocaleString(),
  msg.read ? "✓" : "✗"
]);

return UIRenderer.renderTable(rows, {
  headers: ["From", "Message", "Date", "Read"]
});
```

### Network.ts - Simple Data
```typescript
return UIRenderer.renderTable([
  { label: "Network capabilities", value: caps },
  { label: "DNS servers", value: dns }
]);
```

## Type Safety

```typescript
// Label-value format
type UITableRow = {
  label: string;
  value: string | number | boolean;
  action?: UIToggleAction;
}

// Array format
type UITableCell = string | number | boolean | HTMLElement;
type UITableArrayRow = UITableCell[];

// Config
interface UITableConfig {
  col?: number;              // For label-value format
  colSizeMap?: Record<number, number[]>;
  headers?: string[];        // For array format
  cellClass?: string;        // Custom cell class
}
```

## Benefits

- **One method** handles all table types
- **Type-safe** with proper TypeScript definitions
- **Flexible** - supports strings, numbers, and HTMLElements
- **Backward compatible** - existing code still works
