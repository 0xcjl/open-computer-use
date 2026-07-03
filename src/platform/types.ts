import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { PermissionStatus } from "../permissions.ts";
import type { LookResponse } from "../outline.ts";

export type PlatformName = "macos" | "windows" | "linux";
export type NativeInputDelivery = "hid" | "pid";
export type ActOutcome = "worked" | "didnt" | "unknown";

export interface PlatformDiagnostics {
	protocolVersion: number;
	pid: number;
	parentPid?: number;
	parentAppName?: string;
	parentBundleId?: string;
	parentPath?: string;
	executablePath?: string;
	os?: string;
	arch?: string;
	accessibility?: boolean;
	screenRecording?: boolean;
}

export interface PlatformReadyState {
	permissionStatus?: PermissionStatus;
	lastPermissionCheckAt: number;
	helperDiagnostics?: PlatformDiagnostics;
}

export interface PlatformApp {
	appName: string;
	bundleId?: string;
	pid: number;
	isFrontmost?: boolean;
}

export interface FramePoints {
	x: number;
	y: number;
	w: number;
	h: number;
}

export interface PlatformWindow {
	windowId?: number;
	windowRef?: string;
	title: string;
	role?: string;
	subrole?: string;
	pairing: { confidence: "exact" | "high" | "low"; score: number };
	framePoints: FramePoints;
	scaleFactor: number;
	isMinimized: boolean;
	isOnscreen: boolean;
	isMain: boolean;
	isFocused: boolean;
	isModal: boolean;
	sheetCount: number;
}

export interface PlatformFrontmostResult {
	appName: string;
	bundleId?: string;
	pid: number;
	windowTitle?: string;
	windowId?: number;
}

export interface PlatformFocusWindowResult {
	focused: boolean;
	alreadyFocused?: boolean;
	reason?: string;
}

export interface HelperActPerformed {
	grounding?: "description" | "coordinates";
	delivery?: "ax" | NativeInputDelivery;
	refound?: boolean;
}

export interface HelperActResult {
	outcome: ActOutcome;
	performed?: HelperActPerformed;
	evidence?: Record<string, unknown>;
	error?: { code?: string; message?: string; whatIsThere?: unknown };
}

export interface ComputerUsePlatformBackend {
	name: PlatformName;
	ensureReady(ctx: ExtensionContext, state: PlatformReadyState, signal?: AbortSignal): Promise<PlatformReadyState>;
	listApps(signal?: AbortSignal): Promise<PlatformApp[]>;
	listWindows(pid: number, signal?: AbortSignal): Promise<PlatformWindow[]>;
	getFrontmost(signal?: AbortSignal): Promise<PlatformFrontmostResult>;
	focusWindow(target: { pid: number; windowId: number; windowRef?: string }, signal?: AbortSignal): Promise<PlatformFocusWindowResult>;
	look(windowId: number, options: { readText: "auto" | "always" | "never"; scopeRef?: string; maxDimension?: number }, signal?: AbortSignal): Promise<LookResponse>;
	act(args: Record<string, unknown>, options?: { timeoutMs?: number; signal?: AbortSignal }): Promise<HelperActResult>;
	readText(args: Record<string, unknown>, options?: { timeoutMs?: number; signal?: AbortSignal }): Promise<unknown>;
	waitFor(args: Record<string, unknown>, options?: { timeoutMs?: number; signal?: AbortSignal }): Promise<unknown>;
	isBrowserApp(appName: string, bundleId?: string): boolean;
	isChromeFamilyApp(appName: string, bundleId?: string): boolean;
	openBrowserLocation(target: { appName: string; bundleId?: string }, url: string, signal?: AbortSignal): Promise<boolean>;
}
