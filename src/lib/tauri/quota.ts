import { invoke } from "@tauri-apps/api/core";

// Antigravity Quota
export interface ModelQuota {
	model: string;
	displayName: string;
	remainingPercent: number;
	resetTime?: string;
}

export interface AntigravityQuotaResult {
	accountEmail: string;
	quotas: ModelQuota[];
	fetchedAt: string;
	error?: string;
}

export interface CodexQuotaResult {
	accountEmail: string;
	planType: string;
	primaryUsedPercent: number;
	primaryResetAt?: number;
	secondaryUsedPercent: number;
	secondaryResetAt?: number;
	hasCredits: boolean;
	creditsBalance?: number;
	creditsUnlimited: boolean;
	fetchedAt: string;
	error?: string;
}

export interface CopilotQuotaResult {
	accountLogin: string;
	plan: string;
	premiumInteractionsPercent: number;
	chatPercent: number;
	fetchedAt: string;
	error?: string;
}

export interface ClaudeQuotaResult {
	accountEmail: string;
	plan: string;
	fiveHourPercent: number;
	fiveHourResetAt?: number;
	sevenDayPercent: number;
	sevenDayResetAt?: number;
	extraUsageSpend?: number;
	extraUsageLimit?: number;
	fetchedAt: string;
	error?: string;
}

export interface KiroQuotaResult {
	accountEmail: string;
	plan: string;
	totalCredits: number;
	usedCredits: number;
	usedPercent: number;
	bonusCreditsUsed: number;
	bonusCreditsTotal: number;
	bonusCreditsExpiresDays?: number;
	resetsOn?: string;
	fetchedAt: string;
	error?: string;
}

export async function fetchAntigravityQuota(): Promise<
	AntigravityQuotaResult[]
> {
	return invoke("fetch_antigravity_quota");
}

export async function fetchCodexQuota(): Promise<CodexQuotaResult[]> {
	return invoke("fetch_codex_quota");
}

export async function fetchCopilotQuota(): Promise<CopilotQuotaResult[]> {
	return invoke("fetch_copilot_quota");
}

export async function fetchClaudeQuota(): Promise<ClaudeQuotaResult[]> {
	return invoke("fetch_claude_quota");
}

export async function fetchKiroQuota(): Promise<KiroQuotaResult[]> {
	return invoke("fetch_kiro_quota");
}
