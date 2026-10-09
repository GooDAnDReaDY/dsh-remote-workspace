import test from "node:test";
import assert from "node:assert/strict";
import { isNewerVersion, isTrustedUpdateRequest, buildInstallArgs } from "../lib/updater-service.js";

test("Updater: isNewerVersion correctly compares versions", () => {
  assert.equal(isNewerVersion("0.3.1", "0.3.2"), true);
  assert.equal(isNewerVersion("0.3.1", "0.4.0"), true);
  assert.equal(isNewerVersion("0.3.1", "1.0.0"), true);
  assert.equal(isNewerVersion("0.3.1", "0.3.1"), false);
  assert.equal(isNewerVersion("0.3.2", "0.3.1"), false);
  assert.equal(isNewerVersion("0.3.1-rc.1", "0.3.1-rc.2"), true);
  assert.equal(isNewerVersion("0.3.1-rc.2", "0.3.1"), true);
});

test("Updater: isTrustedUpdateRequest rejects cross-origin and untrusted requests", () => {
  const badReq = {
    headers: {
      "sec-fetch-site": "cross-site",
      "host": "203.0.113.10:3000"
    },
    socket: { remoteAddress: "8.8.8.8" }
  };
  assert.equal(isTrustedUpdateRequest(badReq), false);

  const missingHeaderReq = {
    headers: {
      "sec-fetch-site": "same-origin",
      "host": "localhost:3000",
      "origin": "http://localhost:3000"
    },
    socket: { remoteAddress: "127.0.0.1" }
  };
  assert.equal(isTrustedUpdateRequest(missingHeaderReq), false);

  const goodLocalReq = {
    headers: {
      "x-dsh-plugin-update": "1",
      "sec-fetch-site": "same-origin",
      "host": "localhost:3000",
      "origin": "http://localhost:3000"
    },
    socket: { remoteAddress: "127.0.0.1" }
  };
  assert.equal(isTrustedUpdateRequest(goodLocalReq), true);

  const privateLanReq = {
    headers: {
      "x-dsh-plugin-update": "1",
      "sec-fetch-site": "same-origin",
      "host": "10.1.2.3:3000",
      "origin": "http://10.1.2.3:3000"
    },
    socket: { remoteAddress: "10.1.2.3" }
  };
  assert.equal(isTrustedUpdateRequest(privateLanReq), false);
});

test("Updater [Fixes #106]: buildInstallArgs preserves pnpm minimumReleaseAge supply chain guard", () => {
  const target = { cliEntry: "/usr/bin/dsh", profileName: "web" };
  const args = buildInstallArgs(target, "@goodandready/dsh-remote-workspace@0.4.0", { registry: "https://registry.npmjs.org/" });

  // Must NOT include --config.minimumReleaseAge=0
  assert.equal(
    args.includes("--config.minimumReleaseAge=0"),
    false,
    "Must not bypass pnpm supply-chain minimumReleaseAge guard"
  );
  assert.equal(
    args.some((a) => a.includes("minimumReleaseAge")),
    false,
    "No minimumReleaseAge override flag should be passed"
  );

  // Must include standard plugin add arguments
  assert.deepEqual(args.slice(0, 5), ["/usr/bin/dsh", "plugin", "--profile", "web", "add"]);
  assert.equal(args[5], "@goodandready/dsh-remote-workspace@0.4.0");
  assert.equal(args[6], "--registry=https://registry.npmjs.org/");
});
