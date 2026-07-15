#!/usr/bin/env node
import assert from "node:assert/strict";
import { platformBackendForRuntime } from "../src/platform/index.ts";
import { assertPlatformArchitecture, PLATFORM_ARCHITECTURE_VERSION, REQUIRED_PLATFORM_INVARIANTS } from "../src/platform/architecture.ts";

const win = platformBackendForRuntime("win32");
assert.equal(win.name, "windows");
await assert.rejects(win.ensureReady(), /macOS only/);

const mac = platformBackendForRuntime("darwin");
assert.equal(mac.name, "macos");
assert.equal(typeof mac.ensureReady, "function");
assert.equal(typeof mac.listApps, "function");
assert.equal(typeof mac.listRoots, "function");
assert.equal(typeof mac.observe, "function");
assert.equal(typeof mac.act, "function");
assert.equal(typeof mac.actBatch, "function");

const conforming = {
	protocolVersion: 1,
	pid: 1,
	architectureVersion: PLATFORM_ARCHITECTURE_VERSION,
	invariants: [...REQUIRED_PLATFORM_INVARIANTS],
};
assert.doesNotThrow(() => assertPlatformArchitecture("fixture", conforming));
assert.throws(
	() => assertPlatformArchitecture("fixture", { ...conforming, invariants: conforming.invariants.slice(1) }),
	/shared computer-use contract/,
);

console.log("platform checks passed");
