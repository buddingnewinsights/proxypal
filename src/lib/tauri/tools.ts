import { invoke } from "@tauri-apps/api/core";

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
