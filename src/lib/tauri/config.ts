import { invoke } from "@tauri-apps/api/core";
import type { AmpModelMapping, AmpOpenAIProvider, CopilotConfig } from "./models";
import type { CloudflareConfig } from "./cloudflare";
import type { SshConfig } from "./ssh";

// Config
export interface AppConfig {
	port: number;
	autoStart: boolean;
	launchAtLogin: boolean;
	debug: boolean;
	proxyUrl: string;
	proxyUsername?: string;
	proxyPassword?: string;
	useSystemProxy?: boolean;
	requestRetry: number;
	quotaSwitchProject: boolean;
	quotaSwitchPreviewModel: boolean;
	usageStatsEnabled: boolean;
	requestLogging: boolean;
	loggingToFile: boolean;
	logsMaxTotalSizeMb: number;
	ampApiKey: string;
	ampModelMappings: AmpModelMapping[];
	ampOpenaiProvider?: AmpOpenAIProvider; // Deprecated: for migration only
	ampOpenaiProviders: AmpOpenAIProvider[]; // Array of custom providers
	ampRoutingMode: string; // "mappings" or "openai"
	routingStrategy: string; // "round-robin", "fill-first", "sequential"
	copilot: CopilotConfig;
	forceModelMappings: boolean; // Force model mappings to take precedence over local API keys
	proxyApiKey?: string; // API key for client authentication
	managementKey?: string; // Management API key for internal proxy calls
	commercialMode?: boolean; // Disable request logging for lower memory usage
	wsAuth?: boolean; // Require authentication for WebSocket connections
	geminiThinkingInjection?: boolean; // Inject thinking config for Gemini 3 models
	sshConfigs?: SshConfig[];
	cloudflareConfigs?: CloudflareConfig[];
	disableControlPanel?: boolean; // Hide CLIProxyAPI's web management UI
	sidebarPinned?: boolean;
	locale?: string;
}

export async function getConfig(): Promise<AppConfig> {
	return invoke("get_config");
}

export async function saveConfig(config: AppConfig): Promise<void> {
	return invoke("save_config", { config });
}

export async function reloadConfig(): Promise<AppConfig> {
	return invoke("reload_config");
}

// Raw Config YAML - for power users
export async function getConfigYaml(): Promise<string> {
	return invoke("get_config_yaml");
}

export async function setConfigYaml(yaml: string): Promise<void> {
	return invoke("save_config_yaml", { yaml });
}
