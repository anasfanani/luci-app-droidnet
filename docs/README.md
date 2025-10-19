# DroidNet Documentation

Documentation for the DroidNet LuCI application.

## Available Documentation

- **[UIRenderer.md](UIRenderer.md)** - Complete UIRenderer component library reference
  - Tables, buttons, forms, modals, notifications
  - New components: Progress bars, badges, tooltips, alerts
  - Examples and best practices

## Quick Links

### Components
- [Tables](UIRenderer.md#tables)
- [Buttons](UIRenderer.md#buttons)
- [Forms](UIRenderer.md#forms)
- [Modals](UIRenderer.md#modals)
- [Progress Bars](UIRenderer.md#renderprogressbarconfig)
- [Badges](UIRenderer.md#renderbadgeconfig)
- [Tooltips](UIRenderer.md#rendertooltipconfig)

### Examples
- [Complete Page Example](UIRenderer.md#complete-example)
- [Battery Level with Progress Bar](UIRenderer.md#example-battery-level)
- [Connection Status with Badge](UIRenderer.md#example-connection-status)
- [Signal Strength with Tooltip](UIRenderer.md#example-signal-strength)

## Getting Started

```typescript
import UIRenderer from "tools/ui-renderer";

// Simple table
UIRenderer.renderTable([
  { label: "Device", value: "Samsung Galaxy" },
  { label: "Status", value: "Connected" }
], { col: 6 });

// Progress bar
UIRenderer.renderProgressBar({
  value: 75,
  showPercent: true
});

// Badge
UIRenderer.renderBadge({
  text: "Active",
  type: "success"
});
```

## Contributing

When adding new components to UIRenderer:
1. Add the component implementation
2. Update UIRenderer.md with documentation
3. Include usage examples
4. Add TypeScript types
5. Test with different themes
