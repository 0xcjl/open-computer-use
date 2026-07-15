#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const cliPath = fileURLToPath(new URL("../src/cli.ts", import.meta.url));
const require = createRequire(import.meta.url);
const tsxCli = require.resolve("tsx/cli");
const child = spawnSync(process.execPath, [tsxCli, cliPath, ...process.argv.slice(2)], { stdio: "inherit" });
if (child.error) throw child.error;
process.exitCode = child.status ?? 1;
