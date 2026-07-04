import { parseLookResponse, type LookResponse } from "../../outline.ts";
import { toBoolean, toFiniteNumber, toOptionalString } from "../coerce.ts";
import type { ComputerUsePlatformBackend, FramePoints, HelperActResult, PlatformActRequest, PlatformApp, PlatformFocusWindowResult, PlatformFrontmostResult, PlatformObserveRequest, PlatformReadTextRequest, PlatformReadTextResponse, PlatformRoot, PlatformRootKind, PlatformRootQuery, PlatformTarget, PlatformWaitForRequest, PlatformWaitForResponse } from "../types.ts";
import { macosHelper } from "./helper.ts";

function parseApps(result: unknown): PlatformApp[] {
	const array = Array.isArray(result) ? result : (result as any)?.apps;
	if (!Array.isArray(array)) return [];

	return array
		.map((raw) => {
			const pid = Math.trunc(toFiniteNumber((raw as any)?.pid, NaN));
			if (!Number.isFinite(pid) || pid <= 0) return undefined;
			const appName = toOptionalString((raw as any)?.appName) ?? "Unknown App";
			return {
				appName,
				bundleId: toOptionalString((raw as any)?.bundleId),
				pid,
				isFrontmost: toBoolean((raw as any)?.isFrontmost),
			} as PlatformApp;
		})
		.filter((item): item is PlatformApp => Boolean(item));
}

function parseFramePoints(raw: unknown): FramePoints {
	const frame = (raw as any)?.framePoints ?? {};
	return {
		x: toFiniteNumber(frame.x, 0),
		y: toFiniteNumber(frame.y, 0),
		w: Math.max(1, toFiniteNumber(frame.w, 1)),
		h: Math.max(1, toFiniteNumber(frame.h, 1)),
	};
}

function parseRoots(result: unknown): PlatformRoot[] {
	const array = Array.isArray(result) ? result : (result as any)?.roots;
	if (!Array.isArray(array)) return [];

	return array.map((raw) => {
		const pairing = (raw as any)?.pairing;
		const confidence = pairing?.confidence === "exact" || pairing?.confidence === "high" || pairing?.confidence === "low" ? pairing.confidence : "low";
		const kind = ["window", "menu", "sheet", "popover", "dialog"].includes((raw as any)?.kind) ? (raw as any).kind as PlatformRootKind : "window";
		return {
			kind,
			rootRef: toOptionalString((raw as any)?.rootRef ?? (raw as any)?.windowRef),
			windowRef: toOptionalString((raw as any)?.windowRef ?? (raw as any)?.rootRef),
			windowId: Number.isFinite((raw as any)?.windowId) ? Math.trunc((raw as any).windowId) : undefined,
			pid: Number.isFinite((raw as any)?.pid) ? Math.trunc((raw as any).pid) : undefined,
			appName: toOptionalString((raw as any)?.appName),
			bundleId: toOptionalString((raw as any)?.bundleId),
			title: toOptionalString((raw as any)?.title) ?? "",
			role: toOptionalString((raw as any)?.role),
			subrole: toOptionalString((raw as any)?.subrole),
			pairing: { confidence, score: toFiniteNumber(pairing?.score, Number.NEGATIVE_INFINITY) },
			framePoints: parseFramePoints(raw),
			scaleFactor: Math.max(1, toFiniteNumber((raw as any)?.scaleFactor, 1)),
			zOrder: Math.trunc(toFiniteNumber((raw as any)?.zOrder, 0)),
			isMinimized: toBoolean((raw as any)?.isMinimized),
			isOnscreen: toBoolean((raw as any)?.isOnscreen),
			isMain: toBoolean((raw as any)?.isMain),
			isFocused: toBoolean((raw as any)?.isFocused),
			isModal: toBoolean((raw as any)?.isModal),
			sheetCount: Math.max(0, Math.trunc(toFiniteNumber((raw as any)?.sheetCount, 0))),
		};
	});
}

export const macosBackend: Pick<ComputerUsePlatformBackend, "listApps" | "listRoots" | "getFrontmost" | "focusWindow" | "observe" | "act" | "readText" | "waitFor"> = {
	async listApps(signal?: AbortSignal): Promise<PlatformApp[]> {
		return parseApps(await macosHelper.command<unknown>("listApps", {}, { signal }));
	},

	async listRoots(query: PlatformRootQuery, signal?: AbortSignal): Promise<PlatformRoot[]> {
		return parseRoots(await macosHelper.command<unknown>("listRoots", Number.isFinite(query.pid) ? { pid: Math.trunc(query.pid!) } : {}, { signal }));
	},

	async getFrontmost(signal?: AbortSignal): Promise<PlatformFrontmostResult> {
		const result = await macosHelper.command<any>("getFrontmost", {}, { signal });
		const pid = Math.trunc(toFiniteNumber(result?.pid, NaN));
		if (!Number.isFinite(pid) || pid <= 0) {
			throw new Error("No frontmost app was available for screenshot targeting.");
		}
		return {
			appName: toOptionalString(result?.appName) ?? "Unknown App",
			bundleId: toOptionalString(result?.bundleId),
			pid,
			windowTitle: toOptionalString(result?.windowTitle),
			windowId: Number.isFinite(result?.windowId) ? Math.trunc(result.windowId) : undefined,
		};
	},

	async focusWindow(target: PlatformTarget, signal?: AbortSignal): Promise<PlatformFocusWindowResult> {
		return await macosHelper.command<PlatformFocusWindowResult>("focusWindow", { ...target }, { signal });
	},

	async observe(request: PlatformObserveRequest, options?: { timeoutMs?: number; signal?: AbortSignal }): Promise<LookResponse> {
		return parseLookResponse(await macosHelper.command("look", {
			windowId: request.target.windowId,
			windowRef: request.target.rootRef,
			maxDimension: request.maxDimension,
			readText: request.readText,
			scopeRef: request.scopeRef,
		}, options));
	},

	async act(request: PlatformActRequest, options?: { timeoutMs?: number; signal?: AbortSignal }): Promise<HelperActResult> {
		const before = request.pid ? await this.listRoots({ pid: request.pid }, options?.signal).catch(() => []) : [];
		const result = await macosHelper.command<HelperActResult>("act", { ...request }, options);
		const after = request.pid ? await this.listRoots({ pid: request.pid }, options?.signal).catch(() => []) : [];
		const key = (root: PlatformRoot) => root.rootRef ?? String(root.windowId ?? `${root.kind}:${root.title}:${root.framePoints.x}:${root.framePoints.y}`);
		const beforeKeys = new Set(before.map(key));
		const afterKeys = new Set(after.map(key));
		result.rootDelta = [
			...after.filter((root) => !beforeKeys.has(key(root))).map((root) => ({ change: "appeared" as const, kind: root.kind, ref: root.rootRef, title: root.title, pid: request.pid! })),
			...before.filter((root) => !afterKeys.has(key(root))).map((root) => ({ change: "closed" as const, kind: root.kind, ref: root.rootRef, title: root.title, pid: request.pid! })),
			...after.filter((root) => root.isFocused && !before.find((old) => key(old) === key(root) && old.isFocused)).map((root) => ({ change: "focused" as const, kind: root.kind, ref: root.rootRef, title: root.title, pid: request.pid! })),
		];
		return result;
	},

	async readText(args: PlatformReadTextRequest, options?: { timeoutMs?: number; signal?: AbortSignal }): Promise<PlatformReadTextResponse> {
		return await macosHelper.command("axReadText", { ...args }, options);
	},

	async waitFor(args: PlatformWaitForRequest, options?: { timeoutMs?: number; signal?: AbortSignal }): Promise<PlatformWaitForResponse> {
		return await macosHelper.command("axWaitFor", { ...args }, options);
	},
};
