import { open } from "@tauri-apps/plugin-dialog";
import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { ApiEndpoint } from "../components/ApiEndpoint";
import { openCommandPalette } from "../components/CommandPalette";
import { CopilotCard } from "../components/CopilotCard";
import { OnboardingChecklist } from "../components/dashboard/OnboardingChecklist";
import { ProviderSection } from "../components/dashboard/ProviderSection";
import {
	ClaudeQuotaWidget,
	CodexQuotaWidget,
	CopilotQuotaWidget,
	KiroQuotaWidget,
	QuotaWidget,
} from "../components/dashboard/quotas";
import { OAuthModal } from "../components/OAuthModal";
import { OpenCodeKitBanner } from "../components/OpenCodeKitBanner";
import { StatusIndicator } from "../components/StatusIndicator";
import { Button } from "../components/ui";
import { useI18n } from "../i18n";
import {
	type AgentConfigResult,
	type AvailableModel,
	appendToShellProfile,
	type CopilotConfig,
	detectCliAgents,
	disconnectProvider,
	getOAuthUrl,
	getUsageStats,
	importVertexCredential,
	type OAuthUrlResponse,
	onRequestLog,
	openUrlInBrowser,
	type Provider,
	pollOAuthStatus,
	refreshAuthStatus,
	startProxy,
	stopProxy,
	syncUsageFromProxy,
	type UsageStats,
} from "../lib/tauri";
import { appStore } from "../stores/app";
import { requestStore } from "../stores/requests";
import { toastStore } from "../stores/toast";

const providers = [
	{ name: "Claude", provider: "claude" as Provider, logo: "/logos/claude.svg" },
	{
		name: "ChatGPT",
		provider: "openai" as Provider,
		logo: "/logos/openai.svg",
	},
	{ name: "Gemini", provider: "gemini" as Provider, logo: "/logos/gemini.svg" },
	{ name: "Qwen", provider: "qwen" as Provider, logo: "/logos/qwen.png" },
	{ name: "iFlow", provider: "iflow" as Provider, logo: "/logos/iflow.svg" },
	{
		name: "Vertex AI",
		provider: "vertex" as Provider,
		logo: "/logos/vertex.svg",
	},
	{
		name: "Antigravity",
		provider: "antigravity" as Provider,
		logo: "/logos/antigravity.webp",
	},
	{
		name: "Kiro",
		provider: "kiro" as Provider,
		logo: "/logos/kiro.svg",
	},
	{
		name: "Kimi",
		provider: "kimi" as Provider,
		logo: "/logos/kimi.png",
	},
];

// Compact KPI tile - matches Analytics StatCard styling
function KpiTile(props: {
	label: string;
	value: string;
	subtext?: string;
	icon: "bolt" | "check" | "dollar";
	onClick?: () => void;
}) {
	const icons = {
		bolt: (
			<svg
				class="w-4 h-4"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M13 10V3L4 14h7v7l9-11h-7z"
				/>
			</svg>
		),
		check: (
			<svg
				class="w-4 h-4"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
				/>
			</svg>
		),
		dollar: (
			<svg
				class="w-4 h-4"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
				/>
			</svg>
		),
	};

	return (
		<button
			onClick={props.onClick}
			class={`p-3 rounded-xl border text-left transition-all hover:scale-[1.02] hover:shadow-md bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800/50 text-blue-700 dark:text-blue-300 ${props.onClick ? "cursor-pointer" : "cursor-default"}`}
		>
			<div class="flex items-center gap-1.5 mb-1 opacity-80">
				{icons[props.icon]}
				<span class="text-[10px] font-medium uppercase tracking-wider">
					{props.label}
				</span>
			</div>
			<p class="text-xl font-bold tabular-nums">{props.value}</p>
			<Show when={props.subtext}>
				<p class="text-[10px] opacity-70 mt-0.5">{props.subtext}</p>
			</Show>
		</button>
	);
}

export function DashboardPage() {
	const { t } = useI18n();
	const {
		proxyStatus,
		setProxyStatus,
		authStatus,
		setAuthStatus,
		config,
		setConfig,
		setCurrentPage,
	} = appStore;
	const [toggling, setToggling] = createSignal(false);
	const [connecting, setConnecting] = createSignal<Provider | null>(null);
	const [recentlyConnected, setRecentlyConnected] = createSignal<Set<Provider>>(
		new Set(),
	);
	const [hasConfiguredAgent, setHasConfiguredAgent] = createSignal(false);
	const [refreshingAgents, setRefreshingAgents] = createSignal(false);
	const [configResult, setConfigResult] = createSignal<{
		result: AgentConfigResult;
		agentName: string;
		models?: AvailableModel[];
	} | null>(null);
	// No dismiss state - onboarding stays until setup complete
	// Use centralized store for history
	const history = requestStore.history;
	const [stats, setStats] = createSignal<UsageStats | null>(null);

	// OAuth Modal state
	const [oauthModalProvider, setOauthModalProvider] =
		createSignal<Provider | null>(null);
	const [oauthUrlData, setOauthUrlData] = createSignal<OAuthUrlResponse | null>(
		null,
	);
	const [oauthLoading, setOauthLoading] = createSignal(false);

	const getProviderName = (provider: Provider): string => {
		const found = providers.find((p) => p.provider === provider);
		return found?.name || provider;
	};

	// Copilot config handler
	const handleCopilotConfigChange = (copilotConfig: CopilotConfig) => {
		setConfig({ ...config(), copilot: copilotConfig });
	};

	// Load data on mount
	const loadAgents = async () => {
		if (refreshingAgents()) return;
		setRefreshingAgents(true);
		try {
			const detected = await detectCliAgents();
			setHasConfiguredAgent(detected.some((a) => a.configured));
		} catch (err) {
			console.error("Failed to load agents:", err);
			toastStore.error(
				t("agentSetup.toasts.failedToDetectCliAgents"),
				String(err),
			);
		} finally {
			setRefreshingAgents(false);
		}
	};

	onMount(async () => {
		// Load agents - handle independently to avoid one failure blocking others
		try {
			const agentList = await detectCliAgents();
			setHasConfiguredAgent(agentList.some((a) => a.configured));
		} catch (err) {
			console.error("Failed to detect CLI agents:", err);
		}

		// Load history from centralized store
		try {
			await requestStore.loadHistory();

			// Sync real token data from proxy if running
			if (appStore.proxyStatus().running) {
				try {
					await syncUsageFromProxy();
					await requestStore.loadHistory(); // Reload to get synced data
				} catch (syncErr) {
					console.warn("Failed to sync usage from proxy:", syncErr);
					// Continue with disk-only history
				}
			}
		} catch (err) {
			console.error("Failed to load request history:", err);
		}

		// Load usage stats
		try {
			const usage = await getUsageStats();
			setStats(usage);
		} catch (err) {
			console.error("Failed to load usage stats:", err);
		}

		// Listen for new requests and refresh stats only
		// History is handled by RequestMonitor via centralized store
		const unlisten = await onRequestLog(async () => {
			// Debounce: wait 1 second after request to allow backend to process
			setTimeout(async () => {
				try {
					// Refresh stats only - history is updated by RequestMonitor
					const usage = await getUsageStats();
					setStats(usage);
				} catch (err) {
					console.error("Failed to refresh stats after new request:", err);
				}
			}, 1000);
		});

		// Cleanup listener on unmount
		onCleanup(() => {
			unlisten();
		});
	});

	// Setup complete when: proxy running + provider connected + agent configured
	const isSetupComplete = () =>
		proxyStatus().running && hasAnyProvider() && hasConfiguredAgent();

	// Onboarding shows until setup complete (no dismiss option)

	const toggleProxy = async () => {
		if (toggling()) return;
		setToggling(true);
		try {
			if (proxyStatus().running) {
				const status = await stopProxy();
				setProxyStatus(status);
				toastStore.info(t("dashboard.toasts.proxyStopped"));
			} else {
				const status = await startProxy();
				setProxyStatus(status);
				toastStore.success(
					t("dashboard.toasts.proxyStarted"),
					t("dashboard.toasts.listeningOnPort", { port: status.port }),
				);
			}
		} catch (error) {
			console.error("Failed to toggle proxy:", error);
			toastStore.error(
				t("dashboard.toasts.failedToToggleProxy"),
				String(error),
			);
		} finally {
			setToggling(false);
		}
	};

	const handleConnect = async (provider: Provider) => {
		if (!proxyStatus().running) {
			toastStore.warning(
				t("dashboard.toasts.startProxyFirst"),
				t("dashboard.toasts.proxyMustRunToConnectAccounts"),
			);
			return;
		}

		// Vertex uses service account import, not OAuth
		if (provider === "vertex") {
			setConnecting(provider);
			toastStore.info(
				t("dashboard.toasts.importVertexServiceAccount"),
				t("dashboard.toasts.selectServiceAccountJson"),
			);
			try {
				const selected = await open({
					multiple: false,
					filters: [{ name: "JSON", extensions: ["json"] }],
				});
				const selectedPath = Array.isArray(selected) ? selected[0] : selected;
				if (!selectedPath) {
					setConnecting(null);
					toastStore.warning(
						t("dashboard.toasts.noFileSelected"),
						t("dashboard.toasts.chooseServiceAccountJson"),
					);
					return;
				}
				await importVertexCredential(selectedPath);
				const newAuth = await refreshAuthStatus();
				setAuthStatus(newAuth);
				setConnecting(null);
				setRecentlyConnected((prev) => new Set([...prev, provider]));
				setTimeout(() => {
					setRecentlyConnected((prev) => {
						const next = new Set(prev);
						next.delete(provider);
						return next;
					});
				}, 2000);
				toastStore.success(
					t("dashboard.toasts.vertexConnected"),
					t("dashboard.toasts.serviceAccountImportedSuccessfully"),
				);
			} catch (error) {
				console.error("Vertex import failed:", error);
				setConnecting(null);
				toastStore.error(t("dashboard.toasts.connectionFailed"), String(error));
			}
			return;
		}

		// For OAuth providers, get the URL first and show modal
		setConnecting(provider);
		try {
			const urlData = await getOAuthUrl(provider);
			setOauthUrlData(urlData);
			setOauthModalProvider(provider);
			setConnecting(null);
		} catch (error) {
			console.error("Failed to get OAuth URL:", error);
			setConnecting(null);
			toastStore.error(t("dashboard.toasts.connectionFailed"), String(error));
		}
	};

	const handleStartOAuth = async () => {
		const provider = oauthModalProvider();
		const urlData = oauthUrlData();
		if (!provider || !urlData) return;

		setOauthLoading(true);

		try {
			// Open the browser with the OAuth URL
			await openUrlInBrowser(urlData.url);
			toastStore.info(
				t("dashboard.toasts.connectingToProvider", {
					provider: getProviderName(provider),
				}),
				t("dashboard.toasts.completeAuthenticationInBrowser"),
			);

			// Start polling for OAuth completion
			let attempts = 0;
			const maxAttempts = 120;
			const pollInterval = setInterval(async () => {
				attempts++;
				try {
					const completed = await pollOAuthStatus(urlData.state);
					if (completed) {
						clearInterval(pollInterval);
						// Add delay to ensure file is written before scanning
						await new Promise((resolve) => setTimeout(resolve, 500));

						// Get current count for this provider to detect new auth
						const currentAuth = authStatus();
						const currentCount = currentAuth[provider] || 0;

						// Retry refresh up to 3 times with delay if count doesn't increase
						let newAuth = await refreshAuthStatus();
						let retries = 0;
						while ((newAuth[provider] || 0) <= currentCount && retries < 3) {
							await new Promise((resolve) => setTimeout(resolve, 500));
							newAuth = await refreshAuthStatus();
							retries++;
						}

						setAuthStatus(newAuth);
						setOauthLoading(false);
						setOauthModalProvider(null);
						setOauthUrlData(null);
						setRecentlyConnected((prev) => new Set([...prev, provider]));
						setTimeout(() => {
							setRecentlyConnected((prev) => {
								const next = new Set(prev);
								next.delete(provider);
								return next;
							});
						}, 2000);
						toastStore.success(
							t("dashboard.toasts.providerConnected", {
								provider: getProviderName(provider),
							}),
							t("dashboard.toasts.youCanNowUseThisProvider"),
						);
					} else if (attempts >= maxAttempts) {
						clearInterval(pollInterval);
						setOauthLoading(false);
						toastStore.error(
							t("dashboard.toasts.connectionTimeout"),
							t("dashboard.toasts.pleaseTryAgain"),
						);
					}
				} catch (err) {
					console.error("Poll error:", err);
				}
			}, 1000);
			onCleanup(() => clearInterval(pollInterval));
		} catch (error) {
			console.error("Failed to open OAuth:", error);
			setOauthLoading(false);
			toastStore.error(t("dashboard.toasts.connectionFailed"), String(error));
		}
	};

	const handleAlreadyAuthorized = async () => {
		const provider = oauthModalProvider();
		const urlData = oauthUrlData();
		if (!provider || !urlData) return;

		setOauthLoading(true);

		// Check if auth is already complete
		try {
			const completed = await pollOAuthStatus(urlData.state);
			if (completed) {
				// Add delay to ensure file is written before scanning
				await new Promise((resolve) => setTimeout(resolve, 500));

				// Get current count for this provider to detect new auth
				const currentAuth = authStatus();
				const currentCount = currentAuth[provider] || 0;

				// Retry refresh up to 3 times with delay if count doesn't increase
				let newAuth = await refreshAuthStatus();
				let retries = 0;
				while ((newAuth[provider] || 0) <= currentCount && retries < 3) {
					await new Promise((resolve) => setTimeout(resolve, 500));
					newAuth = await refreshAuthStatus();
					retries++;
				}

				setAuthStatus(newAuth);
				setOauthLoading(false);
				setOauthModalProvider(null);
				setOauthUrlData(null);
				setRecentlyConnected((prev) => new Set([...prev, provider]));
				setTimeout(() => {
					setRecentlyConnected((prev) => {
						const next = new Set(prev);
						next.delete(provider);
						return next;
					});
				}, 2000);
				toastStore.success(
					t("dashboard.toasts.providerConnected", {
						provider: getProviderName(provider),
					}),
					t("dashboard.toasts.youCanNowUseThisProvider"),
				);
			} else {
				setOauthLoading(false);
				toastStore.warning(
					t("dashboard.toasts.notAuthorizedYet"),
					t("dashboard.toasts.completeAuthorizationInBrowserFirst"),
				);
			}
		} catch (err) {
			console.error("Check auth error:", err);
			setOauthLoading(false);
			toastStore.error(
				t("dashboard.toasts.failedToCheckAuthorization"),
				String(err),
			);
		}
	};

	const handleCancelOAuth = () => {
		setOauthModalProvider(null);
		setOauthUrlData(null);
		setOauthLoading(false);
	};

	const handleDisconnect = async (provider: Provider) => {
		try {
			await disconnectProvider(provider);
			const newAuth = await refreshAuthStatus();
			setAuthStatus(newAuth);
			toastStore.success(
				t("dashboard.toasts.providerDisconnected", {
					provider: getProviderName(provider),
				}),
			);
		} catch (error) {
			console.error("Failed to disconnect:", error);
			toastStore.error(t("dashboard.toasts.failedToDisconnect"), String(error));
		}
	};

	const connectedProviders = () =>
		providers.filter((p) => authStatus()[p.provider]);
	const disconnectedProviders = () =>
		providers.filter((p) => !authStatus()[p.provider]);
	const hasAnyProvider = () => connectedProviders().length > 0;

	const handleApplyEnv = async () => {
		const result = configResult();
		if (!result?.result.shellConfig) return;
		try {
			const profilePath = await appendToShellProfile(result.result.shellConfig);
			toastStore.success(
				t("settings.toasts.addedToShellProfile"),
				t("settings.toasts.updatedPath", { path: profilePath }),
			);
			setConfigResult(null);
			await loadAgents();
		} catch (error) {
			toastStore.error(
				t("settings.toasts.failedToUpdateShellProfile"),
				String(error),
			);
		}
	};

	// Format helpers
	const formatCost = (n: number) => (n < 0.01 ? "<$0.01" : `$${n.toFixed(2)}`);
	const formatTokens = (n: number) => {
		if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
		if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
		return n.toString();
	};

	// Estimated cost calculation (same as Analytics)
	const estimatedCost = () => {
		const s = stats();
		if (!s) return 0;
		// Average pricing: ~$3/1M input, ~$15/1M output (blended across models)
		const inputCost = (s.inputTokens / 1_000_000) * 3;
		const outputCost = (s.outputTokens / 1_000_000) * 15;
		return inputCost + outputCost;
	};

	// Model grouping helpers
	const groupModelsByProvider = (
		models: AvailableModel[],
	): { provider: string; models: string[] }[] => {
		const providerNames: Record<string, string> = {
			google: "Gemini",
			antigravity: "Gemini", // Antigravity uses Gemini models, group together
			openai: "OpenAI/Codex",
			qwen: "Qwen",
			anthropic: "Claude",
			iflow: "iFlow",
			vertex: "Vertex AI",
		};
		const grouped: Record<string, string[]> = {};
		for (const m of models) {
			const provider = providerNames[m.ownedBy] || m.ownedBy;
			if (!grouped[provider]) grouped[provider] = [];
			grouped[provider].push(m.id);
		}
		return Object.entries(grouped)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([provider, models]) => ({ provider, models }));
	};

	const getProviderColor = (provider: string): string => {
		const colors: Record<string, string> = {
			Gemini: "text-blue-600 dark:text-blue-400",
			"OpenAI/Codex": "text-green-600 dark:text-green-400",
			Qwen: "text-purple-600 dark:text-purple-400",
			Claude: "text-orange-600 dark:text-orange-400",
			iFlow: "text-cyan-600 dark:text-cyan-400",
			"Vertex AI": "text-red-600 dark:text-red-400",
		};
		return colors[provider] || "text-gray-600 dark:text-gray-400";
	};

	return (
		<div class="min-h-screen flex flex-col bg-white dark:bg-gray-900">
			{/* Header - Simplified (navigation handled by sidebar) */}
			<header class="sticky top-0 z-10 px-4 sm:px-6 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
				<div class="flex items-center justify-between max-w-3xl mx-auto">
					<h1 class="font-semibold text-lg text-gray-900 dark:text-gray-100">
						{t("sidebar.dashboard")}
					</h1>
					<div class="flex items-center gap-3">
						<button
							onClick={openCommandPalette}
							class="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-700 transition-colors"
							title={t("dashboard.commandPalette")}
						>
							<svg
								class="w-4 h-4"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
								/>
							</svg>
							<kbd class="px-1.5 py-0.5 text-[10px] font-medium bg-gray-200 dark:bg-gray-700 rounded">
								⌘K
							</kbd>
						</button>
						<StatusIndicator
							running={proxyStatus().running}
							onToggle={toggleProxy}
							disabled={toggling()}
						/>
					</div>
				</div>
			</header>

			{/* Main content */}
			<main class="flex-1 p-4 sm:p-6 overflow-y-auto flex flex-col">
				<div class="max-w-3xl mx-auto space-y-4">
					{/* === OpenCodeKit Banner === */}
					<OpenCodeKitBanner />

					{/* === ZONE 1: Onboarding (shows until setup complete) === */}
					<OnboardingChecklist
						isComplete={isSetupComplete()}
						proxyRunning={proxyStatus().running}
						isToggling={toggling()}
						onToggleProxy={toggleProxy}
						hasProvider={hasAnyProvider()}
						onConnectProvider={handleConnect}
						firstDisconnectedProvider={disconnectedProviders()[0]?.provider}
						hasAgent={hasConfiguredAgent()}
						onNavigateSettings={() => setCurrentPage("settings")}
					/>

					{/* === ZONE 2: Value Snapshot (KPIs) - 3-card layout matching Analytics === */}
					<Show
						when={
							history().requests.length > 0 ||
							(stats() && stats()!.totalRequests > 0)
						}
					>
						<div class="grid grid-cols-3 gap-3">
							<KpiTile
								label={t("dashboard.kpi.totalRequests")}
								value={formatTokens(
									stats()?.totalRequests || history().requests.length,
								)}
								subtext={t("dashboard.kpi.requestsToday", {
									count: stats()?.requestsToday || 0,
								})}
								icon="bolt"
								onClick={() => setCurrentPage("analytics")}
							/>
							<KpiTile
								label={t("dashboard.kpi.successRate")}
								value={`${stats() && stats()!.totalRequests > 0 ? Math.min(100, Math.round((stats()!.successCount / stats()!.totalRequests) * 100)) : 100}%`}
								subtext={t("dashboard.kpi.failedCount", {
									count: stats()?.failureCount || 0,
								})}
								icon="check"
								onClick={() => setCurrentPage("analytics")}
							/>
							<KpiTile
								label={t("dashboard.kpi.estimatedCost")}
								value={formatCost(estimatedCost())}
								subtext={t("dashboard.kpi.tokensCount", {
									count: formatTokens(stats()?.totalTokens || 0),
								})}
								icon="dollar"
								onClick={() => setCurrentPage("analytics")}
							/>
						</div>
					</Show>

					{/* === ZONE 3: Providers (Unified Card) === */}
					<ProviderSection
						connected={connectedProviders().map((p) => ({
							name: p.name,
							id: p.provider,
							logo: p.logo,
						}))}
						disconnected={disconnectedProviders().map((p) => ({
							name: p.name,
							id: p.provider,
							logo: p.logo,
						}))}
						recentlyConnected={recentlyConnected()}
						authStatus={authStatus() as Record<Provider, number>}
						connectingProvider={connecting()}
						proxyRunning={proxyStatus().running}
						onConnect={handleConnect}
						onDisconnect={handleDisconnect}
					/>

					{/* === ZONE 3.5: Antigravity Quota === */}
					<QuotaWidget authStatus={authStatus()} />

					{/* === ZONE 3.5b: OpenAI/Codex Quota === */}
					<CodexQuotaWidget authStatus={authStatus()} />

					{/* === ZONE 3.5c: Claude Quota === */}
					<ClaudeQuotaWidget />

					{/* === ZONE 3.5e: Kiro Quota === */}
					<KiroQuotaWidget />

					{/* === ZONE 3.5d: GitHub Copilot Quota === */}
					<CopilotQuotaWidget />

					{/* === ZONE 3.6: GitHub Copilot Config === */}
					<CopilotCard
						config={config().copilot}
						onConfigChange={handleCopilotConfigChange}
						proxyRunning={proxyStatus().running}
					/>

					{/* === ZONE 4: API Endpoint === */}
					<ApiEndpoint
						endpoint={proxyStatus().endpoint}
						running={proxyStatus().running}
					/>

					{/* Config Modal */}
					<Show when={configResult()}>
						<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in">
							<div class="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg animate-scale-in">
								<div class="p-6">
									<div class="flex items-center justify-between mb-4">
										<h2 class="text-lg font-bold text-gray-900 dark:text-gray-100">
											{t("agentSetup.configModal.agentConfigured", {
												agent: configResult()!.agentName,
											})}
										</h2>
										<button
											onClick={() => setConfigResult(null)}
											class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
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
													d="M6 18L18 6M6 6l12 12"
												/>
											</svg>
										</button>
									</div>

									<div class="space-y-4">
										<Show when={configResult()!.result.configPath}>
											<div class="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
												<div class="flex items-center gap-2 text-green-700 dark:text-green-300">
													<svg
														class="w-4 h-4"
														fill="none"
														stroke="currentColor"
														viewBox="0 0 24 24"
													>
														<path
															stroke-linecap="round"
															stroke-linejoin="round"
															stroke-width="2"
															d="M5 13l4 4L19 7"
														/>
													</svg>
													<span class="text-sm font-medium">
														{t("agentSetup.configModal.configFileCreated")}
													</span>
												</div>
												<p class="mt-1 text-xs text-green-600 dark:text-green-400 font-mono break-all">
													{configResult()!.result.configPath}
												</p>
											</div>
										</Show>

										{/* Models configured - grouped by provider */}
										<Show
											when={
												configResult()?.models &&
												(configResult()?.models?.length ?? 0) > 0
											}
										>
											<div class="space-y-2">
												<div class="flex items-center justify-between">
													<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
														{t("dashboard.configModal.modelsConfigured")}
													</span>
													<span class="text-xs text-gray-500 dark:text-gray-400">
														{configResult()?.models?.length ?? 0}{" "}
														{t("dashboard.configModal.total")}
													</span>
												</div>
												<div class="max-h-48 overflow-y-auto space-y-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
													<For
														each={groupModelsByProvider(
															configResult()?.models ?? [],
														)}
													>
														{(group) => (
															<div>
																<div class="flex items-center gap-2 mb-1.5">
																	<span
																		class={`text-xs font-semibold uppercase tracking-wider ${getProviderColor(group.provider)}`}
																	>
																		{group.provider}
																	</span>
																	<span class="text-xs text-gray-400">
																		({group.models.length})
																	</span>
																</div>
																<div class="flex flex-wrap gap-1">
																	<For each={group.models}>
																		{(model) => (
																			<span class="px-2 py-0.5 text-xs rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
																				{model}
																			</span>
																		)}
																	</For>
																</div>
															</div>
														)}
													</For>
												</div>
											</div>
										</Show>

										<Show when={configResult()!.result.shellConfig}>
											<div class="space-y-2">
												<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
													{t("agentSetup.configModal.environmentVariables")}
												</span>
												<pre class="p-3 rounded-lg bg-gray-100 dark:bg-gray-800 text-xs font-mono text-gray-700 dark:text-gray-300 overflow-x-auto whitespace-pre-wrap">
													{configResult()!.result.shellConfig}
												</pre>
												<Button
													size="sm"
													variant="secondary"
													onClick={handleApplyEnv}
													class="w-full"
												>
													{t(
														"agentSetup.configModal.addToShellProfileAutomatically",
													)}
												</Button>
											</div>
										</Show>

										<div class="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-green-800">
											<p class="text-sm text-blue-700 dark:text-blue-300">
												{configResult()!.result.instructions}
											</p>
										</div>
									</div>

									<div class="mt-6 flex justify-end">
										<Button
											variant="primary"
											onClick={() => setConfigResult(null)}
										>
											{t("agentSetup.configModal.done")}
										</Button>
									</div>
								</div>
							</div>
						</div>
					</Show>
				</div>
			</main>

			{/* OAuth Modal */}
			<OAuthModal
				provider={oauthModalProvider()}
				providerName={
					oauthModalProvider() ? getProviderName(oauthModalProvider()!) : ""
				}
				authUrl={oauthUrlData()?.url || ""}
				onStartOAuth={handleStartOAuth}
				onCancel={handleCancelOAuth}
				onAlreadyAuthorized={handleAlreadyAuthorized}
				loading={oauthLoading()}
			/>
		</div>
	);
}
