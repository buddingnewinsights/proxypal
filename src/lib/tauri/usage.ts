import { invoke } from "@tauri-apps/api/core";
import type { RequestLog } from "./logs";

// Usage Statistics
export interface TimeSeriesPoint {
	label: string;
	value: number;
}

export interface ModelUsage {
	model: string;
	requests: number;
	tokens: number;
	inputTokens: number;
	outputTokens: number;
	cachedTokens: number;
}

export interface ProviderUsage {
	provider: string;
	requests: number;
	tokens: number;
}

export interface UsageStats {
	totalRequests: number;
	successCount: number;
	failureCount: number;
	totalTokens: number;
	inputTokens: number;
	outputTokens: number;
	cachedTokens: number;
	requestsToday: number;
	tokensToday: number;
	models: ModelUsage[];
	providers: ProviderUsage[];
	requestsByDay: TimeSeriesPoint[];
	tokensByDay: TimeSeriesPoint[];
	requestsByHour: TimeSeriesPoint[];
	tokensByHour: TimeSeriesPoint[];
}

export async function getUsageStats(): Promise<UsageStats> {
	// get_usage_stats now computes from local history, no longer needs proxy running
	return invoke("get_usage_stats");
}

// Request History (persisted)
export interface RequestHistory {
	requests: RequestLog[];
	totalTokensIn: number;
	totalTokensOut: number;
	totalTokensCached: number;
	totalCostUsd: number;
}

export async function getRequestHistory(): Promise<RequestHistory> {
	return invoke("get_request_history");
}

export async function addRequestToHistory(
	request: RequestLog,
): Promise<RequestLog> {
	return invoke("add_request_to_history", { request });
}

export async function clearRequestHistory(): Promise<void> {
	return invoke("clear_request_history");
}

// Sync usage statistics from CLIProxyAPI (fetches real token counts)
export async function syncUsageFromProxy(): Promise<RequestHistory> {
	return invoke("sync_usage_from_proxy");
}

// Export usage statistics for backup
export async function exportUsageStats(): Promise<unknown> {
	return invoke("export_usage_stats");
}

// Import usage statistics from backup
export interface ImportUsageResult {
	added: number;
	skipped: number;
	total_requests: number;
	failed_requests: number;
}

export async function importUsageStats(
	data: unknown,
): Promise<ImportUsageResult> {
	return invoke("import_usage_stats", { data });
}
