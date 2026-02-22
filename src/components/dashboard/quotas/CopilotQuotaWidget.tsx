import { createSignal, For, onMount, Show } from "solid-js";
import { useI18n } from "../../../i18n";
import { getCachedOrFetch } from "../../../lib/quotaCache";
import { type CopilotQuotaResult, fetchCopilotQuota } from "../../../lib/tauri";

// Copilot Quota Widget - shows premium interactions and chat quotas for GitHub Copilot
export function CopilotQuotaWidget() {
	const { t } = useI18n();
	const [quotaData, setQuotaData] = createSignal<CopilotQuotaResult[]>([]);
	const [loading, setLoading] = createSignal(false);
	const [error, setError] = createSignal<string | null>(null);
	const [expanded, setExpanded] = createSignal(false);

	const loadQuota = async (forceRefresh = false) => {
		setLoading(true);
		setError(null);
		try {
			const results = await getCachedOrFetch(
				"copilot",
				fetchCopilotQuota,
				forceRefresh,
			);
			setQuotaData(results);
		} catch (err) {
			setError(String(err));
		} finally {
			setLoading(false);
		}
	};

	onMount(() => {
		// Always try to load - copilot-api doesn't need OAuth
		loadQuota();
	});

	const getUsageColor = (percent: number, inverted = false) => {
		const value = inverted ? 100 - percent : percent;
		if (value >= 90) return "text-red-600 dark:text-red-400";
		if (value >= 70) return "text-yellow-600 dark:text-yellow-400";
		return "text-green-600 dark:text-green-400";
	};

	const getProgressColor = (percent: number, inverted = false) => {
		const value = inverted ? 100 - percent : percent;
		if (value >= 90) return "bg-red-500";
		if (value >= 70) return "bg-yellow-500";
		return "bg-green-500";
	};

	return (
		<div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
			{/* Header */}
			<div
				onClick={() => setExpanded(!expanded())}
				class="w-full flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
			>
				<div class="flex items-center gap-2">
					<img src="/logos/github.svg" alt="GitHub" class="w-5 h-5 rounded" />
					<span class="text-sm font-semibold text-gray-900 dark:text-gray-100">
						{t("dashboard.quota.githubCopilotTitle")}
					</span>
					<Show when={quotaData().length > 0}>
						<span class="text-xs text-gray-500 dark:text-gray-400">
							{t("dashboard.antigravity.accountsCount", {
								count: quotaData().length,
							})}
						</span>
					</Show>
				</div>
				<div class="flex items-center gap-2">
					<button
						onClick={(e) => {
							e.stopPropagation();
							loadQuota(true);
						}}
						disabled={loading()}
						class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50"
						title={t("dashboard.quota.refresh")}
					>
						<svg
							class={`w-4 h-4 ${loading() ? "animate-spin" : ""}`}
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
							/>
						</svg>
					</button>
					<svg
						class={`w-4 h-4 text-gray-400 transition-transform ${expanded() ? "rotate-180" : ""}`}
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M19 9l-7 7-7-7"
						/>
					</svg>
				</div>
			</div>

			<Show when={expanded()}>
				<div class="p-4 space-y-4">
					<Show when={loading() && quotaData().length === 0}>
						<div class="flex items-center justify-center py-4 text-gray-500">
							<svg
								class="w-5 h-5 animate-spin mr-2"
								fill="none"
								viewBox="0 0 24 24"
							>
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
							{t("dashboard.quota.loadingQuota")}
						</div>
					</Show>

					<Show when={error()}>
						<div class="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
							<p class="text-sm text-red-700 dark:text-red-300">{error()}</p>
						</div>
					</Show>

					<For each={quotaData()}>
						{(account) => (
							<div class="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
								<div class="px-3 py-2 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
									<div class="flex items-center gap-2">
										<h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
											{account.accountLogin}
										</h4>
										<span class="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-medium uppercase">
											{account.plan}
										</span>
									</div>
									<Show when={account.error}>
										<span class="text-[10px] text-red-500 font-medium">
											{t("dashboard.quota.apiError")}
										</span>
									</Show>
								</div>
								<div class="p-3 bg-white dark:bg-gray-800 space-y-3">
									{/* Premium Interactions (remaining %) */}
									<div>
										<div class="flex items-center justify-between mb-1">
											<span class="text-xs text-gray-500">
												{t("dashboard.quota.premiumInteractions")}
											</span>
											<span
												class={`text-xs font-medium ${getUsageColor(account.premiumInteractionsPercent, true)}`}
											>
												{t("dashboard.quota.percentUsed", {
													count: (
														100 - account.premiumInteractionsPercent
													).toFixed(0),
												})}
											</span>
										</div>
										<div class="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
											<div
												class={`h-full ${getProgressColor(account.premiumInteractionsPercent, true)} transition-all`}
												style={{
													width: `${Math.min(100 - account.premiumInteractionsPercent, 100)}%`,
												}}
											/>
										</div>
									</div>

									{/* Chat (remaining %) */}
									<div>
										<div class="flex items-center justify-between mb-1">
											<span class="text-xs text-gray-500">
												{t("dashboard.quota.chat")}
											</span>
											<span
												class={`text-xs font-medium ${getUsageColor(account.chatPercent, true)}`}
											>
												{t("dashboard.quota.percentUsed", {
													count: (100 - account.chatPercent).toFixed(0),
												})}
											</span>
										</div>
										<div class="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
											<div
												class={`h-full ${getProgressColor(account.chatPercent, true)} transition-all`}
												style={{
													width: `${Math.min(100 - account.chatPercent, 100)}%`,
												}}
											/>
										</div>
									</div>

									<Show when={account.error}>
										<p class="text-[10px] text-red-500 bg-red-50 dark:bg-red-900/20 p-1.5 rounded">
											{account.error}
										</p>
									</Show>
								</div>
							</div>
						)}
					</For>

					<Show when={!loading() && quotaData().length === 0 && !error()}>
						<p class="text-sm text-gray-500 text-center py-2">
							{t("dashboard.quota.noCopilotAccounts")}
						</p>
					</Show>
				</div>
			</Show>
		</div>
	);
}
