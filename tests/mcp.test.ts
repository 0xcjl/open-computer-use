import assert from "node:assert/strict";
import test from "node:test";
import process from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

test("stdio MCP server exposes the complete public Computer Use surface", async () => {
	const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
	const transport = new StdioClientTransport({ command: process.execPath, args: [path.join(root, "bin", "ocu.mjs"), "mcp"], stderr: "pipe" });
	const client = new Client({ name: "open-computer-use-test", version: "0.1.0" });
	try {
		await client.connect(transport);
		const response = await client.listTools();
		assert.deepEqual(new Set(response.tools.map((tool) => tool.name)), new Set([
			"find_roots", "observe_ui", "search_ui", "expand_ui", "inspect_ui", "read_text", "wait_for", "act_ui", "launch_browser", "navigate_browser", "evaluate_browser",
		]));
	} finally {
		await transport.close();
	}
});
