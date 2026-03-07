// @vitest-environment node

import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import type { Duplex } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";
import {
  createOfficeServer,
  createRuntimeConfigScript,
} from "../../../bin/openclaw-office-server.js";

const openSockets = new Set<Duplex>();
const openServers = new Set<import("node:http").Server>();

afterEach(async () => {
  for (const socket of openSockets) {
    socket.destroy();
  }
  openSockets.clear();

  await Promise.all(
    [...openServers].map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => {
            if (error) {
              reject(error);
              return;
            }
            resolve();
          });
        }),
    ),
  );
  openServers.clear();
});

function createTempDistDir() {
  const dir = mkdtempSync(join(tmpdir(), "openclaw-office-dist-"));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), "<html><head></head><body>ok</body></html>", "utf-8");
  return dir;
}

function encodeTextFrame(text: string) {
  const payload = Buffer.from(text, "utf-8");
  return Buffer.concat([Buffer.from([0x81, payload.length]), payload]);
}

function decodeMaskedTextFrame(frame: Buffer) {
  const payloadLength = frame[1] & 0x7f;
  const maskOffset = 2;
  const dataOffset = maskOffset + 4;
  const mask = frame.subarray(maskOffset, dataOffset);
  const payload = frame.subarray(dataOffset, dataOffset + payloadLength);
  const decoded = Buffer.alloc(payloadLength);
  for (let index = 0; index < payloadLength; index++) {
    decoded[index] = payload[index] ^ mask[index % 4];
  }
  return decoded.toString("utf-8");
}

async function listen(server: import("node:http").Server) {
  await new Promise<void>((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => resolve());
    server.once("error", reject);
  });
  openServers.add(server);
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected TCP server address");
  }
  return address.port;
}

describe("openclaw office server", () => {
  it("injects the Office-hosted proxy path into runtime config", () => {
    const script = createRuntimeConfigScript({
      browserGatewayUrl: "/gateway-ws",
      token: "secret",
    });

    expect(script).toContain('"gatewayUrl":"/gateway-ws"');
    expect(script).toContain('"gatewayToken":"secret"');
  });

  it("proxies websocket traffic to the configured upstream gateway", async () => {
    const upstreamServer = createServer();
    upstreamServer.on("upgrade", (req, socket) => {
      openSockets.add(socket);
      const key = req.headers["sec-websocket-key"];
      const accept = createHash("sha1")
        .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
        .digest("base64");

      socket.write(
        [
          "HTTP/1.1 101 Switching Protocols",
          "Upgrade: websocket",
          "Connection: Upgrade",
          `Sec-WebSocket-Accept: ${accept}`,
          "",
          "",
        ].join("\r\n"),
      );

      socket.on("data", (frame) => {
        const message = decodeMaskedTextFrame(frame);
        socket.write(encodeTextFrame(`echo:${message}`));
      });
    });
    const upstreamPort = await listen(upstreamServer);

    const distDir = createTempDistDir();
    const { server: officeServer } = createOfficeServer({
      config: {
        gatewayUrl: `ws://127.0.0.1:${upstreamPort}`,
        browserGatewayUrl: "/gateway-ws",
        token: "",
      },
      distDir,
    });
    const officePort = await listen(officeServer);

    const message = await new Promise<string>((resolve, reject) => {
      const socket = new WebSocket(`ws://127.0.0.1:${officePort}/gateway-ws`);

      socket.addEventListener("open", () => {
        socket.send("hello");
      });
      socket.addEventListener("message", (event) => {
        resolve(String(event.data));
        socket.close();
      });
      socket.addEventListener("error", () => {
        reject(new Error("websocket proxy connection failed"));
      });
    });

    expect(message).toBe("echo:hello");
  });
});
