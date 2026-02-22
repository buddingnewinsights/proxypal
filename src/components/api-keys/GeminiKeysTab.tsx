import {
	createEffect,
	createMemo,
	createSignal,
	For,
	Show,
	splitProps,
} from "solid-js";
import { useI18n } from "../../i18n";
import type { GeminiApiKey } from "../../lib/tauri";
import { getGeminiApiKeys, setGeminiApiKeys } from "../../lib/tauri";
import { appStore } from "../../stores/app";
import { toastStore } from "../../stores/toast";

import { Button } from "../ui";

interface GeminiKeysTabProps {
	showAddForm: () => boolean;
	setShowAddForm: (value: boolean) => void;
	loading: () => boolean;
	setLoading: (value: boolean) => void;
}

export function GeminiKeysTab(props: GeminiKeysTabProps) {
	const [local] = splitProps(props, [
		"showAddForm",
		"setShowAddForm",
		"loading",
		"setLoading",
	]);
	const { t } = useI18n();
	const { proxyStatus } = appStore;
	const [geminiKeys, setGeminiKeys] = createSignal<GeminiApiKey[]>([]);
	const [newGeminiKey, setNewGeminiKey] = createSignal<GeminiApiKey>({
		apiKey: "",
	});

	const maskApiKey = (key: string) => {
		if (key.length <= 8) return "****";
		return `${key.slice(0, 4)}...${key.slice(-4)}`;
	};

	const loadKeys = async () => {
		if (!proxyStatus().running) {
			return;
		}

		local.setLoading(true);
		try {
			const gemini = await getGeminiApiKeys();
			setGeminiKeys(gemini);
		} catch (error) {
			console.error("Failed to load Gemini API keys:", error);
			toastStore.error(t("apiKeys.toasts.failedToLoadApiKeys"), String(error));
		} finally {
			local.setLoading(false);
		}
	};

	createEffect(() => {
		if (proxyStatus().running) {
			void loadKeys();
		}
	});

	const handleAddGeminiKey = async () => {
		const key = newGeminiKey();
		if (!key.apiKey.trim()) {
			toastStore.error(t("apiKeys.toasts.apiKeyRequired"));
			return;
		}

		local.setLoading(true);
		try {
			const updated = [...geminiKeys(), key];
			await setGeminiApiKeys(updated);
			setGeminiKeys(updated);
			setNewGeminiKey({ apiKey: "" });
			local.setShowAddForm(false);
			toastStore.success(
				t("apiKeys.toasts.apiKeyAdded", { provider: "Gemini" }),
			);
		} catch (error) {
			toastStore.error(t("apiKeys.toasts.failedToAddKey"), String(error));
		} finally {
			local.setLoading(false);
		}
	};

	const handleDeleteGeminiKey = async (index: number) => {
		local.setLoading(true);
		try {
			const updated = geminiKeys().filter((_, i) => i !== index);
			await setGeminiApiKeys(updated);
			setGeminiKeys(updated);
			toastStore.success(
				t("apiKeys.toasts.apiKeyDeleted", { provider: "Gemini" }),
			);
		} catch (error) {
			toastStore.error(t("apiKeys.toasts.failedToDeleteKey"), String(error));
		} finally {
			local.setLoading(false);
		}
	};

	const showEmptyState = createMemo(
		() =>
			proxyStatus().running &&
			!local.loading() &&
			geminiKeys().length === 0 &&
			!local.showAddForm(),
	);

	return (
		<div class="space-y-4">
			{/* Existing keys */}
			<Show when={geminiKeys().length > 0}>
				<div class="space-y-2">
					<For each={geminiKeys()}>
						{(key, index) => (
							<div class="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
								<div class="flex-1 min-w-0">
									<code class="text-sm font-mono text-gray-700 dark:text-gray-300">
										{maskApiKey(key.apiKey)}
									</code>
									<Show when={key.baseUrl}>
										<p class="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
											{key.baseUrl}
										</p>
									</Show>
								</div>
								<Button
									variant="ghost"
									size="sm"
									onClick={() => handleDeleteGeminiKey(index())}
								>
									<svg
										class="w-4 h-4 text-red-500"
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
								</Button>
							</div>
						)}
					</For>
				</div>
			</Show>

			{/* Add form */}
			<Show when={local.showAddForm()}>
				<div class="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 space-y-3">
					<label class="block">
						<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
							{t("apiKeys.labels.apiKeyRequired")}
						</span>
						<input
							type="password"
							value={newGeminiKey().apiKey}
							onInput={(e) =>
								setNewGeminiKey({
									...newGeminiKey(),
									apiKey: e.currentTarget.value,
								})
							}
							placeholder={t("apiKeys.placeholders.geminiApiKey")}
							class="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent"
						/>
					</label>
					<label class="block">
						<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
							{t("apiKeys.labels.baseUrlOptional")}
						</span>
						<input
							type="text"
							value={newGeminiKey().baseUrl || ""}
							onInput={(e) =>
								setNewGeminiKey({
									...newGeminiKey(),
									baseUrl: e.currentTarget.value || undefined,
								})
							}
							placeholder={t("apiKeys.placeholders.geminiBaseUrl")}
							class="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent"
						/>
					</label>
					<label class="block">
						<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
							{t("apiKeys.labels.prefixOptional")}
						</span>
						<input
							type="text"
							value={newGeminiKey().prefix || ""}
							onInput={(e) =>
								setNewGeminiKey({
									...newGeminiKey(),
									prefix: e.currentTarget.value || undefined,
								})
							}
							placeholder={t("apiKeys.placeholders.geminiPrefix")}
							class="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent"
						/>
					</label>
					<div class="flex gap-2 pt-2">
						<Button
							variant="primary"
							size="sm"
							onClick={handleAddGeminiKey}
							disabled={local.loading()}
						>
							{t("apiKeys.actions.addKey")}
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => local.setShowAddForm(false)}
						>
							{t("common.cancel")}
						</Button>
					</div>
				</div>
			</Show>

			{/* Add button */}
			<Show when={!local.showAddForm()}>
				<Button
					variant="secondary"
					onClick={() => local.setShowAddForm(true)}
					disabled={!proxyStatus().running}
					class="w-full"
				>
					<svg
						class="w-4 h-4 mr-2"
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
					{t("apiKeys.actions.addGeminiApiKey")}
				</Button>
			</Show>

			{/* Empty state */}
			<Show when={showEmptyState()}>
				<div class="text-center py-8 text-gray-500 dark:text-gray-400">
					<svg
						class="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
						/>
					</svg>
					<p class="text-sm">{t("apiKeys.noApiKeysConfiguredYet")}</p>
					<p class="text-xs mt-1">{t("apiKeys.addFirstKeyHint")}</p>
				</div>
			</Show>
		</div>
	);
}
