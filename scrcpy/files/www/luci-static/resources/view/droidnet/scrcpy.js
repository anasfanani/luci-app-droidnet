"use strict";
"require view";
"require ui";
"require uci";
"require rpc";
"require tools/droidnet as DroidNet";
"require tools/ui-renderer as UIRenderer";

const callInitAction = rpc.declare({
  object: "luci",
  method: "setInitAction",
  params: ["name", "action"],
  expect: { result: false },
});

return view.extend(
  DroidNet.createView({
    load: async function () {
      await uci.load("droidnet-scrcpy");

      const enabled = uci.get("droidnet-scrcpy", "server", "enabled") === "1";
      const port = uci.get("droidnet-scrcpy", "server", "port") || "8000";

      const status = await DroidNet.exec(["pgrep", "-f", "ws-scrcpy"]);
      const running = status.code === 0;

      return {
        enabled,
        running,
        port,
        deviceId: uci.get("droidnet", "device", "id"),
      };
    },

    render: function (data: {
      enabled: boolean;
      running: boolean;
      port: string;
      deviceId: string;
    }) {
      const serviceStatus = data.running
        ? UIRenderer.renderBadge({ text: "Running", type: "success" })
        : UIRenderer.renderBadge({ text: "Stopped", type: "danger" });

      const controlButtons = [
        UIRenderer.renderButton({
          label: data.running ? "Stop Service" : "Start Service",
          type: data.running ? "remove" : "save",
          onClick: async () => {
            UIRenderer.modalLoading(
              data.running ? "Stopping service..." : "Starting service..."
            );

            await callInitAction(
              "droidnet-scrcpy",
              data.running ? "stop" : "start",
            );

            setTimeout(() => {
              window.location.reload();
            }, 2000);
          },
        }),
        UIRenderer.renderButton({
          label: "Restart Service",
          type: "action",
          style: "margin-left: 10px;",
          onClick: async () => {
            UIRenderer.modalLoading("Restarting service...");
            await callInitAction("droidnet-scrcpy", "restart");
            setTimeout(() => window.location.reload(), 2000);
          },
        }),
      ];

      const statusSection = [
        UIRenderer.renderTitle("Service Status"),
        UIRenderer.renderTable(
          [
            { label: "Status", value: serviceStatus },
            { label: "Port", value: data.port },
            { label: "Device ID", value: data.deviceId || "Not configured" },
          ],
          { col: 6 },
        ),
        E("div", { style: "margin-top: 10px;" }, controlButtons),
      ];

      if (!data.running) {
        return UIRenderer.renderPage([statusSection]);
      }

      const scrcpyUrl = `http://${window.location.hostname}:${data.port}/?action=stream&udid=${data.deviceId}`;

      const viewerSection = [
        UIRenderer.renderTitle("Screen Mirror"),
        E("div", { class: "cbi-section" }, [
          E("p", {}, [
            "Control your Android device from the browser. ",
            E(
              "a",
              {
                href: scrcpyUrl,
                target: "_blank",
                style: "font-weight: bold;",
              },
              "Click here to open in fullscreen",
            ),
            ".",
          ]),
          E("iframe", {
            src: scrcpyUrl,
            style:
              "width: 100%; height: 700px; border: 1px solid #ccc; border-radius: 4px;",
            allow: "autoplay; fullscreen",
          }),
        ]),
      ];

      return UIRenderer.renderPage([statusSection, viewerSection]);
    },
  }),
);
