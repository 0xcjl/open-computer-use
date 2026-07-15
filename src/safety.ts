import type { UiAction } from "./contract.ts";
import type { OutlineNode } from "./outline.ts";

const BLOCKED_BUNDLE_IDS = new Set([
	"com.apple.systempreferences",
	"com.apple.systemsettings",
	"com.apple.SecurityAgent",
]);

const SENSITIVE_UI_PATTERN = /(?:accessibility|screen recording|privacy\s*&?\s*security|system settings|permission|password|passcode|api[_ -]?key|secret|credit[ -]?card|\bcvv\b|one[ -]?time|\b2fa\b|verification[ -]?code)/i;
const PROMPT_INJECTION_PATTERN = /(?:ignore (?:all |any |the )?(?:previous|prior|above) (?:instructions|rules)|system message|developer message|jailbreak|follow (?:these|the) instructions)/i;

export class SafetyError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "SafetyError";
	}
}

export function assertSafeBundle(bundleId: string | undefined): void {
	if (bundleId && BLOCKED_BUNDLE_IDS.has(bundleId)) {
		throw new SafetyError("System settings and permission dialogs are never controllable by open-computer-use.");
	}
}

function nodeText(node: OutlineNode): string {
	const lineage: string[] = [];
	for (let current: OutlineNode | undefined = node; current; current = current.parent) {
		lineage.push(current.title, current.description, current.value, current.identifier, ...current.text.map((text) => text.string));
	}
	return lineage.filter(Boolean).join(" ");
}

/** Reject actions directed at sensitive UI or instructions rendered as untrusted content. */
export function assertSafeActionTargets(actions: UiAction[], lookup: (ref: string) => string | OutlineNode | undefined): void {
	for (const action of actions) {
		if (!action.ref) continue;
		const candidate = lookup(action.ref);
		const text = typeof candidate === "string" ? candidate : candidate ? nodeText(candidate) : "";
		if (SENSITIVE_UI_PATTERN.test(text)) throw new SafetyError("Credential, payment, 2FA, or permission UI is never controllable by open-computer-use.");
		if (PROMPT_INJECTION_PATTERN.test(text)) throw new SafetyError("Rendered instructions are untrusted and cannot be used as an action target.");
	}
}
