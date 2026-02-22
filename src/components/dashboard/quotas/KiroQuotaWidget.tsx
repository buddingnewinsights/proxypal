import { createSignal, For, onMount, Show } from "solid-js";
import { useI18n } from "../../../i18n";
import { getCachedOrFetch } from "../../../lib/quotaCache";
import { fetchKiroQuota, type KiroQuotaResult } from "../../../lib/tauri";

// Kiro Quota Widget - shows agentic AI credits for Kiro accounts
export function KiroQuotaWidget() {
	const { t } = useI18n();
	const [quotaData, setQuotaData] = createSignal<KiroQuotaResult[]>([]);
	const [loading, setLoading] = createSignal(false);
	const [expanded, setExpanded] = createSignal(false);

	const loadQuota = async (forceRefresh = false) => {
		setLoading(true);
		try {
			const results = await getCachedOrFetch(
				"kiro",
				fetchKiroQuota,
				forceRefresh,
			);
			setQuotaData(results);
		} catch (err) {
			console.error("Failed to fetch Kiro quota:", err);
		} finally {
			setLoading(false);
		}
	};

	onMount(() => {
		loadQuota();
	});

	return (
		<div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
			{/* Header - same pattern as Antigravity / Claude Quota */}
			<div
				onClick={() => setExpanded(!expanded())}
				class="w-full flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
			>
				<div class="flex items-center gap-2">
					<img src="/logos/kiro.svg" alt="Kiro" class="w-5 h-5 rounded" />
					<span class="text-sm font-semibold text-gray-900 dark:text-gray-100">
						{t("dashboard.kiro.title")}
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
						type="button"
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
						<div class="flex items-center justify-center py-4 text-gray-500 dark:text-gray-400">
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
							Loading quota...
						</div>
					</Show>

					<For each={quotaData()}>
						{(quota) => (
							<div class="p-4 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700/50 space-y-3">
								{/* Account Header */}
								<div class="flex items-center justify-between">
									<div class="flex items-center gap-2">
										<span class="text-xs font-medium text-gray-900 dark:text-gray-100">
											{quota.accountEmail}
										</span>
										<span class="px-1.5 py-0.5 rounded-md bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 text-[10px] font-bold uppercase tracking-wider">
											{quota.plan}
										</span>
									</div>
								</div>

								{/* Plan Credits */}
								<Show when={quota.totalCredits > 0}>
									<div class="space-y-1">
										<div class="flex items-center justify-between">
											<span class="text-xs text-gray-500 dark:text-gray-400">
												Plan Credits
											</span>
											<div class="flex items-center gap-2">
												<Show when={quota.resetsOn}>
													<span class="text-[10px] text-brand-600 dark:text-brand-400">
														Resets {quota.resetsOn}
													</span>
												</Show>
												<span class="text-xs font-medium text-gray-900 dark:text-gray-100">
													{quota.usedCredits.toFixed(2)} / {quota.totalCredits}{" "}
													used
												</span>
											</div>
										</div>
										<div class="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
											<div
												class="h-full bg-brand-500 transition-all duration-300"
												style={{ width: `${quota.usedPercent}%` }}
											/>
										</div>
									</div>
								</Show>

								{/* Bonus Credits */}
								<Show when={quota.bonusCreditsTotal > 0}>
									<div class="space-y-1">
										<div class="flex items-center justify-between">
											<div class="flex items-center gap-1.5">
												<svg
													class="w-3.5 h-3.5 text-amber-500"
													fill="currentColor"
													viewBox="0 0 20 20"
												>
													<path
														fill-rule="evenodd"
														d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
														clip-rule="evenodd"
													/>
												</svg>
												<span class="text-xs text-gray-500 dark:text-gray-400">
													Bonus Credits
												</span>
											</div>
											<div class="flex items-center gap-2">
												<Show when={quota.bonusCreditsExpiresDays}>
													<span class="text-[10px] text-amber-600 dark:text-amber-400">
														Expires in {quota.bonusCreditsExpiresDays} days
													</span>
												</Show>
												<span class="text-xs font-medium text-gray-900 dark:text-gray-100">
													{quota.bonusCreditsUsed.toFixed(2)} /{" "}
													{quota.bonusCreditsTotal} used
												</span>
											</div>
										</div>
										<div class="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
											<div
												class="h-full bg-amber-500 transition-all duration-300"
												style={{
													width: `${(quota.bonusCreditsUsed / quota.bonusCreditsTotal) * 100}%`,
												}}
											/>
										</div>
									</div>
								</Show>

								{/* No Data / Error State */}
								<Show
									when={quota.totalCredits > 0 || quota.bonusCreditsTotal > 0}
									fallback={
										<div class="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
											<svg
												class="w-4 h-4 shrink-0"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
												/>
											</svg>
											<span>
												{quota.error || "Manual check required on app.kiro.dev"}
											</span>
										</div>
									}
								>
									{null}
								</Show>
							</div>
						)}
					</For>

					<Show when={!loading() && quotaData().length === 0}>
						<div class="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
							No Kiro quota data. Install kiro-cli and sign in, or check
							app.kiro.dev.
						</div>
					</Show>
				</div>
			</Show>
		</div>
	);
}
