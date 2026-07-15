import { loadComputerUseConfig, type LoadedComputerUseConfig } from "./config.ts";
import { nonInteractiveContext, type AgentToolResult } from "./host.ts";
import { PolicyEngine } from "./policy.ts";
import { runComputerUseTool, type ComputerUseToolName } from "./bridge.ts";

/** Long-lived local runtime used by MCP and embedding SDK consumers. */
export class OpenComputerUseRuntime {
	readonly loaded: LoadedComputerUseConfig;
	readonly policy: PolicyEngine;

	constructor(readonly cwd = process.cwd()) {
		this.loaded = loadComputerUseConfig(cwd);
		this.policy = new PolicyEngine(this.loaded.config.policy);
	}

	async execute(tool: ComputerUseToolName, params: Record<string, unknown>, signal?: AbortSignal): Promise<AgentToolResult<unknown>> {
		this.policy.authorize(tool, params);
		const result = await runComputerUseTool(tool, params, nonInteractiveContext(this.cwd), signal);
		this.policy.remember(result.details);
		return result;
	}
}
