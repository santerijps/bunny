import $path from "node:path";
import * as $constants from "./constants";
import * as $util from "./util";
import $html_parser from "node-html-parser";
import type { AppConfig } from "./types";
import $chokidar from "chokidar";
import { try_process_page } from ".";
import Logger from "./util/logger";


export default function start_dev_server(config: AppConfig) {
  console.clear();
  console.warn(`\nDevelopment server running on http://127.0.0.1:${config.port}\n`);
  const event_service = new $util.EventService();
  start_file_watcher(config, event_service);
  const change_event_listeners: Record<string, () => void> = {};
  Bun.serve<{id: string}>({
    development: true,
    port: config.port,
    websocket: {
      open(ws) {
        change_event_listeners[ws.data.id] = () => ws.sendText("REFRESH");
        event_service.subscribe(change_event_listeners[ws.data.id]);
      },
      close(ws) {
        event_service.unsubscribe(change_event_listeners[ws.data.id]);
        delete change_event_listeners[ws.data.id];
      },
      message() {},
    },
    fetch: async (req, server) => {
      const url = new URL(req.url);
      if (is_websocket_upgrade_request(req)) {
        const id = url.searchParams.get("id");
        return server.upgrade(req, {data: {id}}) ? undefined : new Response("Failed to upgrade WebSocket!", {status: 500});
      }
      const url_path = url.pathname.endsWith("/") ? url.pathname + "index.html" : url.pathname;
      const file_path = $path.join(config.dst_dir_path, url_path);
      const file = Bun.file(file_path);
      if (await file.exists()) {
        Logger.http_ok(req.method, req.url);
        if (file.name && file.name.endsWith(".html")) {
          const text_content = add_websocket_client_script(await file.text(), config.port);
          const gzipped = Bun.gzipSync(Buffer.from(text_content));
          const headers = new Headers([
            ["Content-Encoding", "gzip"],
            ["Content-Length", gzipped.length.toString()],
            ["Content-Type", "text/html"],
          ]);
          return new Response(gzipped, {headers});
        } else {
          return new Response(file, {headers: new Headers([["Content-Type", file.type]])});
        }
      } else {
        Logger.http_not_found(req.method, req.url);
        return new Response("404 Not Found", {status: 404});
      }
    },
  });
}

function is_websocket_upgrade_request(req: Request) {
  const connection_header = req.headers.get("Connection") ?? "";
  const upgrade_header = req.headers.get("Upgrade") ?? "";
  const path = new URL(req.url).pathname;
  return (
    connection_header.match(/\bUpgrade\b/) !== null &&
    upgrade_header === "websocket" &&
    path.endsWith($constants.DEV_SERVER_WS_PATH)
  );
}

function generate_websocket_client_script(port: number) {
  return `
<script data-description="Bunny Dev Server WebSocket Implementation">
  /*
    Injected by BunSSG dev server (watch mode).
    It performs the following actions:
    - Refreshes the browser page whenever a change occurs in any of the project files
    - If the dev server is closed, waits for the dev server to open again and opens a new WebSocket connection
  */
  (() => {

    async function sleep(ms) {
      return new Promise((resolve) => {
        setTimeout(resolve, ms);
      });
    }

    function open_websocket_connection() {
      return new WebSocket("ws://localhost:${port}${$constants.DEV_SERVER_WS_PATH}?id=${crypto.randomUUID()}");
    }

    async function wait_for_open_websocket_connection() {
      while (true) {
        const ws = open_websocket_connection();
        await sleep(5000);
        if (ws.readyState === WebSocket.OPEN) {
          return ws;
        }
      }
    }

    function onmessage({data}) {
      if (data === "REFRESH") {
        window.location.reload(true);
      }
    }

    async function onclose() {
      ws = await wait_for_open_websocket_connection();
      ws.onmessage = onmessage;
      ws.onclose = onclose;
    }

    let ws = open_websocket_connection();
    ws.onmessage = onmessage;
    ws.onclose = onclose;

  })();
</script>`;
}

function add_websocket_client_script(html: string, port: number) {
  const doc = $html_parser.parse(html);
  const body = doc.querySelector("body");
  if (body === null) {
    throw new $util.BunnyError("[add_websocket_client_script] Failed to add WebSocket client script, body not found!");
  }
  body.innerHTML += generate_websocket_client_script(port);
  return doc.toString();
}

function start_file_watcher(config: AppConfig, event_service: $util.EventService) {
  $chokidar.watch(config.src_dir_path).on("all", async (event_name, absolute_file_path) => {
    if (event_name === "add" || event_name === "change") {
      if ($util.is_page_file(absolute_file_path)) {
        const page = $util.resolve_page(absolute_file_path, config);
        await try_process_page(page, config);
      }
    }
    event_service.publish();
  });
}
