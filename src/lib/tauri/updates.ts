import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";

// ============================================================================
// App Updates (OTA via Tauri Updater Plugin)
// ============================================================================

export interface UpdateInfo {
	available: boolean;
	version?: string;
	currentVersion?: string;
	date?: string;
	body?: string;
}

export interface UpdateProgress {
	event: "Started" | "Progress" | "Finished";
	contentLength?: number;
	chunkLength?: number;
}

// Check for available updates
export async function checkForUpdates(): Promise<UpdateInfo> {
	try {
		const currentVersion = await getVersion();
		const update = await check();
		if (update) {
			return {
				available: true,
				version: update.version,
				currentVersion: currentVersion,
				date: update.date,
				body: update.body,
			};
		}
		return { available: false, currentVersion: currentVersion };
	} catch (error) {
		console.error("Failed to check for updates:", error);
		throw error;
	}
}

// Download and install update with progress callback
export async function downloadAndInstallUpdate(
	onProgress?: (progress: UpdateProgress) => void,
): Promise<void> {
	const update = await check();
	if (!update) {
		throw new Error("No update available");
	}

	// Stop proxy BEFORE download/install to release cliproxyapi binary (required on Windows)
	try {
		await invoke("stop_proxy");
		// Wait for process to fully terminate (Windows needs more time)
		await new Promise((resolve) => setTimeout(resolve, 1500));
	} catch {
		// Ignore errors, proxy might not be running
	}

	await update.downloadAndInstall((event) => {
		if (onProgress) {
			if (event.event === "Started") {
				onProgress({
					event: "Started",
					contentLength: event.data.contentLength ?? undefined,
				});
			} else if (event.event === "Progress") {
				onProgress({
					event: "Progress",
					chunkLength: event.data.chunkLength,
				});
			} else if (event.event === "Finished") {
				onProgress({ event: "Finished" });
			}
		}
	});

	// Explicitly relaunch after install completes
	await relaunch();
}

// Relaunch the app after update
export async function relaunchApp(): Promise<void> {
	await relaunch();
}

// Check if auto-updater is supported on this platform/install type
export interface UpdaterSupport {
	supported: boolean;
	reason: string;
}

export async function isUpdaterSupported(): Promise<UpdaterSupport> {
	return invoke<UpdaterSupport>("is_updater_supported");
}
