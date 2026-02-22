import { createSignal, For, Show } from "solid-js";
import { useI18n } from "../../i18n";
import type { AmpOpenAIModel, AmpOpenAIProvider } from "../../lib/tauri";
import { saveConfig, testOpenAIProvider } from "../../lib/tauri";
import { toastStore } from "../../stores/toast";
import { Button } from "../ui";
import type { SettingsBaseProps } from "./types";

interface OpenAIProviderSettingsProps extends SettingsBaseProps {}

export function OpenAIProviderSettings(props: OpenAIProviderSettingsProps) {
	const { t } = useI18n();

	// Provider modal state
	const [providerModalOpen, setProviderModalOpen] = createSignal(false);
	const [editingProviderId, setEditingProviderId] = createSignal<string | null>(
		null,
	);

	// Provider form state (used in modal)
	const [providerName, setProviderName] = createSignal("");
	const [providerBaseUrl, setProviderBaseUrl] = createSignal("");
	const [providerApiKey, setProviderApiKey] = createSignal("");
	const [providerModels, setProviderModels] = createSignal<AmpOpenAIModel[]>(
		[],
	);
	const [newModelName, setNewModelName] = createSignal("");
	const [newModelAlias, setNewModelAlias] = createSignal("");

	// Provider test state
	const [testingProvider, setTestingProvider] = createSignal(false);
	const [providerTestResult, setProviderTestResult] = createSignal<Awaited<
		ReturnType<typeof testOpenAIProvider>
	> | null>(null);

	const addProviderModel = () => {
		const name = newModelName().trim();
		const alias = newModelAlias().trim();
		if (!name) {
			toastStore.error(t("settings.toasts.modelNameRequired"));
			return;
		}
		setProviderModels([...providerModels(), { name, alias }]);
		setNewModelName("");
		setNewModelAlias("");
	};

	const removeProviderModel = (index: number) => {
		setProviderModels(providerModels().filter((_, i) => i !== index));
	};

	const saveOpenAIProvider = async () => {
		const name = providerName().trim();
		const baseUrl = providerBaseUrl().trim();
		const apiKey = providerApiKey().trim();

		if (!name || !baseUrl || !apiKey) {
			toastStore.error(t("settings.toasts.providerFieldsRequired"));
			return;
		}

		const currentProviders = props.config().ampOpenaiProviders || [];
		const editId = editingProviderId();

		let newProviders: AmpOpenAIProvider[];
		if (editId) {
			// Update existing provider
			newProviders = currentProviders.map((p) =>
				p.id === editId
					? { id: editId, name, baseUrl, apiKey, models: providerModels() }
					: p,
			);
		} else {
			// Add new provider with generated UUID
			const newProvider: AmpOpenAIProvider = {
				id: crypto.randomUUID(),
				name,
				baseUrl,
				apiKey,
				models: providerModels(),
			};
			newProviders = [...currentProviders, newProvider];
		}

		const newConfig = { ...props.config(), ampOpenaiProviders: newProviders };
		props.setConfig(newConfig);

		props.setSaving(true);
		try {
			await saveConfig(newConfig);
			toastStore.success(
				editId
					? t("settings.toasts.providerUpdated")
					: t("settings.toasts.providerAdded"),
			);
			closeProviderModal();
		} catch (error) {
			console.error("Failed to save config:", error);
			toastStore.error(t("settings.toasts.settingsSaveFailed"), String(error));
		} finally {
			props.setSaving(false);
		}
	};

	const deleteOpenAIProvider = async (providerId: string) => {
		const currentProviders = props.config().ampOpenaiProviders || [];
		const newProviders = currentProviders.filter((p) => p.id !== providerId);

		const newConfig = { ...props.config(), ampOpenaiProviders: newProviders };
		props.setConfig(newConfig);

		props.setSaving(true);
		try {
			await saveConfig(newConfig);
			toastStore.success(t("settings.toasts.providerRemoved"));
		} catch (error) {
			console.error("Failed to save config:", error);
			toastStore.error(
				t("settings.toasts.providerRemoveFailed"),
				String(error),
			);
		} finally {
			props.setSaving(false);
		}
	};

	// Test connection to the custom OpenAI provider
	const testProviderConnection = async () => {
		const baseUrl = providerBaseUrl().trim();
		const apiKey = providerApiKey().trim();

		if (!baseUrl || !apiKey) {
			toastStore.error(t("settings.toasts.baseUrlAndApiKeyRequiredForTest"));
			return;
		}

		setTestingProvider(true);
		setProviderTestResult(null);

		try {
			const result = await testOpenAIProvider(baseUrl, apiKey);
			setProviderTestResult(result);

			if (result.success) {
				const modelsInfo = result.modelsFound
					? t("settings.toasts.foundModels", { count: result.modelsFound })
					: "";
				toastStore.success(
					`${t("settings.toasts.connectionSuccessful")}${modelsInfo}`,
				);
			} else {
				toastStore.error(result.message);
			}
		} catch (error) {
			const errorMsg = String(error);
			setProviderTestResult({
				success: false,
				message: errorMsg,
			});
			toastStore.error(t("settings.toasts.connectionTestFailed"), errorMsg);
		} finally {
			setTestingProvider(false);
		}
	};

	// Initialize OpenAI provider form for editing
	const openProviderModal = (provider?: AmpOpenAIProvider) => {
		if (provider) {
			setEditingProviderId(provider.id);
			setProviderName(provider.name);
			setProviderBaseUrl(provider.baseUrl);
			setProviderApiKey(provider.apiKey);
			setProviderModels(provider.models || []);
		} else {
			setEditingProviderId(null);
			setProviderName("");
			setProviderBaseUrl("");
			setProviderApiKey("");
			setProviderModels([]);
		}
		setProviderTestResult(null);
		setProviderModalOpen(true);
	};

	const closeProviderModal = () => {
		setProviderModalOpen(false);
		setEditingProviderId(null);
		setProviderName("");
		setProviderBaseUrl("");
		setProviderApiKey("");
		setProviderModels([]);
		setProviderTestResult(null);
	};

	return (
		<div class="space-y-4">
			<div>
				<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
					Custom OpenAI-Compatible Providers
				</span>
				<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
					Add external providers (ZenMux, OpenRouter, etc.) for additional
					models
				</p>
			</div>

			{/* Provider Table */}
			<Show when={(props.config().ampOpenaiProviders || []).length > 0}>
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
								<th class="pb-2 font-medium">{t("common.name")}</th>
								<th class="pb-2 font-medium">{t("common.baseUrl")}</th>
								<th class="pb-2 font-medium">{t("common.models")}</th>
								<th class="pb-2 font-medium w-20">{t("common.actions")}</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
							<For each={props.config().ampOpenaiProviders || []}>
								{(provider) => (
									<tr class="hover:bg-gray-50 dark:hover:bg-gray-800/50">
										<td class="py-2 pr-2">
											<span class="font-medium text-gray-900 dark:text-gray-100">
												{provider.name}
											</span>
										</td>
										<td class="py-2 pr-2">
											<span
												class="text-xs text-gray-500 dark:text-gray-400 font-mono truncate max-w-[200px] block"
												title={provider.baseUrl}
											>
												{provider.baseUrl}
											</span>
										</td>
										<td class="py-2 pr-2">
											<span class="text-xs text-gray-500 dark:text-gray-400">
												{provider.models?.length || 0} model
												{(provider.models?.length || 0) !== 1 ? "s" : ""}
											</span>
										</td>
										<td class="py-2">
											<div class="flex items-center gap-1">
												<button
													type="button"
													onClick={() => openProviderModal(provider)}
													class="p-1.5 text-gray-400 hover:text-brand-500 transition-colors"
													title="Edit provider"
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
															d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
														/>
													</svg>
												</button>
												<button
													type="button"
													onClick={() => deleteOpenAIProvider(provider.id)}
													class="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
													title="Delete provider"
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
															d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
														/>
													</svg>
												</button>
											</div>
										</td>
									</tr>
								)}
							</For>
						</tbody>
					</table>
				</div>
			</Show>

			{/* Empty state */}
			<Show when={(props.config().ampOpenaiProviders || []).length === 0}>
				<div class="text-center py-6 text-gray-400 dark:text-gray-500 text-sm">
					No custom providers configured
				</div>
			</Show>

			{/* Add Provider Button */}
			<Button
				variant="secondary"
				size="sm"
				onClick={() => openProviderModal()}
				class="w-full"
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
						d="M12 4v16m8-8H4"
					/>
				</svg>
				Add Provider
			</Button>

			{/* Provider Modal */}
			<Show when={providerModalOpen()}>
				<div
					class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
					onClick={(e) => {
						if (e.target === e.currentTarget) closeProviderModal();
					}}
				>
					<div
						class="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
						onClick={(e) => e.stopPropagation()}
					>
						<div class="sticky top-0 bg-white dark:bg-gray-900 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
							<h3 class="font-semibold text-gray-900 dark:text-gray-100">
								{editingProviderId() ? "Edit Provider" : "Add Provider"}
							</h3>
							<button
								type="button"
								onClick={closeProviderModal}
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

						<div class="p-4 space-y-4">
							{/* Provider Name */}
							<label class="block">
								<span class="text-xs font-medium text-gray-600 dark:text-gray-400">
									Provider Name
								</span>
								<input
									type="text"
									value={providerName()}
									onInput={(e) => setProviderName(e.currentTarget.value)}
									placeholder="e.g. zenmux, openrouter"
									class="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-smooth"
								/>
							</label>

							{/* Base URL */}
							<label class="block">
								<span class="text-xs font-medium text-gray-600 dark:text-gray-400">
									Base URL
								</span>
								<input
									type="text"
									value={providerBaseUrl()}
									onInput={(e) => setProviderBaseUrl(e.currentTarget.value)}
									placeholder="https://api.example.com/v1"
									class="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-mono focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-smooth"
								/>
							</label>

							{/* API Key */}
							<label class="block">
								<span class="text-xs font-medium text-gray-600 dark:text-gray-400">
									API Key
								</span>
								<input
									type="password"
									value={providerApiKey()}
									onInput={(e) => setProviderApiKey(e.currentTarget.value)}
									placeholder="sk-..."
									class="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-mono focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-smooth"
								/>
							</label>

							{/* Models */}
							<div class="space-y-2">
								<span class="text-xs font-medium text-gray-600 dark:text-gray-400">
									Model Aliases (map proxy model names to provider model names)
								</span>

								{/* Existing models */}
								<For each={providerModels()}>
									{(model, index) => (
										<div class="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
											<div class="flex-1 flex items-center gap-2 text-xs font-mono overflow-hidden">
												<span
													class="text-gray-700 dark:text-gray-300 truncate"
													title={model.name}
												>
													{model.name}
												</span>
												<Show when={model.alias}>
													<svg
														class="w-4 h-4 text-gray-400 flex-shrink-0"
														fill="none"
														stroke="currentColor"
														viewBox="0 0 24 24"
													>
														<path
															stroke-linecap="round"
															stroke-linejoin="round"
															stroke-width="2"
															d="M13 7l5 5m0 0l-5 5m5-5H6"
														/>
													</svg>
													<span
														class="text-brand-500 truncate"
														title={model.alias}
													>
														{model.alias}
													</span>
												</Show>
											</div>
											<button
												type="button"
												onClick={() => removeProviderModel(index())}
												class="p-1 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
												title="Remove model"
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
														d="M6 18L18 6M6 6l12 12"
													/>
												</svg>
											</button>
										</div>
									)}
								</For>

								{/* Add new model */}
								<div class="flex flex-col sm:flex-row gap-2">
									<input
										type="text"
										value={newModelName()}
										onInput={(e) => setNewModelName(e.currentTarget.value)}
										placeholder="Provider model (e.g. anthropic/claude-4)"
										class="flex-1 px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-xs font-mono focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-smooth"
									/>
									<input
										type="text"
										value={newModelAlias()}
										onInput={(e) => setNewModelAlias(e.currentTarget.value)}
										placeholder="Alias (e.g. claude-4-20251101)"
										class="flex-1 px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-xs font-mono focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-smooth"
									/>
									<Button
										variant="secondary"
										size="sm"
										onClick={addProviderModel}
										disabled={!newModelName().trim()}
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
												d="M12 4v16m8-8H4"
											/>
										</svg>
									</Button>
								</div>
							</div>

							{/* Test Connection */}
							<div class="flex items-center gap-2">
								<Button
									variant="secondary"
									size="sm"
									onClick={testProviderConnection}
									disabled={
										testingProvider() ||
										!providerBaseUrl().trim() ||
										!providerApiKey().trim()
									}
								>
									{testingProvider() ? (
										<span class="flex items-center gap-1.5">
											<svg
												class="w-3 h-3 animate-spin"
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
											Testing...
										</span>
									) : (
										"Test Connection"
									)}
								</Button>
							</div>

							{/* Test result indicator */}
							<Show when={providerTestResult()}>
								{(result) => (
									<div
										class={`flex items-center gap-2 p-2 rounded-lg text-xs ${
											result().success
												? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
												: "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
										}`}
									>
										<Show
											when={result().success}
											fallback={
												<svg
													class="w-4 h-4 flex-shrink-0"
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
											}
										>
											<svg
												class="w-4 h-4 flex-shrink-0"
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
										</Show>
										<span>{result().message}</span>
										<Show when={result().modelsFound}>
											<span class="text-gray-500 dark:text-gray-400">
												({result().modelsFound} models)
											</span>
										</Show>
										<Show when={result().latencyMs}>
											<span class="text-gray-500 dark:text-gray-400">
												{result().latencyMs}ms
											</span>
										</Show>
									</div>
								)}
							</Show>
						</div>

						{/* Modal Footer */}
						<div class="sticky bottom-0 bg-white dark:bg-gray-900 px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
							<Button variant="ghost" size="sm" onClick={closeProviderModal}>
								Cancel
							</Button>
							<Button
								variant="primary"
								size="sm"
								onClick={saveOpenAIProvider}
								disabled={
									!providerName().trim() ||
									!providerBaseUrl().trim() ||
									!providerApiKey().trim()
								}
							>
								{editingProviderId() ? "Save Changes" : "Add Provider"}
							</Button>
						</div>
					</div>
				</div>
			</Show>

			<p class="text-xs text-gray-400 dark:text-gray-500">
				After changing settings, restart the proxy for changes to take effect.
			</p>
		</div>
	);
}
