import { For, Show, splitProps } from "solid-js";
import { useI18n } from "../../i18n";
import type { Provider } from "../../lib/tauri";
import { HealthIndicator } from "../HealthIndicator";

interface ProviderInfo {
	name: string;
	id: Provider;
	logo: string;
}

interface ProviderSectionProps {
	connected: ProviderInfo[];
	disconnected: ProviderInfo[];
	recentlyConnected: Set<Provider>;
	authStatus: Record<Provider, number>;
	connectingProvider: Provider | null;
	proxyRunning: boolean;
	onConnect: (provider: Provider) => Promise<void>;
	onDisconnect: (provider: Provider) => Promise<void>;
}

export function ProviderSection(props: ProviderSectionProps) {
	const { t } = useI18n();
	const [local] = splitProps(props, [
		"connected",
		"disconnected",
		"recentlyConnected",
		"authStatus",
		"connectingProvider",
		"proxyRunning",
		"onConnect",
		"onDisconnect",
	]);

	return (
		<div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
			<div class="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
				<span class="text-sm font-semibold text-gray-900 dark:text-gray-100">
					{t("dashboard.providers.title")}
				</span>
				<span class="text-xs text-gray-500 dark:text-gray-400">
					{t("dashboard.providers.connectedCount", {
						count: local.connected.length,
					})}
				</span>
			</div>

			{/* Connected providers */}
			<Show when={local.connected.length > 0}>
				<div class="p-3 border-b border-gray-100 dark:border-gray-700">
					<div class="flex flex-wrap gap-2">
						<For each={local.connected}>
							{(p) => (
								<div
									class={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${local.recentlyConnected.has(p.id) ? "bg-green-100 dark:bg-green-900/40 border-green-400" : "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"} group`}
								>
									<img src={p.logo} alt={p.name} class="w-4 h-4 rounded" />
									<span class="text-sm font-medium text-green-800 dark:text-green-300">
										{p.name}
									</span>
									{/* Account count badge - show when more than 1 account */}
									<Show when={local.authStatus[p.id] > 1}>
										<span class="text-[10px] font-medium text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-800/50 px-1.5 py-0.5 rounded-full">
											{local.authStatus[p.id]}
										</span>
									</Show>
									<HealthIndicator provider={p.id} />
									{/* Add another account button */}
									<button
										onClick={() => local.onConnect(p.id)}
										disabled={local.connectingProvider !== null}
										class="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-green-600 dark:hover:text-green-400 transition-opacity disabled:opacity-30"
										title={t("dashboard.providers.addAnotherAccount")}
									>
										{local.connectingProvider === p.id ? (
											<svg
												class="w-3.5 h-3.5 animate-spin"
												fill="none"
												stroke="currentColor"
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
										) : (
											<svg
												class="w-3.5 h-3.5"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M12 4v16m8-8H4"
												/>
											</svg>
										)}
									</button>
									{/* Disconnect button */}
									<button
										onClick={() => local.onDisconnect(p.id)}
										class="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity -mr-1"
										title={t("dashboard.providers.disconnectAll")}
									>
										<svg
											class="w-3.5 h-3.5"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M6 18L18 6M6 6l12 12"
											/>
										</svg>
									</button>
								</div>
							)}
						</For>
					</div>
				</div>
			</Show>

			{/* Add providers */}
			<Show when={local.disconnected.length > 0}>
				<div class="p-3">
					<Show when={!local.proxyRunning}>
						<p class="text-xs text-amber-600 dark:text-amber-400 mb-2">
							{t("dashboard.providers.startProxyToConnect")}
						</p>
					</Show>
					<div class="flex flex-wrap gap-2">
						<For each={local.disconnected}>
							{(p) => (
								<button
									onClick={() => local.onConnect(p.id)}
									disabled={
										!local.proxyRunning || local.connectingProvider !== null
									}
									class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:border-brand-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
								>
									<img
										src={p.logo}
										alt={p.name}
										class="w-4 h-4 rounded opacity-60"
									/>
									<span class="text-sm text-gray-600 dark:text-gray-400">
										{p.name}
									</span>
									{local.connectingProvider === p.id ? (
										<svg
											class="w-3 h-3 animate-spin text-gray-400"
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
									) : (
										<svg
											class="w-3 h-3 text-gray-400"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M12 4v16m8-8H4"
											/>
										</svg>
									)}
								</button>
							)}
						</For>
					</div>
				</div>
			</Show>
		</div>
	);
}
