import { type Component, createSignal, For, Show } from "solid-js";
import { ModelCard, type ModelInfo } from "./ModelCard";

interface ModelsListProps {
	models: ModelInfo[];
	title?: string;
	defaultExpanded?: boolean;
	compact?: boolean;
	maxVisible?: number;
}

export const ModelsList: Component<ModelsListProps> = (props) => {
	const [expanded, setExpanded] = createSignal(props.defaultExpanded ?? false);
	const [showAll, setShowAll] = createSignal(false);

	const maxVisible = () => props.maxVisible ?? 5;
	const compact = () => props.compact ?? false;
	const title = () => props.title ?? "Available Models";

	const visibleModels = () => {
		if (showAll() || props.models.length <= maxVisible()) {
			return props.models;
		}
		return props.models.slice(0, maxVisible());
	};

	const hasMore = () => props.models.length > maxVisible();
	const remainingCount = () => props.models.length - maxVisible();

	return (
		<div class="w-full">
			{/* Header */}
			<button
				type="button"
				onClick={() => setExpanded(!expanded())}
				class="w-full flex items-center justify-between py-2 px-1 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg transition-colors"
			>
				<div class="flex items-center gap-2">
					<svg
						class={`w-4 h-4 text-gray-500 transition-transform ${expanded() ? "rotate-90" : ""}`}
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 5l7 7-7 7"
						/>
					</svg>
					<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
						{title()}
					</span>
				</div>
				<span class="text-xs font-medium text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/30 px-2 py-0.5 rounded-full">
					{props.models.length}
				</span>
			</button>

			{/* Models List */}
			<Show when={expanded()}>
				<div class="mt-2 space-y-2 pl-6">
					<For each={visibleModels()}>
						{(model) => <ModelCard model={model} compact={compact()} />}
					</For>

					{/* Show More Button */}
					<Show when={hasMore() && !showAll()}>
						<button
							type="button"
							onClick={() => setShowAll(true)}
							class="w-full py-2 text-sm text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 font-medium"
						>
							Show {remainingCount()} more models...
						</button>
					</Show>

					{/* Show Less Button */}
					<Show when={showAll() && hasMore()}>
						<button
							type="button"
							onClick={() => setShowAll(false)}
							class="w-full py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
						>
							Show less
						</button>
					</Show>
				</div>
			</Show>
		</div>
	);
};

export default ModelsList;
