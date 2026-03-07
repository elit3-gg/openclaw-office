import { describe, expect, it } from "vitest";
import { resolveGatewayWebSocketUrl } from "../gateway-url";

const browserLocation = {
  host: "office.example:5180",
  protocol: "http:",
};

describe("resolveGatewayWebSocketUrl", () => {
  it("defaults to the same-origin proxy endpoint", () => {
    expect(resolveGatewayWebSocketUrl(undefined, browserLocation)).toBe(
      "ws://office.example:5180/gateway-ws",
    );
  });

  it("converts proxy paths into absolute same-origin websocket URLs", () => {
    expect(resolveGatewayWebSocketUrl("/gateway-ws", browserLocation)).toBe(
      "ws://office.example:5180/gateway-ws",
    );
  });

  it("preserves explicit websocket URLs", () => {
    expect(
      resolveGatewayWebSocketUrl("ws://upstream.example:18789", browserLocation),
    ).toBe("ws://upstream.example:18789");
  });
});
