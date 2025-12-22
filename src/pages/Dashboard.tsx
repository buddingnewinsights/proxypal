import { open } from "@tauri-apps/plugin-dialog";
import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { ApiEndpoint } from "../components/ApiEndpoint";
import { openCommandPalette } from "../components/CommandPalette";
import { CopilotCard } from "../components/CopilotCard";
import { HealthIndicator } from "../components/HealthIndicator";
import { OpenCodeKitBanner } from "../components/OpenCodeKitBanner";
import { StatusIndicator } from "../components/StatusIndicator";
import { Button } from "../components/ui";
import {
	type AgentConfigResult,
	type AvailableModel,
	appendToShellProfile,
	type CopilotConfig,
	detectCliAgents,
	disconnectProvider,
	getUsageStats,
	importVertexCredential,
	onRequestLog,
	openOAuth,
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
];

// Compact KPI tile
function KpiTile(props: {
	label: string;
	value: string;
	subtext?: string;
	icon: "dollar" | "requests" | "tokens" | "success";
	color: "green" | "blue" | "purple" | "emerald";
	onClick?: () => void;
}) {
	const colors = {
		green:
			"bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/50 text-green-700 dark:text-green-300",
		blue: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/50 text-blue-700 dark:text-blue-300",
		purple:
			"bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800/50 text-purple-700 dark:text-purple-300",
		emerald:
			"bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300",
	};

	const icons = {
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
		requests: (
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
		tokens: (
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
					d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
				/>
			</svg>
		),
		success: (
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
	};

	return (
		<button
			onClick={props.onClick}
			class={`p-3 rounded-xl border text-left transition-all hover:scale-[1.02] ${colors[props.color]} ${props.onClick ? "cursor-pointer" : "cursor-default"}`}
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
				toastStore.info("Proxy stopped");
			} else {
				const status = await startProxy();
				setProxyStatus(status);
				toastStore.success("Proxy started", `Listening on port ${status.port}`);
			}
		} catch (error) {
			console.error("Failed to toggle proxy:", error);
			toastStore.error("Failed to toggle proxy", String(error));
		} finally {
			setToggling(false);
		}
	};

	const handleConnect = async (provider: Provider) => {
		if (!proxyStatus().running) {
			toastStore.warning(
				"Start proxy first",
				"The proxy must be running to connect accounts",
			);
			return;
		}

		// Vertex uses service account import, not OAuth
		if (provider === "vertex") {
			setConnecting(provider);
			toastStore.info(
				"Import Vertex service account",
				"Select your service account JSON file",
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
						"No file selected",
						"Choose a service account JSON",
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
					"Vertex connected!",
					"Service account imported successfully",
				);
			} catch (error) {
				console.error("Vertex import failed:", error);
				setConnecting(null);
				toastStore.error("Connection failed", String(error));
			}
			return;
		}

		setConnecting(provider);
		toastStore.info(
			`Connecting to ${provider}...`,
			"Complete authentication in your browser",
		);

		try {
			const oauthState = await openOAuth(provider);
			let attempts = 0;
			const maxAttempts = 120;
			const pollInterval = setInterval(async () => {
				attempts++;
				try {
					const completed = await pollOAuthStatus(oauthState);
					if (completed) {
						clearInterval(pollInterval);
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
							`${provider} connected!`,
							"You can now use this provider",
						);
					} else if (attempts >= maxAttempts) {
						clearInterval(pollInterval);
						setConnecting(null);
						toastStore.error("Connection timeout", "Please try again");
					}
				} catch (err) {
					console.error("Poll error:", err);
				}
			}, 1000);
			onCleanup(() => clearInterval(pollInterval));
		} catch (error) {
			console.error("Failed to start OAuth:", error);
			setConnecting(null);
			toastStore.error("Connection failed", String(error));
		}
	};

	const handleDisconnect = async (provider: Provider) => {
		try {
			await disconnectProvider(provider);
			const newAuth = await refreshAuthStatus();
			setAuthStatus(newAuth);
			toastStore.success(`${provider} disconnected`);
		} catch (error) {
			console.error("Failed to disconnect:", error);
			toastStore.error("Failed to disconnect", String(error));
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
			toastStore.success("Added to shell profile", `Updated ${profilePath}`);
			setConfigResult(null);
			await loadAgents();
		} catch (error) {
			toastStore.error("Failed to update shell profile", String(error));
		}
	};

	// Format helpers
	const formatCost = (n: number) => (n < 0.01 ? "$0.00" : `$${n.toFixed(2)}`);
	const formatTokens = (n: number) => {
		if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
		if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
		return n.toString();
	};
	const successRate = () => {
		const s = stats();
		if (!s || s.totalRequests === 0) {
			// Fallback to history if stats unavailable
			const total = history().requests.length;
			if (total === 0) return 100;
			const successes = history().requests.filter((r) => r.status < 400).length;
			return Math.round((successes / total) * 100);
		}
		return Math.round((s.successCount / s.totalRequests) * 100);
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
		<div class="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
			{/* Header - Simplified (navigation handled by sidebar) */}
			<header class="sticky top-0 z-10 px-4 sm:px-6 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
				<div class="flex items-center justify-between max-w-3xl mx-auto">
					<h1 class="font-semibold text-lg text-gray-900 dark:text-gray-100">
						Dashboard
					</h1>
					<div class="flex items-center gap-3">
						<button
							onClick={openCommandPalette}
							class="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-700 transition-colors"
							title="Command Palette (⌘K)"
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
			<main class="flex-1 p-4 sm:p-6 overflow-y-auto">
				<div class="max-w-3xl mx-auto space-y-4">
					{/* === OpenCodeKit Banner === */}
					<OpenCodeKitBanner />

					{/* === ZONE 1: Onboarding (shows until setup complete) === */}
					<Show when={!isSetupComplete()}>
						<div class="p-4 sm:p-6 rounded-2xl bg-gradient-to-br from-brand-50 to-purple-50 dark:from-brand-900/30 dark:to-purple-900/20 border border-brand-200 dark:border-brand-800/50">
							<div class="mb-4">
								<h2 class="text-lg font-bold text-gray-900 dark:text-gray-100">
									Get Started
								</h2>
								<p class="text-sm text-gray-600 dark:text-gray-400">
									Complete these steps to start saving
								</p>
							</div>
							<div class="space-y-3">
								{/* Step 1: Start Proxy */}
								<div
									class={`flex items-center gap-3 p-3 rounded-xl border ${proxyStatus().running ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800" : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"}`}
								>
									<div
										class={`w-8 h-8 rounded-full flex items-center justify-center ${proxyStatus().running ? "bg-green-500 text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-500"}`}
									>
										{proxyStatus().running ? (
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
										) : (
											"1"
										)}
									</div>
									<div class="flex-1">
										<p class="font-medium text-gray-900 dark:text-gray-100">
											Start the proxy
										</p>
										<p class="text-xs text-gray-500 dark:text-gray-400">
											Enable the local proxy server
										</p>
									</div>
									<Show when={!proxyStatus().running}>
										<Button
											size="sm"
											variant="primary"
											onClick={toggleProxy}
											disabled={toggling()}
										>
											{toggling() ? "Starting..." : "Start"}
										</Button>
									</Show>
								</div>
								{/* Step 2: Connect Provider */}
								<div
									class={`flex items-center gap-3 p-3 rounded-xl border ${hasAnyProvider() ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800" : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"}`}
								>
									<div
										class={`w-8 h-8 rounded-full flex items-center justify-center ${hasAnyProvider() ? "bg-green-500 text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-500"}`}
									>
										{hasAnyProvider() ? (
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
										) : (
											"2"
										)}
									</div>
									<div class="flex-1">
										<p class="font-medium text-gray-900 dark:text-gray-100">
											Connect a provider
										</p>
										<p class="text-xs text-gray-500 dark:text-gray-400">
											Link Claude, Gemini, or ChatGPT
										</p>
									</div>
									<Show when={!hasAnyProvider() && proxyStatus().running}>
										<Button
											size="sm"
											variant="secondary"
											onClick={() => {
												const first = disconnectedProviders()[0];
												if (first) handleConnect(first.provider);
											}}
										>
											Connect
										</Button>
									</Show>
								</div>
								{/* Step 3: Configure Agent */}
								<div
									class={`flex items-center gap-3 p-3 rounded-xl border ${hasConfiguredAgent() ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800" : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"}`}
								>
									<div
										class={`w-8 h-8 rounded-full flex items-center justify-center ${hasConfiguredAgent() ? "bg-green-500 text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-500"}`}
									>
										{hasConfiguredAgent() ? (
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
										) : (
											"3"
										)}
									</div>
									<div class="flex-1">
										<p class="font-medium text-gray-900 dark:text-gray-100">
											Configure an agent
										</p>
										<p class="text-xs text-gray-500 dark:text-gray-400">
											Set up Cursor, Claude Code, etc.
										</p>
									</div>
									<Show when={!hasConfiguredAgent() && hasAnyProvider()}>
										<Button
											size="sm"
											variant="secondary"
											onClick={() => setCurrentPage("settings")}
										>
											Setup
										</Button>
									</Show>
								</div>
							</div>
						</div>
					</Show>

					{/* === ZONE 2: Value Snapshot (KPIs) === */}
					<Show
						when={
							history().requests.length > 0 ||
							(stats() && stats()!.totalRequests > 0)
						}
					>
						<div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
							<KpiTile
								label="Saved"
								value={formatCost(history().totalCostUsd)}
								subtext="estimated"
								icon="dollar"
								color="green"
								onClick={() => setCurrentPage("analytics")}
							/>
							<KpiTile
								label="Requests"
								value={formatTokens(history().requests.length)}
								subtext={`${stats()?.requestsToday || 0} today`}
								icon="requests"
								color="blue"
								onClick={() => setCurrentPage("analytics")}
							/>
							<KpiTile
								label="Tokens"
								value={formatTokens(
									(history().totalTokensIn || 0) +
										(history().totalTokensOut || 0),
								)}
								subtext="total"
								icon="tokens"
								color="purple"
								onClick={() => setCurrentPage("analytics")}
							/>
							<KpiTile
								label="Success"
								value={`${successRate()}%`}
								subtext={`${stats()?.failureCount || 0} failed`}
								icon="success"
								color="emerald"
								onClick={() => setCurrentPage("logs")}
							/>
						</div>
					</Show>

					{/* === ZONE 3: Providers (Unified Card) === */}
					<div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
						<div class="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
							<span class="text-sm font-semibold text-gray-900 dark:text-gray-100">
								Providers
							</span>
							<span class="text-xs text-gray-500 dark:text-gray-400">
								{connectedProviders().length} connected
							</span>
						</div>

						{/* Connected providers */}
						<Show when={connectedProviders().length > 0}>
							<div class="p-3 border-b border-gray-100 dark:border-gray-700">
								<div class="flex flex-wrap gap-2">
									<For each={connectedProviders()}>
										{(p) => (
											<div
												class={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${recentlyConnected().has(p.provider) ? "bg-green-100 dark:bg-green-900/40 border-green-400" : "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"} group`}
											>
												<img
													src={p.logo}
													alt={p.name}
													class="w-4 h-4 rounded"
												/>
												<span class="text-sm font-medium text-green-800 dark:text-green-300">
													{p.name}
												</span>
												{/* Account count badge - show when more than 1 account */}
												<Show when={authStatus()[p.provider] > 1}>
													<span class="text-[10px] font-medium text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-800/50 px-1.5 py-0.5 rounded-full">
														{authStatus()[p.provider]}
													</span>
												</Show>
												<HealthIndicator provider={p.provider} />
												{/* Add another account button */}
												<button
													onClick={() => handleConnect(p.provider)}
													disabled={connecting() !== null}
													class="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-green-600 dark:hover:text-green-400 transition-opacity disabled:opacity-30"
													title="Add another account"
												>
													{connecting() === p.provider ? (
														<svg
															class="w-3.5 h-3.5 animate-spin"
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
													onClick={() => handleDisconnect(p.provider)}
													class="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity -mr-1"
													title="Disconnect all accounts (manage individually in Settings → Auth Files)"
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
						<Show when={disconnectedProviders().length > 0}>
							<div class="p-3">
								<Show when={!proxyStatus().running}>
									<p class="text-xs text-amber-600 dark:text-amber-400 mb-2">
										Start proxy to connect providers
									</p>
								</Show>
								<div class="flex flex-wrap gap-2">
									<For each={disconnectedProviders()}>
										{(p) => (
											<button
												onClick={() => handleConnect(p.provider)}
												disabled={
													!proxyStatus().running || connecting() !== null
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
												{connecting() === p.provider ? (
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

					{/* === ZONE 3.5: GitHub Copilot === */}
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
											{configResult()!.agentName} Configured
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
														Config file created
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
														Models Configured
													</span>
													<span class="text-xs text-gray-500 dark:text-gray-400">
														{configResult()?.models?.length ?? 0} total
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
													Environment Variables
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
													Add to Shell Profile Automatically
												</Button>
											</div>
										</Show>

										<div class="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
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
											Done
										</Button>
									</div>
								</div>
							</div>
						</div>
					</Show>
				</div>
			</main>
		</div>
	);
}
