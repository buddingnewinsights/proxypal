import { createSignal, For, Show } from "solid-js";
import {
	ClaudeKeysTab,
	CodexKeysTab,
	GeminiKeysTab,
	OpenAICompatibleTab,
	VertexKeysTab,
} from "../components/api-keys";
import { Button } from "../components/ui";
import { useI18n } from "../i18n";
import { appStore } from "../stores/app";

type TabId = "gemini" | "claude" | "codex" | "openai-compatible" | "vertex";

interface Tab {
	id: TabId;
	label: string;
	icon: string;
}

const TABS: Tab[] = [
	{ id: "gemini", label: "Gemini", icon: "/logos/gemini.svg" },
	{ id: "claude", label: "Claude", icon: "/logos/claude.svg" },
	{ id: "codex", label: "Codex", icon: "/logos/openai.svg" },
	{ id: "openai-compatible", label: "OpenAI", icon: "/logos/openai.svg" },
	{ id: "vertex", label: "Vertex", icon: "/logos/vertex.svg" },
];

export function ApiKeysPage() {
	const { t } = useI18n();
	const { setCurrentPage, proxyStatus } = appStore;
	const [activeTab, setActiveTab] = createSignal<TabId>("gemini");
	const [loading, setLoading] = createSignal(false);
	const [showAddForm, setShowAddForm] = createSignal(false);

	return (
		<div class="min-h-screen flex flex-col bg-white dark:bg-gray-900">
			{/* Header */}
			<header class="sticky top-0 z-10 px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
				<div class="flex items-center gap-2 sm:gap-3">
					<Button
						variant="ghost"
						size="sm"
						onClick={() => setCurrentPage("settings")}
					>
						<svg
							class="w-5 h-5"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M15 19l-7-7 7-7"
							/>
						</svg>
					</Button>
					<h1 class="font-bold text-lg text-gray-900 dark:text-gray-100">
						{t("apiKeys.title")}
					</h1>
					<Show when={loading()}>
						<span class="text-xs text-gray-400 ml-2 flex items-center gap-1">
							<svg class="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
								<circle
									class="opacity-25"
									cx="12"
									cy="12"
									r="10"
									stroke="currentColor"
									stroke-width="4"
								/>
								<path
									class="opacity-75"
									fill="currentColor"
									d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
								/>
							</svg>
							{t("common.loading")}
						</span>
					</Show>
				</div>
			</header>

			{/* Proxy not running warning */}
			<Show when={!proxyStatus().running}>
				<div class="mx-4 sm:mx-6 mt-4 p-4 rounded-xl bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
					<div class="flex items-center gap-3">
						<svg
							class="w-5 h-5 text-yellow-600 dark:text-yellow-400"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
							/>
						</svg>
						<div>
							<p class="text-sm font-medium text-yellow-800 dark:text-yellow-200">
								{t("apiKeys.proxyNotRunning")}
							</p>
							<p class="text-xs text-yellow-600 dark:text-yellow-400 mt-0.5">
								{t("apiKeys.startProxyServerDescription")}
							</p>
						</div>
					</div>
				</div>
			</Show>

			{/* Main content */}
			<main class="flex-1 p-4 sm:p-6 overflow-y-auto flex flex-col">
				<div class="max-w-2xl mx-auto space-y-4 sm:space-y-6">
					{/* Tabs */}
					<div class="flex gap-1 p-1 rounded-xl bg-gray-100 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
						<For each={TABS}>
							{(tab) => (
								<button
									class={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
										activeTab() === tab.id
											? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
											: "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
									}`}
									onClick={() => {
										setActiveTab(tab.id);
										setShowAddForm(false);
									}}
								>
									<img src={tab.icon} alt="" class="w-4 h-4" />
									<span class="hidden sm:inline">{tab.label}</span>
								</button>
							)}
						</For>
					</div>

					{/* Info text */}
					<p class="text-xs text-gray-500 dark:text-gray-400">
						{t("apiKeys.description")}
					</p>

					<Show when={activeTab() === "gemini"}>
						<GeminiKeysTab
							showAddForm={showAddForm}
							setShowAddForm={setShowAddForm}
							loading={loading}
							setLoading={setLoading}
						/>
					</Show>

					<Show when={activeTab() === "claude"}>
						<ClaudeKeysTab
							showAddForm={showAddForm}
							setShowAddForm={setShowAddForm}
							loading={loading}
							setLoading={setLoading}
						/>
					</Show>

					<Show when={activeTab() === "codex"}>
						<CodexKeysTab
							showAddForm={showAddForm}
							setShowAddForm={setShowAddForm}
							loading={loading}
							setLoading={setLoading}
						/>
					</Show>

					<Show when={activeTab() === "vertex"}>
						<VertexKeysTab
							showAddForm={showAddForm}
							setShowAddForm={setShowAddForm}
							loading={loading}
							setLoading={setLoading}
						/>
					</Show>

					<Show when={activeTab() === "openai-compatible"}>
						<OpenAICompatibleTab
							showAddForm={showAddForm}
							setShowAddForm={setShowAddForm}
							loading={loading}
							setLoading={setLoading}
						/>
					</Show>
				</div>
			</main>
		</div>
	);
}
