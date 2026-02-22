import { invoke } from "@tauri-apps/api/core";

// Provider health check
export interface HealthStatus {
	status: "healthy" | "degraded" | "offline" | "unconfigured";
	latencyMs?: number;
	lastChecked: number;
}

export interface ProviderHealth {
	claude: HealthStatus;
	openai: HealthStatus;
	gemini: HealthStatus;
	qwen: HealthStatus;
	iflow: HealthStatus;
	vertex: HealthStatus;
	kiro: HealthStatus;
	antigravity: HealthStatus;
	kimi: HealthStatus;
}

export async function checkProviderHealth(): Promise<ProviderHealth> {
	return invoke("check_provider_health");
}

// Test OpenAI-compatible provider connection
export interface ProviderTestResult {
	success: boolean;
	message: string;
	latencyMs?: number;
	modelsFound?: number;
}

export async function testOpenAIProvider(
	baseUrl: string,
	apiKey: string,
): Promise<ProviderTestResult> {
	return invoke("test_openai_provider", { baseUrl, apiKey });
}

export async function testProviderConnection(
	modelId: string,
): Promise<ProviderTestResult> {
	return invoke("test_provider_connection", { modelId });
}

/** Test Kiro connection via kiro-cli chat --no-interactive "/usage". */
export async function testKiroConnection(): Promise<ProviderTestResult> {
	return invoke("test_kiro_connection");
}
