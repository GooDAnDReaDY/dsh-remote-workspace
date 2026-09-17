import test from "node:test";
import assert from "node:assert/strict";
import { isNewerVersion, isTrustedUpdateRequest } from "../lib/updater-service.js";

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
      "host": "192.168.1.111:3000"
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
});
