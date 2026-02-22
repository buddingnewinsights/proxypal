import { invoke } from "@tauri-apps/api/core";
import type { AvailableModel } from "./models";

// CLI Agent Types and Functions
export interface AgentStatus {
	id: string;
	name: string;
	description: string;
	installed: boolean;
	configured: boolean;
	configType: "env" | "file" | "both" | "config";
	configPath?: string;
	logo: string;
	docsUrl: string;
}

export interface AgentConfigResult {
	success: boolean;
	configType: "env" | "file" | "both" | "config";
	configPath?: string;
	authPath?: string;
	shellConfig?: string;
	instructions: string;
	modelsConfigured?: number;
}

export async function detectCliAgents(): Promise<AgentStatus[]> {
	return invoke("detect_cli_agents");
}

export async function configureCliAgent(
	agentId: string,
	models: AvailableModel[],
): Promise<AgentConfigResult> {
	return invoke("configure_cli_agent", { agentId, models });
}

export async function getShellProfilePath(): Promise<string> {
	return invoke("get_shell_profile_path");
}

export async function appendToShellProfile(content: string): Promise<string> {
	return invoke("append_to_shell_profile", { content });
}

// Test agent connection
export interface AgentTestResult {
	success: boolean;
	message: string;
	latencyMs?: number;
}

export async function testAgentConnection(
	agentId: string,
): Promise<AgentTestResult> {
	return invoke("test_agent_connection", { agentId });
}
