// @vitest-environment node

import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_GATEWAY_URL,
  getOfficeConfigPath,
  resolveConfig,
  writePersistedOfficeConfig,
} from "../../../bin/openclaw-office-config.js";

const tempDirs: string[] = [];

afterEach(() => {
  tempDirs.length = 0;
});

function makeHomeDir() {
  const dir = mkdtempSync(join(tmpdir(), "openclaw-office-test-"));
  tempDirs.push(dir);
  return dir;
}

describe("openclaw office config resolution", () => {
  it("uses the default localhost gateway when no overrides exist", () => {
    const homeDir = makeHomeDir();

    const config = resolveConfig({ argv: [], env: {}, homeDir });

    expect(config.gatewayUrl).toBe(DEFAULT_GATEWAY_URL);
    expect(config.gatewayUrlSource).toBe("default");
    expect(config.shouldPersistGatewayUrl).toBe(false);
  });

  it("reuses the persisted gateway URL when present", () => {
    const homeDir = makeHomeDir();
    const configPath = getOfficeConfigPath(homeDir);
    writePersistedOfficeConfig("ws://persisted.example:18789", configPath);

    const config = resolveConfig({ argv: [], env: {}, homeDir });

    expect(config.gatewayUrl).toBe("ws://persisted.example:18789");
    expect(config.gatewayUrlSource).toBe(configPath);
    expect(config.shouldPersistGatewayUrl).toBe(false);
  });

  it("prefers env over persisted config and marks the new value for persistence", () => {
    const homeDir = makeHomeDir();
    const configPath = getOfficeConfigPath(homeDir);
    writePersistedOfficeConfig("ws://persisted.example:18789", configPath);

    const config = resolveConfig({
      argv: [],
      env: { OPENCLAW_GATEWAY_URL: "ws://env.example:18789" },
      homeDir,
    });

    expect(config.gatewayUrl).toBe("ws://env.example:18789");
    expect(config.gatewayUrlSource).toBe("OPENCLAW_GATEWAY_URL env");
    expect(config.shouldPersistGatewayUrl).toBe(true);
  });

  it("prefers CLI over env and writes the selected address", () => {
    const homeDir = makeHomeDir();
    const configPath = getOfficeConfigPath(homeDir);

    const config = resolveConfig({
      argv: ["--gateway", "ws://cli.example:18789"],
      env: { OPENCLAW_GATEWAY_URL: "ws://env.example:18789" },
      homeDir,
    });

    expect(config.gatewayUrl).toBe("ws://cli.example:18789");
    expect(config.gatewayUrlSource).toBe("command line --gateway");
    expect(config.shouldPersistGatewayUrl).toBe(true);

    writePersistedOfficeConfig(config.gatewayUrl, config.officeConfigPath);
    const stored = JSON.parse(readFileSync(configPath, "utf-8")) as { gatewayUrl: string };
    expect(stored.gatewayUrl).toBe("ws://cli.example:18789");
  });
});
