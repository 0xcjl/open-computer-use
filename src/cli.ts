import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadComputerUseConfig } from "./config.ts";
import { runMcpServer } from "./mcp.ts";
import { HELPER_APP_EXECUTABLE_PATH, HELPER_APP_PATH, macosHelper } from "./platform/macos/helper.ts";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const executablePath = path.join(packageRoot, "bin", "ocu.mjs");
const helperSetupScript = path.join(packageRoot, "scripts", "setup-helper.mjs");

const configPath = () => process.env.OCU_CONFIG ?? path.join(os.homedir(), ".config", "open-computer-use", "config.json");

function usage(): string {
	return [
		"Usage: ocu <command>",
		"  ocu mcp                 Run the local stdio MCP server.",
		"  ocu doctor              Check Node, macOS helper/TCC, CDP, and policy.",
		"  ocu config init         Write a deny-by-default policy template.",
		"  ocu install --host NAME Install helper, MCP configuration, and host Skill.",
		"  ocu install --host NAME --dry-run  Print the exact installation actions.",
	].join("\n");
}

async function configInit(): Promise<void> {
	const output = configPath();
	await fs.mkdir(path.dirname(output), { recursive: true });
	try {
		await fs.access(output);
		throw new Error(`Refusing to overwrite existing config: ${output}`);
	} catch (error) {
		if (error instanceof Error && error.message.startsWith("Refusing")) throw error;
	}
	await fs.writeFile(output, `${JSON.stringify({ browser_use: true, headless: true, cursor_overlay: false, policy: { mode: "automatic", rules: [] } }, null, 2)}\n`, { mode: 0o600 });
	console.log(`Created ${output}. Add an explicit policy rule before MCP tools can access an app.`);
}

async function helperCheck(): Promise<[string, boolean, string]> {
	try {
		await fs.access(HELPER_APP_EXECUTABLE_PATH);
	} catch {
		return ["helper", false, `run ocu install --host <hermes|openclaw>; expected ${HELPER_APP_PATH}`];
	}
	try {
		const diagnostics = await macosHelper.diagnosticsCommand();
		const tccReady = diagnostics.accessibility === true && diagnostics.screenRecording === true;
		return ["TCC", tccReady, tccReady ? "" : "grant Accessibility and Screen Recording to open-computer-use.app"];
	} catch (error) {
		return ["helper", false, error instanceof Error ? error.message : String(error)];
	}
}

async function cdpCheck(): Promise<[string, boolean, string]> {
	const port = process.env.OCU_CDP_PORT;
	if (!port) return ["CDP", true, "not configured (optional)"];
	if (!/^\d+$/.test(port)) return ["CDP", false, "OCU_CDP_PORT must be a local numeric port"];
	try {
		const response = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(2_000) });
		return ["CDP", response.ok, response.ok ? "" : `local CDP returned ${response.status}`];
	} catch {
		return ["CDP", false, `no local CDP endpoint on 127.0.0.1:${port}`];
	}
}

async function doctor(): Promise<void> {
	const loaded = loadComputerUseConfig(process.cwd());
	const nodeMajor = Number(process.versions.node.split(".")[0]);
	const checks: Array<[string, boolean, string]> = [
		["platform", process.platform === "darwin", `expected macOS, got ${process.platform}`],
		["node", nodeMajor >= 22, `expected Node >=22, got ${process.versions.node}`],
		["policy", loaded.config.policy.rules.length > 0, `no allow rules in ${loaded.sources.map((source) => source.path).join(", ")}`],
	];
	if (process.platform === "darwin") checks.push(await helperCheck());
	checks.push(await cdpCheck());
	for (const [name, ok, detail] of checks) console.log(`${ok ? "[ok]" : "[needs setup]"} ${name}${detail ? ` — ${detail}` : ""}`);
	if (!checks.every(([, ok]) => ok)) process.exitCode = 1;
}

function run(command: string, args: string[], dryRun: boolean, input?: string): void {
	console.log(`$ ${[command, ...args].join(" ")}`);
	if (dryRun) return;
	const result = spawnSync(command, args, { stdio: [input === undefined ? "inherit" : "pipe", "inherit", "inherit"], input });
	if (result.error) throw result.error;
	if (result.status !== 0) throw new Error(`Command failed (${result.status ?? "unknown"}): ${command}`);
}

async function install(host: string | undefined, dryRun: boolean): Promise<void> {
	if (host !== "hermes" && host !== "openclaw") throw new Error("install requires --host hermes or --host openclaw");
	if (process.platform !== "darwin") throw new Error("open-computer-use v0.1 installation requires macOS.");

	run(process.execPath, [helperSetupScript, "--runtime"], dryRun);
	const mcpArgs = ["mcp", "add", "open-computer-use", "--command", process.execPath, "--args", executablePath, "mcp"];
	if (host === "hermes") {
		const source = path.join(packageRoot, "skills", "hermes", "open-computer-use");
		const destination = path.join(os.homedir(), ".hermes", "skills", "open-computer-use");
		console.log(`$ copy ${source} ${destination}`);
		if (!dryRun) await fs.cp(source, destination, { recursive: true, force: true });
		// Hermes asks whether the newly discovered tools should be enabled. The
		// caller selected this named local server explicitly, so answer its setup
		// prompt only; no desktop policy is granted by this action.
		run("hermes", mcpArgs, dryRun, "Y\n");
		console.log("Next: hermes mcp test open-computer-use && ocu doctor");
		return;
	}

	run("openclaw", ["skills", "install", "@0xcjl/open-computer-use-mcp", "--force"], dryRun);
	run("openclaw", ["mcp", "add", "open-computer-use", "--command", process.execPath, "--arg", executablePath, "--arg", "mcp"], dryRun);
	console.log("Next: openclaw mcp probe open-computer-use && openclaw skills info open-computer-use-mcp && ocu doctor");
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
	const [command, ...rest] = argv;
	if (command === "mcp") return await runMcpServer(process.cwd());
	if (command === "doctor") return await doctor();
	if (command === "config" && rest[0] === "init") return await configInit();
	if (command === "install") {
		const hostIndex = rest.indexOf("--host");
		return await install(hostIndex >= 0 ? rest[hostIndex + 1] : undefined, rest.includes("--dry-run"));
	}
	console.log(usage());
	if (command) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
	main().catch((error) => {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	});
}
