import { createSignal, For, onMount, Show } from "solid-js";
import { useI18n } from "../../i18n";
import type { AgentStatus, AppConfig, AvailableModel } from "../../lib/tauri";
import {
	configureCliAgent,
	detectCliAgents,
	getAvailableModels,
} from "../../lib/tauri";
import { appStore } from "../../stores/app";
import { toastStore } from "../../stores/toast";
import { ModelsWidget } from "../ModelsWidget";
import { Button } from "../ui";

interface ModelsSettingsProps {
	config: AppConfig;
	setConfig: (updater: (prev: AppConfig) => AppConfig) => void;
}

export function ModelsSettings(props: ModelsSettingsProps) {
	const { t } = useI18n();
	void props;

	const [models, setModels] = createSignal<AvailableModel[]>([]);
	const [agents, setAgents] = createSignal<AgentStatus[]>([]);
	const [configuringAgent, setConfiguringAgent] = createSignal<string | null>(
		null,
	);

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

		// Load agents
		try {
			const agentList = await detectCliAgents();
			setAgents(agentList);
		} catch (err) {
			console.error("Failed to load agents:", err);
		}
	});

	const handleConfigureAgent = async (agentId: string) => {
		if (!appStore.proxyStatus().running) {
			toastStore.warning(
				t("settings.toasts.startProxyFirst"),
				t("settings.toasts.proxyMustBeRunningToConfigureAgents"),
			);
			return;
		}
		setConfiguringAgent(agentId);
		try {
			const availableModels = await getAvailableModels();
			const result = await configureCliAgent(agentId, availableModels);
			const agent = agents().find((a) => a.id === agentId);
			if (result.success) {
				const refreshed = await detectCliAgents();
				setAgents(refreshed);
				toastStore.success(
					t("settings.toasts.agentConfigured", {
						name: agent?.name || agentId,
					}),
				);
			}
		} catch (error) {
			console.error("Failed to configure agent:", error);
			toastStore.error(t("settings.toasts.configurationFailed"), String(error));
		} finally {
			setConfiguringAgent(null);
		}
	};

	return (
		<>
			{/* Available Models */}
			<div class="space-y-4">
				<h2 class="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
					Available Models
				</h2>
				<ModelsWidget
					models={models()}
					loading={!appStore.proxyStatus().running}
				/>
			</div>

			{/* CLI Agents */}
			<div class="space-y-4">
				<h2 class="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
					CLI Agents
				</h2>
				<div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
					<For each={agents()}>
						{(agent) => (
							<div class="p-3 flex items-center justify-between">
								<div class="flex items-center gap-3">
									<Show when={agent.logo}>
										<img
											src={agent.logo}
											alt={agent.name}
											class="w-6 h-6 rounded"
										/>
									</Show>
									<div>
										<div class="flex items-center gap-2">
											<span class="font-medium text-sm text-gray-900 dark:text-gray-100">
												{agent.name}
											</span>
											<Show when={agent.configured}>
												<span class="px-1.5 py-0.5 text-[10px] font-medium bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300 rounded">
													Configured
												</span>
											</Show>
										</div>
										<p class="text-xs text-gray-500 dark:text-gray-400">
											{agent.description}
										</p>
									</div>
								</div>
								<Button
									size="sm"
									variant={agent.configured ? "secondary" : "primary"}
									disabled={configuringAgent() === agent.id}
									onClick={() => handleConfigureAgent(agent.id)}
								>
									<Show
										when={configuringAgent() !== agent.id}
										fallback={
											<svg
												class="w-4 h-4 animate-spin"
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
										}
									>
										{agent.configured ? "Reconfigure" : "Configure"}
									</Show>
								</Button>
							</div>
						)}
					</For>
					<Show when={agents().length === 0}>
						<div class="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
							No CLI agents detected
						</div>
					</Show>
				</div>
			</div>
		</>
	);
}
