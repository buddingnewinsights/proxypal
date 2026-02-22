import { invoke } from "@tauri-apps/api/core";

// GPT Reasoning Models (single source of truth from backend)
export async function getGptReasoningModels(): Promise<string[]> {
	return invoke("get_gpt_reasoning_models");
}

// Amp model mapping for routing requests to different models (simple mode)
export interface AmpModelMapping {
	name: string;
	alias: string;
	enabled?: boolean; // Whether this mapping is active
	fork?: boolean; // Whether to fork requests (send to both original and alias)
}

// Predefined Amp model slots with friendly names
export interface AmpModelSlot {
	id: string;
	name: string; // Friendly display name: "Smart", "Rush", "Oracle"
	fromModel: string; // Actual Amp model identifier
	fromLabel: string; // Friendly label for the source model
}

// Migration map for slot model changes across versions
// When Ampcode updates a slot's model, add old → new here so user configs auto-migrate
// Format: { oldFromModel: newFromModel }
const SLOT_MODEL_MIGRATIONS: Record<string, string> = {
	"claude-opus-4-5-20251101": "claude-opus-4-6", // Smart: Opus 4.5 → 4.6
	"claude-opus-4-6-20260205": "claude-opus-4-6", // Fix: Ampcode sends without date suffix
};

// Auto-migrate amp model mappings when slot models change
// Returns true if any mappings were migrated (caller should save config)
export function migrateAmpModelMappings(mappings: AmpModelMapping[]): {
	migrated: boolean;
	mappings: AmpModelMapping[];
} {
	let migrated = false;
	const currentSlotModels = new Set(AMP_MODEL_SLOTS.map((s) => s.fromModel));
	const updated = mappings.map((m) => {
		const newName = SLOT_MODEL_MIGRATIONS[m.name];
		if (newName && currentSlotModels.has(newName)) {
			// Only migrate if no mapping for the new model already exists
			const alreadyHasNew = mappings.some((other) => other.name === newName);
			if (!alreadyHasNew) {
				migrated = true;
				return { ...m, name: newName };
			}
		}
		return m;
	});
	return { migrated, mappings: updated };
}

// Default Amp model slots (these are the models Amp CLI uses)
// Based on actual Amp CLI logs (~/.cache/amp/logs/cli.log) and ampcode.com/models
// IMPORTANT: Model names must match EXACTLY what Amp sends in requests
// NOTE: When using Copilot provider, these get mapped to copilot-prefixed models
export const AMP_MODEL_SLOTS: AmpModelSlot[] = [
	// Claude Opus 4.6 - used by Smart agent (default main agent)
	{
		id: "opus-4-6",
		name: "Smart",
		fromModel: "claude-opus-4-6",
		fromLabel: "Claude Opus 4.6",
	},
	// GPT-5.2 Codex - used by Deep agent
	{
		id: "deep",
		name: "Deep",
		fromModel: "gpt-5.2-codex",
		fromLabel: "GPT-5.2 Codex",
	},
	// Claude Sonnet 4.5 - used by Librarian subagent
	{
		id: "sonnet-4-5",
		name: "Librarian",
		fromModel: "claude-sonnet-4-5-20241022",
		fromLabel: "Claude Sonnet 4.5",
	},
	// Claude Haiku 4.5 - used by Rush and Titling subagents
	{
		id: "haiku-4-5",
		name: "Rush/Titling",
		fromModel: "claude-haiku-4-5-20251001",
		fromLabel: "Claude Haiku 4.5",
	},
	// Gemini 3 Flash - used by Search subagent
	{
		id: "search",
		name: "Search",
		fromModel: "gemini-3-flash-preview",
		fromLabel: "Gemini 3 Flash",
	},
	// GPT-5.2 - used by Oracle agent
	{
		id: "oracle",
		name: "Oracle",
		fromModel: "gpt-5.2",
		fromLabel: "GPT-5.2",
	},
	// Gemini models for Review, Handoff, and Topics
	{
		id: "review",
		name: "Review",
		fromModel: "gemini-3-pro-preview",
		fromLabel: "Gemini 3 Pro",
	},
	{
		id: "handoff",
		name: "Handoff",
		fromModel: "gemini-2.5-flash",
		fromLabel: "Gemini 2.5 Flash",
	},
	{
		id: "topics",
		name: "Topics",
		fromModel: "gemini-2.5-flash-lite-preview-09-2025",
		fromLabel: "Gemini 2.5 Flash-Lite Preview",
	},
	// Gemini 3 Pro Image - used by Painter agent
	{
		id: "painter",
		name: "Painter",
		fromModel: "gemini-3-pro-image-preview",
		fromLabel: "Gemini 3 Pro Image",
	},
];

// Common model aliases that Amp might use (without date suffix)
// These map to the full model identifiers
export const AMP_MODEL_ALIASES: Record<string, string> = {
	"claude-opus-4.6": "claude-opus-4-6",
	"claude-opus-4-6-20260205": "claude-opus-4-6", // Ampcode sends without date suffix
	"claude-opus-4.5": "claude-opus-4-5-20251101",
	"claude-opus-4-5": "claude-opus-4-5-20251101",
	"claude-sonnet-4.5": "claude-sonnet-4-5-20241022",
	"claude-sonnet-4-5": "claude-sonnet-4-5-20241022",
	"claude-haiku-4.5": "claude-haiku-4-5-20251001",
	"claude-haiku-4-5": "claude-haiku-4-5-20251001",
};

// Complete list of GitHub Copilot models available via copilot-api
// These are exposed as copilot-{model} aliases in CLIProxyAPI
export const COPILOT_MODELS = {
	// OpenAI GPT models
	openai: [
		{ id: "copilot-gpt-4.1", name: "GPT-4.1", status: "GA" },
		{ id: "copilot-gpt-5", name: "GPT-5", status: "GA" },
		{ id: "copilot-gpt-5-mini", name: "GPT-5 Mini", status: "GA" },
		{ id: "copilot-gpt-5-codex", name: "GPT-5 Codex", status: "Preview" },
		{ id: "copilot-gpt-5.1", name: "GPT-5.1", status: "Preview" },
		{ id: "copilot-gpt-5.1-codex", name: "GPT-5.1 Codex", status: "Preview" },
		{
			id: "copilot-gpt-5.1-codex-mini",
			name: "GPT-5.1 Codex Mini",
			status: "Preview",
		},
		// Legacy models
		{ id: "copilot-gpt-4o", name: "GPT-4o", status: "Legacy" },
		{ id: "copilot-gpt-4", name: "GPT-4", status: "Legacy" },
		{ id: "copilot-gpt-4-turbo", name: "GPT-4 Turbo", status: "Legacy" },
		{ id: "copilot-o1", name: "O1", status: "Legacy" },
		{ id: "copilot-o1-mini", name: "O1 Mini", status: "Legacy" },
	],
	// Anthropic Claude models
	claude: [
		{ id: "copilot-claude-haiku-4.5", name: "Claude Haiku 4.5", status: "GA" },
		{ id: "copilot-claude-opus-4.1", name: "Claude Opus 4.1", status: "GA" },
		{ id: "copilot-claude-sonnet-4", name: "Claude Sonnet 4", status: "GA" },
		{
			id: "copilot-claude-sonnet-4.5",
			name: "Claude Sonnet 4.5",
			status: "GA",
		},
		{
			id: "copilot-claude-opus-4.5",
			name: "Claude Opus 4.5",
			status: "Preview",
		},
	],
	// Google Gemini models
	gemini: [
		{ id: "copilot-gemini-2.5-pro", name: "Gemini 2.5 Pro", status: "GA" },
		{ id: "copilot-gemini-3-pro", name: "Gemini 3 Pro", status: "Preview" },
	],
	// Other models
	other: [
		{
			id: "copilot-grok-code-fast-1",
			name: "Grok Code Fast 1 (xAI)",
			status: "GA",
		},
		{
			id: "copilot-raptor-mini",
			name: "Raptor Mini (Fine-tuned)",
			status: "Preview",
		},
	],
};

// OpenAI-compatible model for Amp routing
export interface AmpOpenAIModel {
	name: string;
	alias: string;
}

// OpenAI-compatible provider configuration for Amp
export interface AmpOpenAIProvider {
	id: string; // Unique identifier (UUID)
	name: string;
	baseUrl: string;
	apiKey: string;
	models: AmpOpenAIModel[];
}

// GitHub Copilot configuration (via copilot-api)
export interface CopilotConfig {
	enabled: boolean;
	port: number;
	accountType: string; // "individual", "business", "enterprise"
	githubToken: string;
	rateLimit?: number;
	rateLimitWait: boolean;
}

export interface AvailableModel {
	id: string;
	ownedBy: string; // "google", "openai", "qwen", "anthropic", etc.
	source: string; // "vertex", "gemini-api", "copilot", "oauth", "api-key", etc.
}

export interface GroupedModels {
	provider: string; // Display name: "Gemini", "OpenAI/Codex", "Qwen", etc.
	models: string[];
}

// OpenAI-compatible provider models
export interface OpenAICompatibleModel {
	id: string;
	ownedBy?: string;
	created?: number;
}

export interface OpenAICompatibleProviderModels {
	providerName: string;
	baseUrl: string;
	models: OpenAICompatibleModel[];
	error?: string;
}

export async function getAvailableModels(): Promise<AvailableModel[]> {
	return invoke("get_available_models");
}

export async function fetchOpenaiCompatibleModels(): Promise<
	OpenAICompatibleProviderModels[]
> {
	return invoke("fetch_openai_compatible_models");
}
