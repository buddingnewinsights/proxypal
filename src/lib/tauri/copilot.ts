import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

// Copilot status
export interface CopilotStatus {
	running: boolean;
	port: number;
	endpoint: string;
	authenticated: boolean;
}

// Copilot API detection result
export interface CopilotApiDetection {
	installed: boolean;
	version?: string;
	copilotBin?: string; // Path to copilot-api binary (if installed)
	npxBin?: string; // Path to npx binary (for fallback)
	npmBin?: string; // Path to npm binary (for installs)
	nodeBin?: string; // Path to node binary actually used
	nodeAvailable: boolean;
	checkedNodePaths: string[];
	checkedCopilotPaths: string[];
}

// Copilot API install result
export interface CopilotApiInstallResult {
	success: boolean;
	message: string;
	version?: string;
}

export async function getCopilotStatus(): Promise<CopilotStatus> {
	return invoke("get_copilot_status");
}

export async function startCopilot(): Promise<CopilotStatus> {
	return invoke("start_copilot");
}

export async function stopCopilot(): Promise<CopilotStatus> {
	return invoke("stop_copilot");
}

export async function checkCopilotHealth(): Promise<CopilotStatus> {
	return invoke("check_copilot_health");
}

export async function detectCopilotApi(): Promise<CopilotApiDetection> {
	return invoke("detect_copilot_api");
}

export async function installCopilotApi(): Promise<CopilotApiInstallResult> {
	return invoke("install_copilot_api");
}

export async function onCopilotStatusChanged(
	callback: (status: CopilotStatus) => void,
): Promise<UnlistenFn> {
	return listen<CopilotStatus>("copilot-status-changed", (event) => {
		callback(event.payload);
	});
}

export async function onCopilotAuthRequired(
	callback: (message: string) => void,
): Promise<UnlistenFn> {
	return listen<string>("copilot-auth-required", (event) => {
		callback(event.payload);
	});
}
