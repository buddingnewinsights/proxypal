import { invoke } from "@tauri-apps/api/core";

// Auth file entry from Management API
export interface AuthFile {
	id: string;
	name: string;
	provider: string;
	label?: string;
	status: "ready" | "error" | "disabled";
	statusMessage?: string;
	disabled: boolean;
	unavailable: boolean;
	runtimeOnly: boolean;
	source?: "file" | "memory";
	path?: string;
	size?: number;
	modtime?: string;
	email?: string;
	accountType?: string;
	account?: string;
	createdAt?: string;
	updatedAt?: string;
	lastRefresh?: string;
	successCount?: number;
	failureCount?: number;
}

export async function getAuthFiles(): Promise<AuthFile[]> {
	return invoke("get_auth_files");
}

export async function uploadAuthFile(
	filePath: string,
	provider: string,
): Promise<void> {
	return invoke("upload_auth_file", { filePath, provider });
}

export async function deleteAuthFile(fileId: string): Promise<void> {
	return invoke("delete_auth_file", { fileId });
}

export async function toggleAuthFile(
	fileName: string,
	disabled: boolean,
): Promise<void> {
	return invoke("toggle_auth_file", { fileName, disabled });
}

export async function downloadAuthFile(
	fileId: string,
	filename: string,
): Promise<string> {
	return invoke("download_auth_file", { fileId, filename });
}

export async function deleteAllAuthFiles(): Promise<void> {
	return invoke("delete_all_auth_files");
}
