/** Minimal host seam shared by the standalone runtime and legacy adapters. */
export interface AgentToolResult<T = unknown> {
	content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
	details: T;
}

export type AgentToolUpdateCallback<T = unknown> = (update: AgentToolResult<T>) => void | Promise<void>;

export interface ExtensionContext {
	cwd: string;
	hasUI: boolean;
	ui: {
		select(message: string, options: string[], optionsArg?: { signal?: AbortSignal }): Promise<string | undefined>;
		notify(message: string, level: "info" | "warning" | "error"): void;
	};
	sessionManager?: { getBranch(): unknown[] };
}

export function nonInteractiveContext(cwd: string): ExtensionContext {
	return {
		cwd,
		hasUI: false,
		ui: {
			async select(): Promise<string | undefined> { return undefined; },
			notify(): void {},
		},
	};
}
