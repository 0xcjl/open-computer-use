#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = process.argv[2] ?? path.join(os.tmpdir(), "OpenComputerUseFixture.app");
const executable = path.join(output, "Contents", "MacOS", "OpenComputerUseFixture");
await fs.mkdir(path.dirname(executable), { recursive: true });
const result = spawnSync("xcrun", ["swiftc", path.join(root, "fixtures", "macos", "OpenComputerUseFixture.swift"), "-framework", "AppKit", "-o", executable], { stdio: "inherit" });
if (result.status !== 0) process.exit(result.status ?? 1);
await fs.writeFile(path.join(output, "Contents", "Info.plist"), `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>CFBundleIdentifier</key><string>com.0xcjl.open-computer-use.fixture</string><key>CFBundleName</key><string>Open Computer Use Fixture</string><key>CFBundleExecutable</key><string>OpenComputerUseFixture</string><key>CFBundlePackageType</key><string>APPL</string></dict></plist>`);
console.log(output);
