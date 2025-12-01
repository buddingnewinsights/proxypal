import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

// Proxy management
export async function startProxy(): Promise<ProxyStatus> {
  return invoke("start_proxy");
}

export async function stopProxy(): Promise<ProxyStatus> {
  return invoke("stop_proxy");
}

export interface ProxyStatus {
  running: boolean;
  port: number;
  endpoint: string;
}

export async function getProxyStatus(): Promise<ProxyStatus> {
  return invoke("get_proxy_status");
}

// OAuth management
export type Provider =
  | "claude"
  | "openai"
  | "gemini"
  | "qwen"
  | "iflow"
  | "vertex"
  | "antigravity";

export async function openOAuth(provider: Provider): Promise<string> {
  return invoke("open_oauth", { provider });
}

export async function pollOAuthStatus(oauthState: string): Promise<boolean> {
  return invoke("poll_oauth_status", { oauthState });
}

export async function completeOAuth(
  provider: Provider,
  code: string,
): Promise<AuthStatus> {
  return invoke("complete_oauth", { provider, code });
}

export async function disconnectProvider(
  provider: Provider,
): Promise<AuthStatus> {
  return invoke("disconnect_provider", { provider });
}

export async function importVertexCredential(
  filePath: string,
): Promise<AuthStatus> {
  return invoke("import_vertex_credential", { filePath });
}

export interface AuthStatus {
  claude: boolean;
  openai: boolean;
  gemini: boolean;
  qwen: boolean;
  iflow: boolean;
  vertex: boolean;
  antigravity: boolean;
}

export async function getAuthStatus(): Promise<AuthStatus> {
  return invoke("get_auth_status");
}

export async function refreshAuthStatus(): Promise<AuthStatus> {
  return invoke("refresh_auth_status");
}

// Config
export interface AppConfig {
  port: number;
  autoStart: boolean;
  launchAtLogin: boolean;
}

export async function getConfig(): Promise<AppConfig> {
  return invoke("get_config");
}

export async function saveConfig(config: AppConfig): Promise<void> {
  return invoke("save_config", { config });
}

// Event listeners
export interface OAuthCallback {
  provider: Provider;
  code: string;
}

export async function onProxyStatusChanged(
  callback: (status: ProxyStatus) => void,
): Promise<UnlistenFn> {
  return listen<ProxyStatus>("proxy-status-changed", (event) => {
    callback(event.payload);
  });
}

export async function onAuthStatusChanged(
  callback: (status: AuthStatus) => void,
): Promise<UnlistenFn> {
  return listen<AuthStatus>("auth-status-changed", (event) => {
    callback(event.payload);
  });
}

export async function onOAuthCallback(
  callback: (data: OAuthCallback) => void,
): Promise<UnlistenFn> {
  return listen<OAuthCallback>("oauth-callback", (event) => {
    callback(event.payload);
  });
}

export async function onTrayToggleProxy(
  callback: (shouldStart: boolean) => void,
): Promise<UnlistenFn> {
  return listen<boolean>("tray-toggle-proxy", (event) => {
    callback(event.payload);
  });
}

// System notifications
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

export async function showSystemNotification(
  title: string,
  body?: string,
): Promise<void> {
  let permissionGranted = await isPermissionGranted();

  if (!permissionGranted) {
    const permission = await requestPermission();
    permissionGranted = permission === "granted";
  }

  if (permissionGranted) {
    sendNotification({ title, body });
  }
}

// Request log for live monitoring
export interface RequestLog {
  id: string;
  timestamp: number;
  provider: string;
  model: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  tokensIn?: number;
  tokensOut?: number;
}

export async function onRequestLog(
  callback: (log: RequestLog) => void,
): Promise<UnlistenFn> {
  return listen<RequestLog>("request-log", (event) => {
    callback(event.payload);
  });
}

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
  antigravity: HealthStatus;
}

export async function checkProviderHealth(): Promise<ProviderHealth> {
  return invoke("check_provider_health");
}

// AI Tool Detection & Setup
export interface DetectedTool {
  id: string;
  name: string;
  installed: boolean;
  configPath?: string;
  canAutoConfigure: boolean;
}

export async function detectAiTools(): Promise<DetectedTool[]> {
  return invoke("detect_ai_tools");
}

export async function configureContinue(): Promise<string> {
  return invoke("configure_continue");
}

export interface ToolSetupStep {
  title: string;
  description: string;
  copyable?: string;
}

export interface ToolSetupInfo {
  name: string;
  logo: string;
  canAutoConfigure: boolean;
  note?: string;
  steps: ToolSetupStep[];
  manualConfig?: string;
  endpoint?: string;
}

export async function getToolSetupInfo(toolId: string): Promise<ToolSetupInfo> {
  return invoke("get_tool_setup_info", { toolId });
}

// CLI Agent Types and Functions
export interface AgentStatus {
  id: string;
  name: string;
  description: string;
  installed: boolean;
  configured: boolean;
  configType: "env" | "file" | "both";
  configPath?: string;
  logo: string;
  docsUrl: string;
}

export interface AgentConfigResult {
  success: boolean;
  configType: "env" | "file" | "both";
  configPath?: string;
  authPath?: string;
  shellConfig?: string;
  instructions: string;
}

export async function detectCliAgents(): Promise<AgentStatus[]> {
  return invoke("detect_cli_agents");
}

export async function configureCliAgent(
  agentId: string,
): Promise<AgentConfigResult> {
  return invoke("configure_cli_agent", { agentId });
}

export async function getShellProfilePath(): Promise<string> {
  return invoke("get_shell_profile_path");
}

export async function appendToShellProfile(content: string): Promise<string> {
  return invoke("append_to_shell_profile", { content });
}

// Usage Statistics
export interface ModelUsage {
  model: string;
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
  requestsToday: number;
  tokensToday: number;
  models: ModelUsage[];
}

export async function getUsageStats(): Promise<UsageStats> {
  return invoke("get_usage_stats");
}
