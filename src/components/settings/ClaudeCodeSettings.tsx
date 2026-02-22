import { createEffect, createSignal, For, Show, splitProps } from "solid-js";
import { useI18n } from "../../i18n";
import {
	getClaudeCodeSettings,
	setClaudeCodeModel,
	type ClaudeCodeSettings as ClaudeCodeSettingsType,
} from "../../lib/tauri";
import { toastStore } from "../../stores/toast";
import type { SettingsBaseProps } from "./types";

interface ClaudeCodeSettingsProps extends SettingsBaseProps {
	getAvailableTargetModels: () => { customModels: object; builtInModels: object };
}

export function ClaudeCodeSettings(props: ClaudeCodeSettingsProps) {
	const { t } = useI18n();
	const [local] = splitProps(props, ["getAvailableTargetModels"]);

	const [claudeCodeSettings, setClaudeCodeSettings] =
		createSignal<ClaudeCodeSettingsType>({
			haikuModel: null,
			opusModel: null,
			sonnetModel: null,
			baseUrl: null,
			authToken: null,
		});

	createEffect(async () => {
		try {
			const settings = await getClaudeCodeSettings();
			setClaudeCodeSettings(settings);
		} catch (error) {
			console.error("Failed to fetch Claude Code settings:", error);
		}
	});

	const handleClaudeCodeSettingChange = async (
		modelType: "haikuModel" | "opusModel" | "sonnetModel",
		modelName: string,
	) => {
		try {
			const backendModelType = modelType.replace("Model", "") as
				| "haiku"
				| "opus"
				| "sonnet";
			await setClaudeCodeModel(backendModelType, modelName);
			setClaudeCodeSettings((prev) => ({
				...prev,
				[modelType]: modelName || null,
			}));
			toastStore.success(t("settings.toasts.claudeCodeModelUpdated"));
		} catch (error) {
			console.error("Failed to save Claude Code setting:", error);
			toastStore.error(t("settings.toasts.failedToSaveSetting"), String(error));
		}
	};

	return (
		<div class="space-y-4">
			<h2 class="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
				Claude Code Settings
			</h2>

			<div class="space-y-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
				<p class="text-xs text-gray-500 dark:text-gray-400">
					Map Claude Code model slots to available provider models. These
					settings modify the claude_desktop_config.json file.
				</p>

				<div class="space-y-3">
					{(() => {
						const { customModels, builtInModels } =
							local.getAvailableTargetModels() as {
								customModels: { value: string; label: string }[];
								builtInModels: {
									anthropic: { value: string; label: string }[];
									google: { value: string; label: string }[];
									openai: { value: string; label: string }[];
									copilot: { value: string; label: string }[];
									kiro: { value: string; label: string }[];
									qwen: { value: string; label: string }[];
									iflow: { value: string; label: string }[];
									kimi: { value: string; label: string }[];
								};
							};
						const hasModels =
							customModels.length > 0 ||
							builtInModels.anthropic.length > 0 ||
							builtInModels.google.length > 0 ||
							builtInModels.openai.length > 0 ||
							builtInModels.copilot.length > 0 ||
							builtInModels.kiro.length > 0 ||
							builtInModels.kimi.length > 0;

						if (!hasModels) {
							return (
								<p class="text-sm text-gray-500 dark:text-gray-400 italic">
									No models available. Please authenticate with a provider
									first.
								</p>
							);
						}

						const ModelSelect = (innerProps: {
							label: string;
							value: string | null;
							modelType: "haikuModel" | "opusModel" | "sonnetModel";
						}) => (
							<label class="block">
								<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
									{innerProps.label}
								</span>
								<select
									value={innerProps.value || ""}
									onChange={(e) =>
										handleClaudeCodeSettingChange(
											innerProps.modelType,
											e.currentTarget.value,
										)
									}
									class="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-smooth [&>option]:bg-white [&>option]:dark:bg-gray-900 [&>option]:text-gray-900 [&>option]:dark:text-gray-100 [&>optgroup]:bg-white [&>optgroup]:dark:bg-gray-900 [&>optgroup]:text-gray-900 [&>optgroup]:dark:text-gray-100"
								>
									<option value="">{t("common.selectModel")}</option>
									<Show when={customModels.length > 0}>
										<optgroup label="Custom Providers">
											<For each={customModels}>
												{(model) => (
													<option value={model.value}>
														{model.label}
													</option>
												)}
											</For>
										</optgroup>
									</Show>
									<Show when={builtInModels.anthropic.length > 0}>
										<optgroup label="Anthropic">
											<For each={builtInModels.anthropic}>
												{(model) => (
													<option value={model.value}>
														{model.label}
													</option>
												)}
											</For>
										</optgroup>
									</Show>
									<Show when={builtInModels.google.length > 0}>
										<optgroup label="Google">
											<For each={builtInModels.google}>
												{(model) => (
													<option value={model.value}>
														{model.label}
													</option>
												)}
											</For>
										</optgroup>
									</Show>
									<Show when={builtInModels.openai.length > 0}>
										<optgroup label="OpenAI">
											<For each={builtInModels.openai}>
												{(model) => (
													<option value={model.value}>
														{model.label}
													</option>
												)}
											</For>
										</optgroup>
									</Show>
									<Show when={builtInModels.copilot.length > 0}>
										<optgroup label="GitHub Copilot">
											<For each={builtInModels.copilot}>
												{(model) => (
													<option value={model.value}>
														{model.label}
													</option>
												)}
											</For>
										</optgroup>
									</Show>
									<Show when={builtInModels.kiro.length > 0}>
										<optgroup label="Kiro">
											<For each={builtInModels.kiro}>
												{(model) => (
													<option value={model.value}>
														{model.label}
													</option>
												)}
											</For>
										</optgroup>
									</Show>
									<Show when={builtInModels.qwen.length > 0}>
										<optgroup label="Qwen">
											<For each={builtInModels.qwen}>
												{(model) => (
													<option value={model.value}>
														{model.label}
													</option>
												)}
											</For>
										</optgroup>
									</Show>
									<Show when={builtInModels.iflow.length > 0}>
										<optgroup label="iFlow">
											<For each={builtInModels.iflow}>
												{(model) => (
													<option value={model.value}>
														{model.label}
													</option>
												)}
											</For>
										</optgroup>
									</Show>
									<Show when={builtInModels.kimi.length > 0}>
										<optgroup label="Kimi">
											<For each={builtInModels.kimi}>
												{(model) => (
													<option value={model.value}>
														{model.label}
													</option>
												)}
											</For>
										</optgroup>
									</Show>
								</select>
							</label>
						);

						return (
							<>
								<ModelSelect
									label="Haiku Model"
									value={claudeCodeSettings().haikuModel}
									modelType="haikuModel"
								/>
								<ModelSelect
									label="Sonnet Model"
									value={claudeCodeSettings().sonnetModel}
									modelType="sonnetModel"
								/>
								<ModelSelect
									label="Opus Model"
									value={claudeCodeSettings().opusModel}
									modelType="opusModel"
								/>
							</>
						);
					})()}
				</div>
			</div>
		</div>
	);
}
