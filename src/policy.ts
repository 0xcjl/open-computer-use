import type { UiAction } from "./contract.ts";

export type ToolCategory = "discovery" | "read" | "act" | "browser";

export interface PolicyRule {
	bundleIds: string[];
	allow: ToolCategory[];
	/** Optional action allowlist for act_ui. Omit only when the act category is intentionally fully allowed. */
	actions?: UiAction["action"][];
	allowForeground?: boolean;
}

export interface RuntimePolicy {
	mode: "automatic";
	rules: PolicyRule[];
}

export const DEFAULT_POLICY: RuntimePolicy = { mode: "automatic", rules: [] };

const CATEGORY_BY_TOOL: Record<string, ToolCategory> = {
	find_roots: "discovery",
	observe_ui: "read",
	search_ui: "read",
	expand_ui: "read",
	inspect_ui: "read",
	read_text: "read",
	wait_for: "read",
	act_ui: "act",
	launch_browser: "browser",
	navigate_browser: "browser",
	evaluate_browser: "browser",
};

const SECRET_PATTERN = /(?:password|passcode|api[_ -]?key|secret|credit[ -]?card|cvv|one[ -]?time|2fa|verification[ -]?code)/i;

export class PolicyError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "PolicyError";
	}
}

export class PolicyEngine {
	private readonly states = new Map<string, string>();
	private readonly roots = new Map<string, string>();

	constructor(readonly policy: RuntimePolicy = DEFAULT_POLICY) {}

	authorize(tool: string, params: Record<string, unknown>): void {
		const category = CATEGORY_BY_TOOL[tool];
		if (!category) throw new PolicyError(`Unknown Computer Use tool '${tool}'.`);
		const bundleId = this.bundleFor(tool, params);
		const rule = this.policy.rules.find((candidate) => candidate.bundleIds.includes(bundleId) && candidate.allow.includes(category));
		if (!rule) throw new PolicyError(`No automatic policy rule allows ${category} on '${bundleId}'.`);
		if (tool === "act_ui") this.authorizeActions(params, rule);
		if (params.headless === false && rule.allowForeground !== true) {
			throw new PolicyError(`Foreground execution is not allowed for '${bundleId}'.`);
		}
	}

	remember(details: unknown): void {
		if (!details || typeof details !== "object") return;
		const record = details as Record<string, unknown>;
		const target = record.target as Record<string, unknown> | undefined;
		const bundleId = typeof target?.bundleId === "string" ? target.bundleId : undefined;
		if (bundleId && typeof record.stateId === "string") this.states.set(record.stateId, bundleId);
		if (record.kind === "browser_page" && typeof record.stateId === "string") this.states.set(record.stateId, "browser:managed");
		const windows = Array.isArray(record.windows) ? record.windows : [];
		for (const window of windows) {
			if (!window || typeof window !== "object") continue;
			const candidate = window as Record<string, unknown>;
			if (typeof candidate.windowRef === "string" && typeof candidate.bundleId === "string") {
				this.roots.set(candidate.windowRef, candidate.bundleId);
			}
		}
		const roots = Array.isArray(record.roots) ? record.roots : [];
		for (const root of roots) {
			if (!root || typeof root !== "object") continue;
			const candidate = root as Record<string, unknown>;
			if (typeof candidate.ref === "string" && candidate.kind === "browser_page") this.roots.set(candidate.ref, "browser:managed");
		}
	}

	private bundleFor(tool: string, params: Record<string, unknown>): string {
		if (tool === "find_roots") {
			if (typeof params.bundleId !== "string" || !params.bundleId.trim()) {
				throw new PolicyError("find_roots requires an explicit allowed bundleId; broad desktop discovery is disabled.");
			}
			return params.bundleId;
		}
		if (tool === "launch_browser") return "browser:managed";
		const stateId = typeof params.stateId === "string" ? params.stateId : undefined;
		if (stateId && this.states.has(stateId)) return this.states.get(stateId)!;
		const root = typeof params.root === "string" ? params.root : undefined;
		if (root && this.roots.has(root)) return this.roots.get(root)!;
		throw new PolicyError(`${tool} requires a root or stateId previously observed through this policy session.`);
	}

	private authorizeActions(params: Record<string, unknown>, rule: PolicyRule): void {
		const actions = Array.isArray(params.actions) ? params.actions : [];
		if (actions.length === 0) throw new PolicyError("act_ui requires at least one action.");
		for (const candidate of actions) {
			const action = candidate as Record<string, unknown>;
			if (typeof action.action !== "string" || (rule.actions && !rule.actions.includes(action.action as UiAction["action"]))) {
				throw new PolicyError(`Action '${String(action.action)}' is not allowed by the matching policy rule.`);
			}
			if ((action.action === "setText" || action.action === "typeText") && typeof action.text === "string" && SECRET_PATTERN.test(action.text)) {
				throw new PolicyError("Typing credential, payment, or verification material is always blocked.");
			}
		}
	}
}
