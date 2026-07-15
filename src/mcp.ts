import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { PolicyError } from "./policy.ts";
import { OpenComputerUseRuntime } from "./standalone.ts";
import type { ComputerUseToolName } from "./bridge.ts";

const VERSION = "0.1.0";
const stateId = z.string().min(1).describe("Immutable state id returned by observe_ui or a prior mutation.");
const target = {
	ref: z.string().optional(),
	x: z.number().optional(),
	y: z.number().optional(),
};
const action = z.discriminatedUnion("action", [
	z.object({ action: z.literal("press"), ...target }),
	z.object({ action: z.literal("click"), ...target, button: z.enum(["left", "right", "middle"]).optional(), clickCount: z.number().optional() }),
	z.object({ action: z.literal("doubleClick"), ...target, button: z.enum(["left", "right", "middle"]).optional() }),
	z.object({ action: z.literal("setText"), ref: z.string(), text: z.string() }),
	z.object({ action: z.literal("typeText"), ref: z.string().optional(), text: z.string() }),
	z.object({ action: z.literal("keypress"), ref: z.string().optional(), keys: z.array(z.string()).min(1) }),
	z.object({ action: z.literal("scroll"), ...target, scrollX: z.number().optional(), scrollY: z.number().optional() }),
	z.object({ action: z.literal("drag"), path: z.array(z.object({ x: z.number(), y: z.number() })).min(2) }),
	z.object({ action: z.literal("moveMouse"), ...target }),
	z.object({ action: z.literal("wait"), ms: z.number().positive() }),
]);

function resultText(result: { content: Array<{ type: string; text?: string }>; details: unknown }) {
	const texts = result.content.filter((item) => item.type === "text" && item.text).map((item) => item.text!);
	return `${texts.join("\n\n")}\n\nStructured details:\n${JSON.stringify(result.details)}`;
}

function register(
	server: McpServer,
	runtime: OpenComputerUseRuntime,
	name: ComputerUseToolName,
	description: string,
	inputSchema: Record<string, z.ZodTypeAny>,
): void {
	server.registerTool(name, { description, inputSchema }, async (args) => {
		try {
			const result = await runtime.execute(name, args as Record<string, unknown>);
			return { content: [{ type: "text" as const, text: resultText(result) }] };
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return { isError: true, content: [{ type: "text" as const, text: error instanceof PolicyError ? `Policy denied: ${message}` : message }] };
		}
	});
}

export function createMcpServer(cwd = process.cwd()): McpServer {
	const runtime = new OpenComputerUseRuntime(cwd);
	const server = new McpServer({ name: "open-computer-use", version: VERSION });
	register(server, runtime, "find_roots", "Find controllable desktop and browser roots. Policy requires an explicit allowed bundleId.", {
		query: z.string().optional(), app: z.string().optional(), bundleId: z.string().min(1), pid: z.number().optional(), kind: z.enum(["window", "menu", "sheet", "popover", "dialog", "browser_page"]).optional(),
	});
	register(server, runtime, "observe_ui", "Observe one root and return its immutable state-scoped outline.", { root: z.string().optional(), app: z.string().optional(), windowTitle: z.string().optional(), mode: z.enum(["semantic", "visual", "fused"]).optional(), image: z.enum(["auto", "always", "never"]).optional() });
	register(server, runtime, "search_ui", "Search the complete cached outline owned by a state.", { stateId, text: z.string().optional(), role: z.string().optional(), action: z.string().optional(), limit: z.number().optional() });
	register(server, runtime, "expand_ui", "Expand local outline context for one element ref.", { stateId, ref: z.string(), depth: z.number().optional() });
	register(server, runtime, "inspect_ui", "Inspect fields, rects, actions, and evidence for one element ref.", { stateId, ref: z.string(), includeRaw: z.boolean().optional() });
	register(server, runtime, "read_text", "Read paginated text owned by a state.", { stateId, ref: z.string().optional(), offset: z.number().optional(), limit: z.number().optional() });
	register(server, runtime, "wait_for", "Wait for text or a role to appear or disappear in a state-owned UI.", { stateId, text: z.string().optional(), role: z.string().optional(), gone: z.boolean().optional(), timeoutMs: z.number().optional() });
	register(server, runtime, "act_ui", "Perform one state-bound transaction of policy-approved UI actions.", { stateId, headless: z.boolean().optional(), image: z.enum(["auto", "always", "never"]).optional(), expect: z.object({ text: z.string().optional(), role: z.string().optional(), value: z.string().optional(), gone: z.boolean().optional(), timeoutMs: z.number().optional() }).optional(), actions: z.array(action).min(1).max(20) });
	register(server, runtime, "launch_browser", "Launch a managed browser and return browser-page roots.", { browser: z.enum(["helium", "chrome"]).optional(), url: z.string().optional(), port: z.number().optional() });
	register(server, runtime, "navigate_browser", "Navigate a state-owned browser page to an http(s) URL.", { stateId, url: z.string().min(1), image: z.enum(["auto", "always", "never"]).optional() });
	register(server, runtime, "evaluate_browser", "Evaluate JavaScript in a state-owned CDP browser page.", { stateId, expression: z.string().min(1) });
	return server;
}

export async function runMcpServer(cwd = process.cwd()): Promise<void> {
	const server = createMcpServer(cwd);
	await server.connect(new StdioServerTransport());
}
