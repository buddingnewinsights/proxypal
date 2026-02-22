import { invoke } from "@tauri-apps/api/core";

// Model mapping with alias and name (used by Claude and OpenAI-compatible providers)
export interface ModelMapping {
	name: string;
	alias?: string;
}

// Gemini API Key structure
export interface GeminiApiKey {
	apiKey: string;
	baseUrl?: string;
	proxyUrl?: string;
	headers?: Record<string, string>;
	excludedModels?: string[];
	prefix?: string;
}

// Claude API Key structure
export interface ClaudeApiKey {
	apiKey: string;
	baseUrl?: string;
	proxyUrl?: string;
	headers?: Record<string, string>;
	models?: ModelMapping[];
	excludedModels?: string[];
	prefix?: string;
}

// Codex API Key structure
export interface CodexApiKey {
	apiKey: string;
	baseUrl?: string;
	proxyUrl?: string;
	headers?: Record<string, string>;
	prefix?: string;
}

// OpenAI-Compatible Provider structure
export interface OpenAICompatibleProvider {
	name: string;
	baseUrl: string;
	apiKeyEntries: Array<{
		apiKey: string;
		proxyUrl?: string;
	}>;
	models?: ModelMapping[];
	headers?: Record<string, string>;
	prefix?: string;
}

// API Keys response wrapper
export interface ApiKeysResponse<T> {
	keys: T[];
}

// Gemini API Keys
export async function getGeminiApiKeys(): Promise<GeminiApiKey[]> {
	return invoke("get_gemini_api_keys");
}

export async function setGeminiApiKeys(keys: GeminiApiKey[]): Promise<void> {
	return invoke("set_gemini_api_keys", { keys });
}

export async function addGeminiApiKey(key: GeminiApiKey): Promise<void> {
	return invoke("add_gemini_api_key", { key });
}

export async function deleteGeminiApiKey(index: number): Promise<void> {
	return invoke("delete_gemini_api_key", { index });
}

// Claude API Keys
export async function getClaudeApiKeys(): Promise<ClaudeApiKey[]> {
	return invoke("get_claude_api_keys");
}

export async function setClaudeApiKeys(keys: ClaudeApiKey[]): Promise<void> {
	return invoke("set_claude_api_keys", { keys });
}

export async function addClaudeApiKey(key: ClaudeApiKey): Promise<void> {
	return invoke("add_claude_api_key", { key });
}

export async function deleteClaudeApiKey(index: number): Promise<void> {
	return invoke("delete_claude_api_key", { index });
}

// Codex API Keys
export async function getCodexApiKeys(): Promise<CodexApiKey[]> {
	return invoke("get_codex_api_keys");
}

export async function setCodexApiKeys(keys: CodexApiKey[]): Promise<void> {
	return invoke("set_codex_api_keys", { keys });
}

export async function addCodexApiKey(key: CodexApiKey): Promise<void> {
	return invoke("add_codex_api_key", { key });
}

export async function deleteCodexApiKey(index: number): Promise<void> {
	return invoke("delete_codex_api_key", { index });
}

// Vertex API Keys
export interface VertexApiKey {
	apiKey: string;
	projectId?: string;
	location?: string;
	baseUrl?: string;
	prefix?: string;
}

export async function getVertexApiKeys(): Promise<VertexApiKey[]> {
	return invoke("get_vertex_api_keys");
}

export async function setVertexApiKeys(keys: VertexApiKey[]): Promise<void> {
	return invoke("set_vertex_api_keys", { keys });
}

export async function addVertexApiKey(key: VertexApiKey): Promise<void> {
	return invoke("add_vertex_api_key", { key });
}

export async function deleteVertexApiKey(index: number): Promise<void> {
	return invoke("delete_vertex_api_key", { index });
}

// OpenAI-Compatible Providers
export async function getOpenAICompatibleProviders(): Promise<
	OpenAICompatibleProvider[]
> {
	return invoke("get_openai_compatible_providers");
}

export async function setOpenAICompatibleProviders(
	providers: OpenAICompatibleProvider[],
): Promise<void> {
	return invoke("set_openai_compatible_providers", { providers });
}

export async function addOpenAICompatibleProvider(
	provider: OpenAICompatibleProvider,
): Promise<void> {
	return invoke("add_openai_compatible_provider", { provider });
}

export async function deleteOpenAICompatibleProvider(
	index: number,
): Promise<void> {
	return invoke("delete_openai_compatible_provider", { index });
}
