import { createEffect, createSignal, For, Show } from "solid-js";
import { useI18n } from "../../i18n";
import type {
	AvailableModel,
	OAuthExcludedModels,
	UpdateInfo,
	UpdateProgress,
	UpdaterSupport,
} from "../../lib/tauri";
import {
	checkForUpdates,
	deleteOAuthExcludedModels,
	downloadAndInstallUpdate,
	getAvailableModels,
	getConfigYaml,
	getOAuthExcludedModels,
	getWebsocketAuth,
	isUpdaterSupported,
	setConfigYaml,
	setOAuthExcludedModels,
	setWebsocketAuth,
} from "../../lib/tauri";
import { appStore } from "../../stores/app";
import { themeStore } from "../../stores/theme";
import { toastStore } from "../../stores/toast";
import { Button, Switch } from "../ui";
import type { SettingsBaseProps } from "./types";

interface AdvancedSettingsProps extends SettingsBaseProps {
	appVersion: () => string;
	proxyRunning: boolean;
}

export function AdvancedSettings(props: AdvancedSettingsProps) {
	const { t } = useI18n();

	// OAuth Excluded Models state
	const [oauthExcludedModels, setOAuthExcludedModelsState] =
		createSignal<OAuthExcludedModels>({});
	const [loadingExcludedModels, setLoadingExcludedModels] = createSignal(false);
	const [savingExcludedModels, setSavingExcludedModels] = createSignal(false);
	const [newExcludedProvider, setNewExcludedProvider] = createSignal("");
	const [newExcludedModel, setNewExcludedModel] = createSignal("");

	// Raw YAML Config Editor state
	const [yamlConfigExpanded, setYamlConfigExpanded] = createSignal(false);
	const [yamlContent, setYamlContent] = createSignal("");
	const [loadingYaml, setLoadingYaml] = createSignal(false);
	const [savingYaml, setSavingYaml] = createSignal(false);

	// App Updates state
	const [updateInfo, setUpdateInfo] = createSignal<UpdateInfo | null>(null);
	const [checkingForUpdates, setCheckingForUpdates] = createSignal(false);
	const [installingUpdate, setInstallingUpdate] = createSignal(false);
	const [updateProgress, setUpdateProgress] =
		createSignal<UpdateProgress | null>(null);
	const [updaterSupport, setUpdaterSupport] =
		createSignal<UpdaterSupport | null>(null);

	// Available models from proxy (real-time)
	const [availableModels, setAvailableModels] = createSignal<AvailableModel[]>(
		[],
	);

	// Management API runtime settings
	const [websocketAuth, setWebsocketAuthState] = createSignal<boolean>(false);
	const [savingWebsocketAuth, setSavingWebsocketAuth] = createSignal(false);

	// Check updater support on mount
	createEffect(async () => {
		try {
			const support = await isUpdaterSupported();
			setUpdaterSupport(support);
		} catch (error) {
			console.error("Failed to check updater support:", error);
		}
	});

	// Fetch available models and runtime settings when proxy is running
	createEffect(async () => {
		const proxyRunning = appStore.proxyStatus().running;
		if (proxyRunning) {
			try {
				const models = await getAvailableModels();
				setAvailableModels(models);
			} catch (error) {
				console.error("Failed to fetch available models:", error);
				setAvailableModels([]);
			}

			// Fetch OAuth excluded models
			try {
				setLoadingExcludedModels(true);
				const excluded = await getOAuthExcludedModels();
				setOAuthExcludedModelsState(excluded);
			} catch (error) {
				console.error("Failed to fetch OAuth excluded models:", error);
			} finally {
				setLoadingExcludedModels(false);
			}

			try {
				const wsAuth = await getWebsocketAuth();
				setWebsocketAuthState(wsAuth);
			} catch (error) {
				console.error("Failed to fetch WebSocket auth:", error);
			}
		} else {
			setAvailableModels([]);
		}
	});

	const handleWebsocketAuthChange = async (value: boolean) => {
		setSavingWebsocketAuth(true);
		try {
			await setWebsocketAuth(value);
			setWebsocketAuthState(value);
			toastStore.success(
				t("settings.toasts.websocketAuthentication", {
					status: value
						? t("settings.toasts.enabled")
						: t("settings.toasts.disabled"),
				}),
			);
		} catch (error) {
			toastStore.error(
				t("settings.toasts.failedToUpdateWebsocketAuth"),
				String(error),
			);
		} finally {
			setSavingWebsocketAuth(false);
		}
	};

	const handleCheckForUpdates = async () => {
		setCheckingForUpdates(true);
		setUpdateInfo(null);
		try {
			const info = await checkForUpdates();
			setUpdateInfo(info);
			if (info.available) {
				toastStore.success(
					t("settings.toasts.updateAvailable", {
						version: info.version || "",
					}),
				);
			} else {
				toastStore.success(t("settings.toasts.latestVersion"));
			}
		} catch (error) {
			console.error("Update check failed:", error);
			toastStore.error(t("settings.toasts.updateCheckFailed"), String(error));
		} finally {
			setCheckingForUpdates(false);
		}
	};

	const handleInstallUpdate = async () => {
		setInstallingUpdate(true);
		setUpdateProgress(null);
		try {
			await downloadAndInstallUpdate((progress) => {
				setUpdateProgress(progress);
			});
		} catch (error) {
			console.error("Update installation failed:", error);
			toastStore.error(t("settings.toasts.updateFailed"), String(error));
			setInstallingUpdate(false);
			setUpdateProgress(null);
		}
	};

	const handleAddExcludedModel = async () => {
		const provider = newExcludedProvider().trim().toLowerCase();
		const model = newExcludedModel().trim();

		if (!provider || !model) {
			toastStore.error(t("settings.toasts.providerAndModelRequired"));
			return;
		}

		setSavingExcludedModels(true);
		try {
			const current = oauthExcludedModels();
			const existing = current[provider] || [];
			if (existing.includes(model)) {
				toastStore.error(t("settings.toasts.modelAlreadyExcluded"));
				return;
			}

			const updated = [...existing, model];
			await setOAuthExcludedModels(provider, updated);
			setOAuthExcludedModelsState({ ...current, [provider]: updated });
			setNewExcludedModel("");
			toastStore.success(
				t("settings.toasts.modelExcludedForProvider", {
					model,
					provider,
				}),
			);
		} catch (error) {
			toastStore.error(
				t("settings.toasts.failedToAddExcludedModel"),
				String(error),
			);
		} finally {
			setSavingExcludedModels(false);
		}
	};

	const handleRemoveExcludedModel = async (provider: string, model: string) => {
		setSavingExcludedModels(true);
		try {
			const current = oauthExcludedModels();
			const existing = current[provider] || [];
			const updated = existing.filter((m) => m !== model);

			if (updated.length === 0) {
				await deleteOAuthExcludedModels(provider);
				const newState = { ...current };
				delete newState[provider];
				setOAuthExcludedModelsState(newState);
			} else {
				await setOAuthExcludedModels(provider, updated);
				setOAuthExcludedModelsState({ ...current, [provider]: updated });
			}
			toastStore.success(
				t("settings.toasts.modelRemovedFromProvider", {
					model,
					provider,
				}),
			);
		} catch (error) {
			toastStore.error(
				t("settings.toasts.failedToRemoveExcludedModel"),
				String(error),
			);
		} finally {
			setSavingExcludedModels(false);
		}
	};

	const loadYamlConfig = async () => {
		if (!appStore.proxyStatus().running) {
			setYamlContent(t("settings.yaml.proxyNotRunning"));
			return;
		}
		setLoadingYaml(true);
		try {
			const yaml = await getConfigYaml();
			setYamlContent(yaml);
		} catch (error) {
			toastStore.error(
				t("settings.toasts.failedToLoadConfigYaml"),
				String(error),
			);
		} finally {
			setLoadingYaml(false);
		}
	};

	const saveYamlConfig = async () => {
		setSavingYaml(true);
		try {
			await setConfigYaml(yamlContent());
			toastStore.success(t("settings.toasts.configYamlSaved"));
		} catch (error) {
			toastStore.error(
				t("settings.toasts.failedToSaveConfigYaml"),
				String(error),
			);
		} finally {
			setSavingYaml(false);
		}
	};

	createEffect(() => {
		if (yamlConfigExpanded() && !yamlContent()) {
			loadYamlConfig();
		}
	});

	const getAvailableTargetModels = () => {
		const customModels: { value: string; label: string }[] = [];

		const providers = props.config().ampOpenaiProviders || [];
		for (const provider of providers) {
			if (provider?.models) {
				for (const model of provider.models) {
					if (model.alias) {
						customModels.push({
							value: model.alias,
							label: `${model.alias} (${provider.name})`,
						});
					} else {
						customModels.push({
							value: model.name,
							label: `${model.name} (${provider.name})`,
						});
					}
				}
			}
		}

		const fallbackModels = {
			anthropic: [
				{ value: "claude-opus-4-5", label: "claude-opus-4-5" },
				{ value: "claude-sonnet-4-5", label: "claude-sonnet-4-5" },
				{ value: "claude-haiku-4-5", label: "claude-haiku-4-5" },
			],
			google: [
				{ value: "gemini-2.5-pro", label: "gemini-2.5-pro" },
				{ value: "gemini-2.5-flash", label: "gemini-2.5-flash" },
				{ value: "gemini-2.5-flash-lite", label: "gemini-2.5-flash-lite" },
				{ value: "gemini-3-pro-preview", label: "gemini-3-pro-preview" },
				{ value: "gemini-3-flash-preview", label: "gemini-3-flash-preview" },
				{ value: "gemini-3.1-pro-high", label: "gemini-3.1-pro-high" },
				{
					value: "gemini-3-pro-image-preview",
					label: "gemini-3-pro-image-preview",
				},
				{
					value: "gemini-2.5-computer-use-preview-10-2025",
					label: "gemini-2.5-computer-use-preview",
				},
				{ value: "gemini-claude-opus-4-5", label: "gemini-claude-opus-4-5" },
				{
					value: "gemini-claude-opus-4-5-thinking",
					label: "gemini-claude-opus-4-5-thinking",
				},
				{
					value: "gemini-claude-sonnet-4-5",
					label: "gemini-claude-sonnet-4-5",
				},
				{
					value: "gemini-claude-sonnet-4-5-thinking",
					label: "gemini-claude-sonnet-4-5-thinking",
				},
				{ value: "gpt-oss-120b-medium", label: "gpt-oss-120b-medium" },
			],
			openai: [
				{ value: "gpt-5", label: "gpt-5" },
				{ value: "gpt-5.1", label: "gpt-5.1" },
				{ value: "gpt-5.2", label: "gpt-5.2" },
				{ value: "gpt-5-codex", label: "gpt-5-codex" },
				{ value: "gpt-5-codex-mini", label: "gpt-5-codex-mini" },
				{ value: "gpt-5.1-codex", label: "gpt-5.1-codex" },
				{ value: "gpt-5.1-codex-max", label: "gpt-5.1-codex-max" },
				{ value: "gpt-5.1-codex-mini", label: "gpt-5.1-codex-mini" },
				{ value: "gpt-5.2-codex", label: "gpt-5.2-codex" },
				{ value: "o3", label: "o3" },
				{ value: "o3-mini", label: "o3-mini" },
				{ value: "o4-mini", label: "o4-mini" },
				{ value: "gpt-4.1", label: "gpt-4.1" },
				{ value: "gpt-4.1-mini", label: "gpt-4.1-mini" },
				{ value: "gpt-4o", label: "gpt-4o" },
				{ value: "gpt-4o-mini", label: "gpt-4o-mini" },
			],
			qwen: [
				{ value: "qwen3-235b-a22b", label: "qwen3-235b-a22b" },
				{ value: "qwq-32b", label: "qwq-32b" },
			],
			iflow: [] as { value: string; label: string }[],
			kimi: [] as { value: string; label: string }[],
			copilot: [
				{ value: "copilot-gpt-4o", label: "copilot-gpt-4o" },
				{
					value: "copilot-claude-sonnet-4",
					label: "copilot-claude-sonnet-4",
				},
				{
					value: "copilot-gemini-2.5-pro",
					label: "copilot-gemini-2.5-pro",
				},
			],
			kiro: [
				{
					value: "kiro-auto",
					label: `kiro-auto (${t("common.recommended")})`,
				},
				{
					value: "kiro-claude-sonnet-4",
					label: "kiro-claude-sonnet-4",
				},
				{
					value: "kiro-claude-sonnet-4-5",
					label: "kiro-claude-sonnet-4-5",
				},
				{
					value: "kiro-claude-opus-4-5",
					label: "kiro-claude-opus-4-5",
				},
				{
					value: "kiro-claude-haiku-4-5",
					label: "kiro-claude-haiku-4-5",
				},
			],
		};

		const models = availableModels();
		const groupedModels = {
			anthropic: models
				.filter((m) => m.ownedBy === "anthropic")
				.map((m) => ({ value: m.id, label: m.id })),
			google: models
				.filter((m) => m.ownedBy === "google" || m.ownedBy === "antigravity")
				.map((m) => ({ value: m.id, label: m.id })),
			openai: models
				.filter((m) => m.ownedBy === "openai")
				.map((m) => ({ value: m.id, label: m.id })),
			qwen: models
				.filter((m) => m.ownedBy === "qwen")
				.map((m) => ({ value: m.id, label: m.id })),
			iflow: models
				.filter((m) => m.ownedBy === "iflow")
				.map((m) => ({ value: m.id, label: m.id })),
			kimi: models
				.filter((m) => m.ownedBy === "kimi" || m.id.startsWith("kimi-"))
				.map((m) => ({ value: m.id, label: m.id })),
			copilot: models
				.filter(
					(m) =>
						m.ownedBy === "copilot" ||
						(m.ownedBy === "claude" && m.id.startsWith("copilot-")),
				)
				.map((m) => ({ value: m.id, label: m.id })),
			kiro: models
				.filter((m) => m.ownedBy === "kiro" || m.id.startsWith("kiro-"))
				.map((m) => ({ value: m.id, label: m.id })),
		};

		const builtInModels = {
			anthropic:
				groupedModels.anthropic.length > 0
					? groupedModels.anthropic
					: fallbackModels.anthropic,
			google:
				groupedModels.google.length > 0
					? groupedModels.google
					: fallbackModels.google,
			openai:
				groupedModels.openai.length > 0
					? groupedModels.openai
					: fallbackModels.openai,
			qwen:
				groupedModels.qwen.length > 0
					? groupedModels.qwen
					: fallbackModels.qwen,
			iflow:
				groupedModels.iflow.length > 0
					? groupedModels.iflow
					: fallbackModels.iflow,
			kimi:
				groupedModels.kimi.length > 0
					? groupedModels.kimi
					: fallbackModels.kimi,
			copilot:
				groupedModels.copilot.length > 0
					? groupedModels.copilot
					: fallbackModels.copilot,
			kiro:
				groupedModels.kiro.length > 0
					? groupedModels.kiro
					: fallbackModels.kiro,
		};

		return { customModels, builtInModels };
	};

	return (
		<div class="space-y-4">
			<div class="space-y-4">
				<h2 class="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
					Advanced Settings
				</h2>

				<div class="space-y-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
					<Switch
						label="Debug Mode"
						description="Enable verbose logging for troubleshooting"
						checked={props.config().debug}
						onChange={(checked) => props.handleConfigChange("debug", checked)}
					/>

					<div class="border-t border-gray-200 dark:border-gray-700" />

					<Switch
						label="Usage Statistics"
						description="Track request counts and token usage"
						checked={props.config().usageStatsEnabled}
						onChange={(checked) =>
							props.handleConfigChange("usageStatsEnabled", checked)
						}
					/>

					<div class="border-t border-gray-200 dark:border-gray-700" />

					<Switch
						label="Request Logging"
						description="Log all API requests for debugging"
						checked={props.config().requestLogging}
						onChange={(checked) =>
							props.handleConfigChange("requestLogging", checked)
						}
					/>

					<div class="border-t border-gray-200 dark:border-gray-700" />

					<Switch
						label="Commercial Mode"
						description="Disable request logging middleware for lower memory usage (requires restart)"
						checked={props.config().commercialMode ?? false}
						onChange={(checked) =>
							props.handleConfigChange("commercialMode", checked)
						}
					/>

					<div class="border-t border-gray-200 dark:border-gray-700" />

					<Switch
						label="Disable Control Panel"
						description="Hide CLIProxyAPI's web management UI. Disable to access the control panel at http://localhost:PORT"
						checked={props.config().disableControlPanel ?? true}
						onChange={(checked) =>
							props.handleConfigChange("disableControlPanel", checked)
						}
					/>

					<div class="border-t border-gray-200 dark:border-gray-700" />

					<Switch
						label="Log to File"
						description="Write logs to rotating files instead of stdout"
						checked={props.config().loggingToFile}
						onChange={(checked) =>
							props.handleConfigChange("loggingToFile", checked)
						}
					/>

					<Show when={props.config().loggingToFile}>
						<div class="flex items-center justify-between">
							<div class="flex-1">
								<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
									Max Log Size (MB)
								</span>
								<p class="text-xs text-gray-500 dark:text-gray-400">
									Maximum total size of log files before rotation
								</p>
							</div>
							<input
								type="number"
								min="10"
								max="1000"
								value={props.config().logsMaxTotalSizeMb || 100}
								onChange={(e) =>
									props.handleConfigChange(
										"logsMaxTotalSizeMb",
										parseInt(e.currentTarget.value) || 100,
									)
								}
								class="w-24 px-3 py-1.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-right focus:ring-2 focus:ring-brand-500 focus:border-transparent"
							/>
						</div>
					</Show>

					<Show when={props.proxyRunning}>
						<div class="border-t border-gray-200 dark:border-gray-700" />

						<div class="flex items-center justify-between">
							<div class="flex-1">
								<div class="flex items-center gap-2">
									<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
										WebSocket Authentication
									</span>
									<Show when={savingWebsocketAuth()}>
										<svg
											class="w-4 h-4 animate-spin text-brand-500"
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
									</Show>
								</div>
								<p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
									Require authentication for WebSocket connections. Updates live
									without restart.
								</p>
							</div>
							<button
								type="button"
								role="switch"
								aria-checked={websocketAuth()}
								disabled={savingWebsocketAuth()}
								onClick={() => handleWebsocketAuthChange(!websocketAuth())}
								class={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-50 ${
									websocketAuth()
										? "bg-brand-600"
										: "bg-gray-200 dark:bg-gray-700"
								}`}
							>
								<span
									aria-hidden="true"
									class={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
										websocketAuth() ? "translate-x-5" : "translate-x-0"
									}`}
								/>
							</button>
						</div>
					</Show>
				</div>
			</div>

			<div class="space-y-4">
				<h2 class="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
					Quota Exceeded Behavior
				</h2>

				<div class="space-y-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
					<Switch
						label="Auto-switch Project"
						description="Automatically switch to another project when quota is exceeded"
						checked={props.config().quotaSwitchProject}
						onChange={(checked) =>
							props.handleConfigChange("quotaSwitchProject", checked)
						}
					/>

					<div class="border-t border-gray-200 dark:border-gray-700" />

					<Switch
						label="Switch to Preview Model"
						description="Fall back to preview/beta models when quota is exceeded"
						checked={props.config().quotaSwitchPreviewModel}
						onChange={(checked) =>
							props.handleConfigChange("quotaSwitchPreviewModel", checked)
						}
					/>
				</div>
			</div>

			<Show when={props.proxyRunning}>
				<div class="space-y-4">
					<h2 class="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
						OAuth Excluded Models
					</h2>

					<div class="space-y-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
						<p class="text-xs text-gray-500 dark:text-gray-400">
							Block specific models from being used with OAuth providers.
							Updates live without restart.
						</p>

						<div class="flex gap-2">
							<select
								value={newExcludedProvider()}
								onChange={(e) => setNewExcludedProvider(e.currentTarget.value)}
								class="flex-1 px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent [&>option]:bg-white [&>option]:dark:bg-gray-900 [&>option]:text-gray-900 [&>option]:dark:text-gray-100"
							>
								<option value="">{t("common.selectProvider")}</option>
								<option value="gemini">Gemini</option>
								<option value="claude">Claude</option>
								<option value="qwen">Qwen</option>
								<option value="iflow">iFlow</option>
								<option value="openai">OpenAI</option>
								<option value="copilot">GitHub Copilot</option>
							</select>
							{(() => {
								const mappings = props.config().ampModelMappings || [];
								const mappedModels = mappings
									.filter((m) => m.enabled !== false && m.alias)
									.map((m) => m.alias);
								const { builtInModels } = getAvailableTargetModels();

								const getModelsForProvider = () => {
									const provider = newExcludedProvider();
									switch (provider) {
										case "gemini":
											return builtInModels.google;
										case "claude":
											return builtInModels.anthropic;
										case "openai":
											return builtInModels.openai;
										case "qwen":
											return builtInModels.qwen;
										case "iflow":
											return builtInModels.iflow;
										case "kimi":
											return builtInModels.kimi;
										case "copilot":
											return builtInModels.copilot;
										case "kiro":
											return builtInModels.kiro;
										default:
											return [];
									}
								};

								return (
									<select
										value={newExcludedModel()}
										onChange={(e) => setNewExcludedModel(e.currentTarget.value)}
										class="flex-[2] px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent [&>option]:bg-white [&>option]:dark:bg-gray-900 [&>option]:text-gray-900 [&>option]:dark:text-gray-100 [&>optgroup]:bg-white [&>optgroup]:dark:bg-gray-900 [&>optgroup]:text-gray-900 [&>optgroup]:dark:text-gray-100"
									>
										<option value="">{t("common.selectModel")}</option>
										<Show when={mappedModels.length > 0}>
											<optgroup label="Amp Model Mappings">
												<For each={[...new Set(mappedModels)]}>
													{(model) => <option value={model}>{model}</option>}
												</For>
											</optgroup>
										</Show>
										<Show when={getModelsForProvider().length > 0}>
											<optgroup
												label={`${newExcludedProvider() || "Provider"} Models`}
											>
												<For each={getModelsForProvider()}>
													{(model) => (
														<option value={model.value}>{model.label}</option>
													)}
												</For>
											</optgroup>
										</Show>
									</select>
								);
							})()}
							<Button
								variant="primary"
								size="sm"
								onClick={handleAddExcludedModel}
								disabled={
									savingExcludedModels() ||
									!newExcludedProvider() ||
									!newExcludedModel()
								}
							>
								<Show
									when={savingExcludedModels()}
									fallback={<span>{t("common.add")}</span>}
								>
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
											d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
										/>
									</svg>
								</Show>
							</Button>
						</div>

						<Show when={loadingExcludedModels()}>
							<div class="text-center py-4 text-gray-500">
								{t("common.loading")}
							</div>
						</Show>

						<Show
							when={
								!loadingExcludedModels() &&
								Object.keys(oauthExcludedModels()).length === 0
							}
						>
							<div class="text-center py-4 text-gray-400 dark:text-gray-500 text-sm">
								{t("settings.oauthExcluded.noModels")}
							</div>
						</Show>

						<Show
							when={
								!loadingExcludedModels() &&
								Object.keys(oauthExcludedModels()).length > 0
							}
						>
							<div class="space-y-3">
								<For each={Object.entries(oauthExcludedModels())}>
									{([provider, models]) => (
										<div class="space-y-2">
											<div class="flex items-center gap-2">
												<span class="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">
													{provider}
												</span>
												<span class="text-xs text-gray-400">
													({models.length} excluded)
												</span>
											</div>
											<div class="flex flex-wrap gap-2">
												<For each={models}>
													{(model) => (
														<span class="inline-flex items-center gap-1 px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-md text-xs">
															{model}
															<button
																type="button"
																onClick={() =>
																	handleRemoveExcludedModel(provider, model)
																}
																disabled={savingExcludedModels()}
																class="hover:text-red-900 dark:hover:text-red-300 disabled:opacity-50"
																title="Remove"
															>
																<svg
																	class="w-3 h-3"
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
														</span>
													)}
												</For>
											</div>
										</div>
									)}
								</For>
							</div>
						</Show>
					</div>
				</div>
			</Show>

			<Show when={props.proxyRunning}>
				<div class="space-y-4">
					<h2 class="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
						Raw Configuration
					</h2>

					<div class="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
						<button
							type="button"
							onClick={() => setYamlConfigExpanded(!yamlConfigExpanded())}
							class="w-full flex items-center justify-between text-left"
						>
							<div>
								<p class="text-sm font-medium text-gray-700 dark:text-gray-300">
									YAML Config Editor
								</p>
								<p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
									Advanced: Edit the raw CLIProxyAPI configuration
								</p>
							</div>
							<svg
								class={`w-5 h-5 text-gray-400 transition-transform ${
									yamlConfigExpanded() ? "rotate-180" : ""
								}`}
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
						</button>

						<Show when={yamlConfigExpanded()}>
							<div class="mt-4 space-y-3">
								<div class="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg">
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
											d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
										/>
									</svg>
									<span>
										Be careful! Invalid YAML can break the proxy. Changes apply
										immediately but some may require a restart.
									</span>
								</div>

								<Show when={loadingYaml()}>
									<div class="text-center py-8 text-gray-500">
										Loading configuration...
									</div>
								</Show>

								<Show when={!loadingYaml()}>
									<textarea
										value={yamlContent()}
										onInput={(e) => setYamlContent(e.currentTarget.value)}
										class="w-full h-96 px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-xs font-mono focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-smooth resize-y"
										placeholder="Loading..."
										spellcheck={false}
									/>

									<div class="flex items-center justify-between">
										<Button
											variant="secondary"
											size="sm"
											onClick={loadYamlConfig}
											disabled={loadingYaml()}
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
													d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
												/>
											</svg>
											Reload
										</Button>

										<Button
											variant="primary"
											size="sm"
											onClick={saveYamlConfig}
											disabled={savingYaml() || loadingYaml()}
										>
											<Show
												when={savingYaml()}
												fallback={<span>{t("common.saveChanges")}</span>}
											>
												<svg
													class="w-4 h-4 animate-spin mr-1.5"
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
														d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
													/>
												</svg>
												Saving...
											</Show>
										</Button>
									</div>
								</Show>
							</div>
						</Show>
					</div>
				</div>
			</Show>

			<div class="space-y-4">
				<h2 class="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
					App Updates
				</h2>

				<div class="space-y-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
					<div class="flex items-center justify-between">
						<div class="flex-1">
							<p class="text-sm font-medium text-gray-700 dark:text-gray-300">
								Check for Updates
							</p>
							<p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
								Download and install new versions automatically
							</p>
						</div>
						<Button
							variant="secondary"
							size="sm"
							onClick={handleCheckForUpdates}
							disabled={checkingForUpdates() || installingUpdate()}
						>
							<Show
								when={checkingForUpdates()}
								fallback={
									<>
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
												d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
											/>
										</svg>
										Check
									</>
								}
							>
								<svg
									class="w-4 h-4 animate-spin mr-1.5"
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
										d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
									/>
								</svg>
								Checking...
							</Show>
						</Button>
					</div>

					<Show when={updateInfo()?.available}>
						<div class="border-t border-gray-200 dark:border-gray-700 pt-4">
							<div class="flex items-start gap-3 p-3 bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-lg">
								<svg
									class="w-5 h-5 text-brand-500 mt-0.5 shrink-0"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"
									/>
								</svg>
								<div class="flex-1 min-w-0">
									<p class="text-sm font-medium text-brand-700 dark:text-brand-300">
										Update Available: v{updateInfo()?.version}
									</p>
									<p class="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
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
												d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
											/>
										</svg>
										Please stop the proxy before updating to avoid issues
									</p>
									<Show when={updateInfo()?.body}>
										<p class="text-xs text-brand-600 dark:text-brand-400 mt-1 line-clamp-3">
											{updateInfo()?.body}
										</p>
									</Show>
									<Show when={updateInfo()?.date}>
										<p class="text-xs text-brand-500 dark:text-brand-500 mt-1">
											Released: {updateInfo()?.date}
										</p>
									</Show>
								</div>
							</div>

							<div class="mt-3">
								<Show
									when={updaterSupport()?.supported !== false}
									fallback={
										<div class="text-center">
											<p class="text-xs text-amber-600 dark:text-amber-400 mb-2">
												{updaterSupport()?.reason}
											</p>
											<a
												href="https://github.com/heyhuynhgiabuu/proxypal/releases"
												target="_blank"
												rel="noopener noreferrer"
												class="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 rounded-lg transition-colors"
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
														d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
													/>
												</svg>
												Download from GitHub
											</a>
										</div>
									}
								>
									<Button
										variant="primary"
										size="sm"
										onClick={handleInstallUpdate}
										disabled={installingUpdate()}
										class="w-full"
									>
										<Show
											when={installingUpdate()}
											fallback={
												<>
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
															d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
														/>
													</svg>
													Download & Install
												</>
											}
										>
											<svg
												class="w-4 h-4 animate-spin mr-1.5"
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
													d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
												/>
											</svg>
											{updateProgress()?.event === "Progress"
												? "Downloading..."
												: "Installing..."}
										</Show>
									</Button>
								</Show>
							</div>

							<Show when={updateProgress()?.event === "Progress"}>
								<div class="mt-2">
									<div class="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
										<div
											class="h-full bg-brand-500 transition-all duration-300"
											style={{
												width: `${
													(updateProgress()?.contentLength ?? 0) > 0
														? (
																(updateProgress()?.chunkLength ?? 0) /
																	(updateProgress()?.contentLength ?? 1)
															) * 100
														: 0
												}%`,
											}}
										/>
									</div>
								</div>
							</Show>
						</div>
					</Show>

					<Show when={updateInfo() && !updateInfo()?.available}>
						<div class="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
							<svg
								class="w-5 h-5 text-green-500"
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
							<p class="text-sm text-green-700 dark:text-green-300">
								You're running the latest version (v
								{updateInfo()?.currentVersion})
							</p>
						</div>
					</Show>
				</div>
			</div>

			<div class="border-t border-gray-200 dark:border-gray-700 my-6" />

			<div class="space-y-4">
				<h2 class="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
					About
				</h2>

				<div class="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-center">
					<div class="w-12 h-12 mx-auto rounded-xl flex items-center justify-center mb-3">
						<img
							src={
								themeStore.resolvedTheme() === "dark"
									? "/proxypal-white.png"
									: "/proxypal-black.png"
							}
							alt="ProxyPal Logo"
							class="w-12 h-12 rounded-xl object-contain"
						/>
					</div>
					<h3 class="font-bold text-gray-900 dark:text-gray-100">ProxyPal</h3>
					<p class="text-sm text-gray-500 dark:text-gray-400">
						Version {props.appVersion()}
					</p>
					<p class="text-xs text-gray-400 dark:text-gray-500 mt-2">
						Built with love by OpenCodeKit
					</p>
				</div>
			</div>
		</div>
	);
}
