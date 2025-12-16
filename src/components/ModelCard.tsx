import type { Component } from "solid-js";
import { ProviderBadge } from "./ProviderBadge";

export interface ModelInfo {
	id: string;
	ownedBy: string;
	source: string;
	displayName?: string;
	contextWindow?: string;
	supportsThinking?: boolean;
}

interface ModelCardProps {
	model: ModelInfo;
	compact?: boolean;
}

// Helper to get human-readable model name
const getDisplayName = (modelId: string): string => {
	return modelId
		.replace(/-/g, " ")
		.replace(/\./g, " ")
		.split(" ")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
};

// Helper to get context window info based on model
const getContextWindow = (modelId: string): string | null => {
	const id = modelId.toLowerCase();
	if (id.includes("gemini-2.5") || id.includes("gemini-3")) return "1M";
	if (id.includes("claude-sonnet-4") || id.includes("claude-3")) return "200K";
	if (id.includes("gpt-4") || id.includes("o1") || id.includes("o3"))
		return "128K";
	if (id.includes("codex") || id.includes("copilot")) return "128K";
	return null;
};

// Helper to check if model supports thinking
const supportsThinking = (modelId: string): boolean => {
	const id = modelId.toLowerCase();
	return (
		id.includes("sonnet-4") ||
		id.includes("gemini-2.5") ||
		id.includes("gemini-3") ||
		id.includes("o1") ||
		id.includes("o3")
	);
};

export const ModelCard: Component<ModelCardProps> = (props) => {
	const compact = () => props.compact ?? false;
	const displayName = () =>
		props.model.displayName || getDisplayName(props.model.id);
	const contextWindow = () =>
		props.model.contextWindow || getContextWindow(props.model.id);
	const hasThinking = () =>
		props.model.supportsThinking ?? supportsThinking(props.model.id);

	if (compact()) {
		return (
			<div class="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
				<div class="flex items-center gap-2 min-w-0">
					<span class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
						{props.model.id}
					</span>
				</div>
				<div class="flex items-center gap-2 flex-shrink-0">
					<ProviderBadge source={props.model.source} size="sm" />
				</div>
			</div>
		);
	}

	return (
		<div class="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 hover:border-brand-300 dark:hover:border-brand-600 transition-colors">
			<div class="flex items-start justify-between gap-2">
				<div class="min-w-0 flex-1">
					<h4 class="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
						{props.model.id}
					</h4>
					<p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
						{displayName()}
					</p>
				</div>
				<ProviderBadge source={props.model.source} size="sm" />
			</div>

			<div class="flex items-center gap-2 mt-2">
				{contextWindow() && (
					<span class="inline-flex items-center text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
						{contextWindow()} ctx
					</span>
				)}
				{hasThinking() && (
					<span class="inline-flex items-center text-xs px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
						💭 Thinking
					</span>
				)}
			</div>
		</div>
	);
};

export default ModelCard;
