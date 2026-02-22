import { createSignal, For, Show } from "solid-js";
import { useI18n } from "../../i18n";
import type { AppConfig, CloudflareConfig } from "../../lib/tauri";
import {
	deleteCloudflareConfig,
	saveCloudflareConfig,
	setCloudflareConnection,
} from "../../lib/tauri";
import { appStore } from "../../stores/app";
import { toastStore } from "../../stores/toast";
import { Button, Switch } from "../ui";

interface CloudflareSettingsProps {
	config: AppConfig;
	setConfig: (updater: (prev: AppConfig) => AppConfig) => void;
}

export function CloudflareSettings(props: CloudflareSettingsProps) {
	const { t } = useI18n();

	// Cloudflare State
	const [cfId, setCfId] = createSignal("");
	const [cfName, setCfName] = createSignal("");
	const [cfToken, setCfToken] = createSignal("");
	const [cfLocalPort, setCfLocalPort] = createSignal(8317);
	const [cfAdding, setCfAdding] = createSignal(false);

	// Cloudflare Handlers
	const handleSaveCf = async () => {
		if (!cfName() || !cfToken()) {
			toastStore.error(t("settings.toasts.nameAndTunnelTokenRequired"));
			return;
		}
		try {
			const cfConfig: CloudflareConfig = {
				id: cfId() || crypto.randomUUID(),
				name: cfName(),
				tunnelToken: cfToken(),
				localPort: cfLocalPort(),
				enabled: false,
			};
			const updated = await saveCloudflareConfig(cfConfig);
			props.setConfig((prev) => ({ ...prev, cloudflareConfigs: updated }));
			setCfId("");
			setCfName("");
			setCfToken("");
			setCfLocalPort(8317);
			setCfAdding(false);
			toastStore.success(t("settings.toasts.cloudflareTunnelSaved"));
		} catch (e) {
			toastStore.error(t("settings.toasts.failedToSave"), String(e));
		}
	};

	const handleDeleteCf = async (id: string) => {
		try {
			const updated = await deleteCloudflareConfig(id);
			props.setConfig((prev) => ({ ...prev, cloudflareConfigs: updated }));
			toastStore.success(t("settings.toasts.tunnelDeleted"));
		} catch (e) {
			toastStore.error(t("settings.toasts.failedToDelete"), String(e));
		}
	};

	const handleToggleCf = async (id: string, enable: boolean) => {
		try {
			await setCloudflareConnection(id, enable);
			const configs = props.config.cloudflareConfigs || [];
			const updated = configs.map((c) =>
				c.id === id ? { ...c, enabled: enable } : c,
			);
			props.setConfig((prev) => ({ ...prev, cloudflareConfigs: updated }));
		} catch (e) {
			toastStore.error(t("settings.toasts.failedToToggle"), String(e));
		}
	};

	const handleEditCf = (cf: CloudflareConfig) => {
		setCfId(cf.id);
		setCfName(cf.name);
		setCfToken(cf.tunnelToken);
		setCfLocalPort(cf.localPort);
		setCfAdding(true);
	};

	return (
		<div class="space-y-6">
			<div class="flex items-center justify-between">
				<div>
					<h2 class="text-lg font-semibold text-gray-900 dark:text-white">
						Cloudflare Tunnel
					</h2>
					<p class="text-sm text-gray-500 dark:text-gray-400">
						Expose your local API via Cloudflare Tunnel
					</p>
				</div>
				<Button
					onClick={() => {
						setCfId("");
						setCfName("");
						setCfToken("");
						setCfLocalPort(8317);
						setCfAdding(true);
					}}
					variant="primary"
					class="text-sm"
				>
					+ Add Tunnel
				</Button>
			</div>

			{/* Existing Tunnels */}
			<For each={props.config.cloudflareConfigs || []}>
				{(cf) => {
					const status = () => appStore.cloudflareStatus()[cf.id];
					return (
						<div class="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
							<div class="flex items-center justify-between">
								<div class="flex items-center gap-3">
									<div
										class={`w-3 h-3 rounded-full ${
											status()?.status === "connected"
												? "bg-green-500"
												: status()?.status === "connecting"
													? "bg-yellow-500 animate-pulse"
													: status()?.status === "error"
														? "bg-red-500"
														: "bg-gray-400"
										}`}
									/>
									<div>
										<p class="font-medium text-gray-900 dark:text-white">
											{cf.name}
										</p>
										<p class="text-xs text-gray-500">
											Port {cf.localPort} •{" "}
											{status()?.message ||
												(cf.enabled ? "Enabled" : "Disabled")}
										</p>
										<Show when={status()?.url}>
											<p class="text-xs text-blue-500 mt-1">{status()?.url}</p>
										</Show>
									</div>
								</div>
								<div class="flex items-center gap-2">
									<Switch
										checked={cf.enabled}
										onChange={(v) => handleToggleCf(cf.id, v)}
									/>
									<button
										type="button"
										onClick={() => handleEditCf(cf)}
										class="p-2 text-gray-400 hover:text-blue-500 transition-colors"
										title="Edit"
									>
										<svg
											class="w-4 h-4"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
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
										onClick={() => handleDeleteCf(cf.id)}
										class="p-2 text-gray-400 hover:text-red-500 transition-colors"
										title="Delete"
									>
										<svg
											class="w-4 h-4"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
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
							</div>
						</div>
					);
				}}
			</For>

			{/* Add/Edit Form */}
			<Show when={cfAdding()}>
				<div class="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 space-y-4">
					<div class="flex items-center justify-between">
						<h3 class="font-medium text-blue-900 dark:text-blue-100">
							{cfId() ? "Edit Tunnel" : "New Tunnel"}
						</h3>
						<button
							type="button"
							onClick={() => setCfAdding(false)}
							class="text-gray-400 hover:text-gray-600"
						>
							<svg
								class="w-5 h-5"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
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
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div class="space-y-1">
							<label class="text-xs font-medium text-gray-500 uppercase">
								Name
							</label>
							<input
								class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
								placeholder="My Tunnel"
								value={cfName()}
								onInput={(e) => setCfName(e.currentTarget.value)}
							/>
						</div>
						<div class="space-y-1">
							<label class="text-xs font-medium text-gray-500 uppercase">
								Local Port (Reference)
							</label>
							<input
								class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
								placeholder="8317"
								type="number"
								value={cfLocalPort()}
								onInput={(e) =>
									setCfLocalPort(parseInt(e.currentTarget.value) || 8317)
								}
							/>
							<p class="text-[10px] text-gray-400">
								Configure actual port in Cloudflare dashboard
							</p>
						</div>
					</div>
					<div class="space-y-1">
						<label class="text-xs font-medium text-gray-500 uppercase">
							Tunnel Token
						</label>
						<input
							class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
							placeholder="eyJ..."
							type="password"
							value={cfToken()}
							onInput={(e) => setCfToken(e.currentTarget.value)}
						/>
						<p class="text-[10px] text-gray-400">
							Get token from Cloudflare Zero Trust Dashboard → Access → Tunnels
						</p>
					</div>
					<div class="pt-2">
						<Button
							onClick={handleSaveCf}
							variant="primary"
							class="w-full sm:w-auto"
						>
							{cfId() ? "Update Tunnel" : "Add Tunnel"}
						</Button>
					</div>
				</div>
			</Show>

			{/* Help Section */}
			<div class="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
				<h3 class="font-medium text-gray-900 dark:text-white mb-2">
					How to set up Cloudflare Tunnel
				</h3>
				<ol class="text-sm text-gray-600 dark:text-gray-400 space-y-2 list-decimal list-inside">
					<li>
						Install{" "}
						<code class="bg-gray-200 dark:bg-gray-700 px-1 rounded">
							cloudflared
						</code>{" "}
						on your system
					</li>
					<li>
						Go to{" "}
						<a
							href="https://one.dash.cloudflare.com/"
							target="_blank"
							rel="noopener noreferrer"
							class="text-blue-500 hover:underline"
						>
							Cloudflare Zero Trust Dashboard
						</a>{" "}
						→ Networks → Tunnels
					</li>
					<li>{t("settings.cloudflare.instructions.createTunnel")}</li>
					<li>
						<strong class="text-gray-900 dark:text-white">
							{t("settings.cloudflare.instructions.important")}
						</strong>{" "}
						{t("settings.cloudflare.instructions.configurePrefix")}{" "}
						<strong>
							{t("settings.cloudflare.instructions.publicHostname")}
						</strong>{" "}
						{t("settings.cloudflare.instructions.configureSuffix")}
						<ul class="list-disc list-inside ml-4 mt-1 space-y-1">
							<li>
								Subdomain: your choice (e.g.,{" "}
								<code class="bg-gray-200 dark:bg-gray-700 px-1 rounded">
									proxy
								</code>
								)
							</li>
							<li>{t("settings.cloudflare.instructions.domain")}</li>
							<li>
								Service Type:{" "}
								<code class="bg-gray-200 dark:bg-gray-700 px-1 rounded">
									HTTP
								</code>
							</li>
							<li>
								URL:{" "}
								<code class="bg-gray-200 dark:bg-gray-700 px-1 rounded">
									localhost:8317
								</code>{" "}
								(or your proxy port)
							</li>
						</ul>
					</li>
					<li>{t("settings.cloudflare.instructions.enableTunnel")}</li>
				</ol>
				<p class="mt-3 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg">
					<strong>{t("settings.cloudflare.instructions.note")}</strong>{" "}
					{t("settings.cloudflare.instructions.noteText")}
				</p>
			</div>
		</div>
	);
}
