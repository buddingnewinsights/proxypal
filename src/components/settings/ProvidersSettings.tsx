import { createMemo, createSignal, For, onMount, Show } from "solid-js";
import { useI18n } from "../../i18n";
import type {
	AppConfig,
	AvailableModel,
	CopilotApiDetection,
} from "../../lib/tauri";
import { detectCopilotApi, getAvailableModels } from "../../lib/tauri";
import { appStore } from "../../stores/app";
import { toastStore } from "../../stores/toast";
import { Button } from "../ui";

interface ProvidersSettingsProps {
	config: AppConfig;
	setConfig: (updater: (prev: AppConfig) => AppConfig) => void;
}

export function ProvidersSettings(props: ProvidersSettingsProps) {
	const { t } = useI18n();
	void props;

	const { authStatus, setCurrentPage } = appStore;

	const [models, setModels] = createSignal<AvailableModel[]>([]);

	const oauthModelsBySource = createMemo(() => {
		const oauthSources = ["oauth", "copilot", "claude-oauth", "gemini-oauth"];
		const oauthModels = models().filter((m) =>
			oauthSources.some((src) =>
				m.source?.toLowerCase().includes(src.toLowerCase()),
			),
		);

		// Group by source
		const grouped: Record<string, string[]> = {};
		for (const model of oauthModels) {
			const source = model.source || "unknown";
			if (!grouped[source]) {
				grouped[source] = [];
			}
			grouped[source].push(model.id);
		}
		return grouped;
	});

	// Copilot Detection state
	const [copilotDetection, setCopilotDetection] =
		createSignal<CopilotApiDetection | null>(null);
	const [detectingCopilot, setDetectingCopilot] = createSignal(false);

	onMount(async () => {
		// Load models if proxy is running
		if (appStore.proxyStatus().running) {
			try {
				const availableModels = await getAvailableModels();
				setModels(availableModels);
			} catch (err) {
				console.error("Failed to load models:", err);
			}
		}
	});

	const runCopilotDetection = async () => {
		setDetectingCopilot(true);
		try {
			const result = await detectCopilotApi();
			setCopilotDetection(result);
		} catch (error) {
			console.error("Copilot detection failed:", error);
			toastStore.error(t("settings.toasts.detectionFailed"), String(error));
		} finally {
			setDetectingCopilot(false);
		}
	};

	const connectedCount = () => {
		const auth = authStatus();
		return [
			auth.claude,
			auth.openai,
			auth.gemini,
			auth.antigravity,
			auth.qwen,
			auth.iflow,
			auth.vertex,
		].filter(Boolean).length;
	};

	return (
		<>
			{/* Copilot Detection */}
			<div class="space-y-4">
				<h2 class="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
					{t("settings.copilot.title")}
				</h2>

				<div class="space-y-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
					<p class="text-xs text-gray-500 dark:text-gray-400">
						{t("settings.copilot.description")}
					</p>

					<Button
						variant="secondary"
						size="sm"
						onClick={runCopilotDetection}
						disabled={detectingCopilot()}
					>
						{detectingCopilot()
							? t("settings.copilot.detecting")
							: t("settings.copilot.checkSystem")}
					</Button>

					<Show when={copilotDetection()}>
						{(detection) => (
							<div class="space-y-3 text-xs">
								<div class="flex items-center gap-2">
									<span
										class={`w-2 h-2 rounded-full ${detection().nodeAvailable ? "bg-green-500" : "bg-red-500"}`}
									/>
									<span class="font-medium">
										{t("settings.copilot.nodeJsLabel")}
									</span>
									<span
										class={
											detection().nodeAvailable
												? "text-green-600 dark:text-green-400"
												: "text-red-600 dark:text-red-400"
										}
									>
										{detection().nodeAvailable
											? detection().nodeBin || t("settings.copilot.available")
											: t("settings.copilot.notFound")}
									</span>
								</div>

								<div class="flex items-center gap-2">
									<span
										class={`w-2 h-2 rounded-full ${detection().installed ? "bg-green-500" : "bg-blue-500"}`}
									/>
									<span class="font-medium">
										{t("settings.copilot.copilotApiLabel")}
									</span>
									<span
										class={
											detection().installed
												? "text-green-600 dark:text-green-400"
												: "text-blue-600 dark:text-blue-400"
										}
									>
										{detection().installed
											? `${t("settings.copilot.installed")}${detection().version ? ` (v${detection().version})` : ""}`
											: t("settings.copilot.willDownload")}
									</span>
								</div>

								<Show when={!detection().installed}>
									<div class="text-gray-500 dark:text-gray-400 pl-4">
										{t("settings.copilot.downloadHint")}
									</div>
								</Show>

								<Show when={detection().installed && detection().copilotBin}>
									<div class="text-gray-500 dark:text-gray-400 pl-4">
										{t("settings.copilot.path")}:{" "}
										<code class="bg-gray-200 dark:bg-gray-700 px-1 rounded">
											{detection().copilotBin}
										</code>
									</div>
								</Show>

								<Show when={detection().npxBin}>
									<div class="text-gray-500 dark:text-gray-400 pl-4">
										{t("settings.copilot.npxAvailableAt")}{" "}
										<code class="bg-gray-200 dark:bg-gray-700 px-1 rounded">
											{detection().npxBin}
										</code>
									</div>
								</Show>

								<Show when={!detection().nodeAvailable}>
									<div class="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-400">
										<p class="font-medium">
											{t("settings.copilot.nodeNotFound")}
										</p>
										<p class="mt-1">
											{t("settings.copilot.installNodePrefix")}{" "}
											<a
												href="https://nodejs.org/"
												target="_blank"
												class="underline"
												rel="noopener"
											>
												nodejs.org
											</a>{" "}
											{t("settings.copilot.installNodeSuffix")}
										</p>
										<Show when={detection().checkedNodePaths.length > 0}>
											<details class="mt-2">
												<summary class="cursor-pointer text-xs">
													{t("settings.copilot.checkedPaths")}
												</summary>
												<ul class="mt-1 pl-4 text-xs opacity-75">
													<For each={detection().checkedNodePaths}>
														{(p) => <li>{p}</li>}
													</For>
												</ul>
											</details>
										</Show>
									</div>
								</Show>
							</div>
						)}
					</Show>
				</div>
			</div>

			{/* Accounts */}
			<div class="space-y-4">
				<h2 class="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
					Connected Accounts
				</h2>

				<div class="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
					<div class="flex items-center justify-between">
						<div>
							<p class="text-sm font-medium text-gray-700 dark:text-gray-300">
								{connectedCount()} of 4 providers connected
							</p>
							<p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
								Manage your AI provider connections
							</p>
						</div>
						<Button
							variant="secondary"
							size="sm"
							onClick={() => setCurrentPage("dashboard")}
						>
							<svg
								class="w-4 h-4 mr-1.5"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0z"
								/>
							</svg>
							Manage
						</Button>
					</div>
				</div>
			</div>

			{/* OAuth Model Mappings */}
			<div class="space-y-4">
				<h2 class="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
					OAuth Model Mappings
				</h2>

				<div class="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
					<Show
						when={Object.keys(oauthModelsBySource()).length > 0}
						fallback={
							<p class="text-sm text-gray-500 dark:text-gray-400">
								No OAuth-sourced models available. Connect an OAuth provider to
								see models here.
							</p>
						}
					>
						<div class="space-y-4">
							<For each={Object.entries(oauthModelsBySource())}>
								{([source, modelIds]) => (
									<div>
										<p class="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2 flex items-center gap-2">
											<span
												class={`w-2 h-2 rounded-full ${
													source.includes("copilot")
														? "bg-purple-500"
														: source.includes("claude")
															? "bg-orange-500"
															: source.includes("gemini")
																? "bg-blue-500"
																: "bg-green-500"
												}`}
											/>
											{source
												.replace(/-/g, " ")
												.replace(/\b\w/g, (c) => c.toUpperCase())}
										</p>
										<div class="flex flex-wrap gap-1.5">
											<For each={modelIds}>
												{(modelId) => (
													<span class="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
														{modelId}
													</span>
												)}
											</For>
										</div>
									</div>
								)}
							</For>
						</div>
					</Show>
					<p class="text-xs text-gray-400 dark:text-gray-500 mt-3">
						These models are available through OAuth-authenticated accounts and
						are automatically routed by ProxyPal.
					</p>
				</div>
			</div>
		</>
	);
}
