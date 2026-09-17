import test from "node:test";
import assert from "node:assert/strict";
import { VaultService } from "../lib/vault-service.js";
import { apply } from "../lib/index.js";

function createMockReq(method, path, body = null) {
  const listeners = {};
  return {
    method,
    url: path,
    headers: { "sec-fetch-site": "same-origin" },
    on(event, cb) {
      listeners[event] = cb;
      if (event === "end") {
        process.nextTick(() => {
          if (body !== null && listeners["data"]) {
            listeners["data"](Buffer.from(typeof body === "string" ? body : JSON.stringify(body)));
          }
          cb();
        });
      }
    },
    destroy() {}
  };
}

function createMockRes() {
  let statusCode = 200;
  let body = "";
  return {
    writeHead(code) { statusCode = code; },
    setHeader() {},
    end(data) { if (data) body += data; },
    getStatusCode() { return statusCode; },
    getBody() { return body ? JSON.parse(body) : null; }
  };
}

test("VaultService: tracks permission errors when restricted path cannot be protected", () => {
  const vault = new VaultService("/proc/non-existent-vault.env");
  const status = vault.getPermissionStatus();
  assert.equal(status.secure, false);
  assert.ok(status.error, "Permission error must be recorded");
});

test("Core & Routes: saveProfile fails with 500 when settingsApi.replace fails", async () => {
  const routes = new Map();
  let replaceAttempted = false;

  const mockSettingsScope = {
    get: () => ({ profiles: [{ id: "p1", name: "Server 1", host: "1.2.3.4" }], activeProfileId: "p1" }),
    replace: async () => {
      replaceAttempted = true;
      throw new Error("Disk quota exceeded / read-only settings");
    }
  };

  const mockCtx = {
    inject(deps, cb) {
      if (deps.includes("settings")) {
        cb({
          settings: {
            register: () => mockSettingsScope
          },
          effect: (fn) => fn()
        });
      }
      if (deps.includes("webServer")) {
        cb({
          webServer: {
            register(opts) {
              routes.set(opts.path, opts.handler);
              return () => {};
            }
          },
          effect: (fn) => fn()
        });
      }
    },
    provide() {},
    on() {},
    tools: { register() {} },
    logger: { warn() {} }
  };

  apply(mockCtx, { profiles: [{ id: "p1", name: "Server 1", host: "1.2.3.4" }] });

  const saveHandler = routes.get("/dsh-remote-workspace/profiles/save");
  assert.ok(saveHandler, "save route must be registered");

  const req = createMockReq("POST", "/dsh-remote-workspace/profiles/save", { id: "p1", host: "1.2.3.4", name: "Updated Server" });
  const res = createMockRes();

  await saveHandler(req, res);

  assert.ok(replaceAttempted, "settings replace should have been attempted");
  assert.equal(res.statusCode, 500, "Failing to persist config must return 500");
  assert.equal(res.getBody()?.ok, false);
  assert.match(res.getBody()?.error, /Failed to save configuration/);
});
