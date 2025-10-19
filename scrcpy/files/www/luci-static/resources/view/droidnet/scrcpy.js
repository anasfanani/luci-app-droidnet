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

const getInitList = rpc.declare({
  object: "luci",
  method: "getInitList",
  params: ["name"],
  expect: { "": {} },
});

return view.extend(
  DroidNet.createView({
    load: async function () {
      await uci.load("droidnet-scrcpy");

      const enabled = uci.get("droidnet-scrcpy", "server", "enabled") === "1";
      const port = uci.get("droidnet-scrcpy", "server", "port") || "8000";

      const initStatus = await getInitList("droidnet-scrcpy");
      const running = initStatus && initStatus["droidnet-scrcpy"] && initStatus["droidnet-scrcpy"].running === true;

      return {
        enabled: enabled,
        running: running,
        port: port,
        deviceId: uci.get("droidnet", "device", "id"),
      };
    },

    render: function (data) {
      const statusSection = [
        UIRenderer.renderTitle("Service Status"),
        UIRenderer.renderTable(
          [
            { label: "Status", value: data.running ? "Running" : "Stopped" },
            { label: "Port", value: data.port },
            { label: "Device ID", value: data.deviceId || "Not configured" },
          ],
          { col: 6 }
        ),
        E("div", { style: "margin-top: 10px;" }, [
          UIRenderer.renderButton({
            label: data.running ? "Stop Service" : "Start Service",
            type: data.running ? "remove" : "save",
            onClick: async function() {
              UIRenderer.modalLoading(
                data.running ? "Stopping service..." : "Starting service..."
              );

              await callInitAction(
                "droidnet-scrcpy",
                data.running ? "stop" : "start"
              );

              setTimeout(function() {
                window.location.reload();
              }, 2000);
            },
          }),
          UIRenderer.renderButton({
            label: "Restart Service",
            type: "action",
            style: "margin-left: 10px;",
            onClick: async function() {
              UIRenderer.modalLoading("Restarting service...");
              await callInitAction("droidnet-scrcpy", "restart");
              setTimeout(function() { window.location.reload(); }, 2000);
            },
          }),
        ]),
      ];

      if (!data.running) {
        return UIRenderer.renderPage([statusSection], UIRenderer.header);
      }

      const scrcpyUrl = "http://" + window.location.hostname + ":" + data.port + "/?action=stream&udid=" + data.deviceId;

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
              "Click here to open in fullscreen"
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

      return UIRenderer.renderPage([statusSection, viewerSection], UIRenderer.header);
    },
  })
);
