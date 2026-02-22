import { open } from "@tauri-apps/plugin-dialog";
import { createMemo, createSignal, For, Show } from "solid-js";
import { useI18n } from "../../i18n";
import type { AppConfig, SshConfig } from "../../lib/tauri";
import {
	deleteSshConfig,
	saveSshConfig,
	setSshConnection,
} from "../../lib/tauri";
import { appStore } from "../../stores/app";
import { toastStore } from "../../stores/toast";
import { Button, Switch } from "../ui";

interface SshSettingsProps {
	config: AppConfig;
	setConfig: (updater: (prev: AppConfig) => AppConfig) => void;
}

export function SshSettings(props: SshSettingsProps) {
	const { t } = useI18n();

	// SSH State
	const [sshId, setSshId] = createSignal("");
	const [sshHost, setSshHost] = createSignal("");
	const [sshPort, setSshPort] = createSignal(22);
	const [sshUser, setSshUser] = createSignal("");
	const [sshPass, setSshPass] = createSignal("");
	const [sshKey, setSshKey] = createSignal("");
	const [sshRemote, setSshRemote] = createSignal(8317);
	const [sshLocal, setSshLocal] = createSignal(8317);
	const [sshAdding, setSshAdding] = createSignal(false);

	// SSH Handlers
	const handlePickKeyFile = async () => {
		try {
			const file = await open({
				multiple: false,
				filters: [{ name: "All Files", extensions: ["*"] }],
			});
			if (file) setSshKey(file as string);
		} catch (e) {
			console.error(e);
		}
	};

	const handleSaveSsh = async () => {
		if (!sshHost() || !sshUser()) {
			toastStore.error(t("settings.toasts.hostAndUsernameRequired"));
			return;
		}

		setSshAdding(true);
		try {
			const newConfig: SshConfig = {
				id: sshId() || crypto.randomUUID(),
				host: sshHost(),
				port: sshPort(),
				username: sshUser(),
				password: sshPass() || undefined,
				keyFile: sshKey() || undefined,
				remotePort: sshRemote(),
				localPort: sshLocal(),
				enabled: false,
			};

			const updated = await saveSshConfig(newConfig);
			props.setConfig((prev) => ({ ...prev, sshConfigs: updated }));

			// Reset form
			handleCancelEdit();
			toastStore.success(t("settings.toasts.connectionSaved"));
		} catch (e) {
			toastStore.error(t("settings.toasts.failedToSave"), String(e));
		} finally {
			setSshAdding(false);
		}
	};

	const handleEditSsh = (ssh: SshConfig) => {
		setSshId(ssh.id);
		setSshHost(ssh.host);
		setSshPort(ssh.port);
		setSshUser(ssh.username);
		setSshPass(ssh.password || "");
		setSshKey(ssh.keyFile || "");
		setSshRemote(ssh.remotePort);
		setSshLocal(ssh.localPort);
		// Scroll to form?
	};

	const handleCancelEdit = () => {
		setSshId("");
		setSshHost("");
		setSshPort(22);
		setSshUser("");
		setSshPass("");
		setSshKey("");
		setSshRemote(8317);
		setSshLocal(8317);
	};

	const handleDeleteSsh = async (id: string) => {
		if (!confirm(t("settings.confirm.deleteConnection"))) return;
		try {
			const updated = await deleteSshConfig(id);
			props.setConfig((prev) => ({ ...prev, sshConfigs: updated }));
		} catch (e) {
			toastStore.error(t("settings.toasts.failedToDelete"), String(e));
		}
	};

	const handleToggleSsh = async (id: string, enable: boolean) => {
		try {
			await setSshConnection(id, enable);
			// Updating local config to reflect target state immediately for UI responsiveness
			const configs = props.config.sshConfigs || [];
			const updated = configs.map((c) =>
				c.id === id ? { ...c, enabled: enable } : c,
			);
			props.setConfig((prev) => ({ ...prev, sshConfigs: updated }));
		} catch (e) {
			toastStore.error(t("settings.toasts.failedToToggle"), String(e));
		}
	};

	return (
		<div class="space-y-4">
			<h2 class="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
				SSH API Connections
			</h2>
			<p class="text-sm text-gray-500 dark:text-gray-400">
				Securely tunnel your local API (port 8317) to a remote server for shared
				access.
			</p>

			{/* List */}
			<div class="space-y-3">
				<For each={props.config.sshConfigs || []}>
					{(ssh: SshConfig) => {
						const statusProps = createMemo(() => {
							const status = appStore.sshStatus()[ssh.id] || {
								id: ssh.id,
								status: ssh.enabled ? "connecting" : "disconnected",
								message: undefined,
							};

							let displayStatus = status.status;
							const displayMessage = status.message;

							if (ssh.enabled) {
								if (!displayStatus || displayStatus === "disconnected") {
									displayStatus = "connecting";
								}
							} else {
								if (
									displayStatus === "connected" ||
									displayStatus === "connecting"
								) {
									displayStatus = "disconnected";
								}
							}
							return { status: displayStatus, message: displayMessage };
						});

						return (
							<div class="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
								<div>
									<div class="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
										<span>
											{ssh.username}@{ssh.host}:{ssh.port}
										</span>
									</div>
									<div class="text-xs text-gray-500 mt-1">
										Forward: Remote :{ssh.remotePort} &rarr; Local :
										{ssh.localPort}
									</div>
									<Show when={statusProps().message}>
										<div
											class={`text-xs mt-1 break-all flex items-start gap-1 ${
												statusProps().status === "error"
													? "text-red-500"
													: "text-gray-500"
											}`}
										>
											<span class="opacity-75">&gt;</span>
											<span>{statusProps().message}</span>
										</div>
									</Show>
								</div>
								<div class="flex items-center gap-4">
									<div class="flex items-center gap-2">
										<div
											class={`w-2.5 h-2.5 rounded-full ${
												statusProps().status === "connected"
													? "bg-green-500"
													: statusProps().status === "error"
														? "bg-red-500"
														: statusProps().status === "connecting" ||
																statusProps().status === "reconnecting"
															? "bg-orange-500 animate-pulse"
															: "bg-gray-400"
											}`}
										/>
										<span class="text-sm font-medium text-gray-600 dark:text-gray-400 capitalize min-w-[50px]">
											{statusProps().status}
										</span>
									</div>
									<div class="h-6 w-px bg-gray-200 dark:bg-gray-700"></div>
									<Switch
										checked={ssh.enabled}
										onChange={(val) => handleToggleSsh(ssh.id, val)}
									/>
									<button
										class="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
										title="Edit Connection"
										onClick={() => handleEditSsh(ssh)}
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
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
										class="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
										title="Delete Connection"
										onClick={() => handleDeleteSsh(ssh.id)}
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
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
						);
					}}
				</For>
				<Show when={(props.config.sshConfigs || []).length === 0}>
					<div class="text-center py-8 text-gray-500 dark:text-gray-400 bg-gray-50/50 dark:bg-gray-800/30 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
						No SSH connections configured
					</div>
				</Show>
			</div>

			{/* Add Form */}
			<div class="p-5 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 space-y-4">
				<div class="flex items-center justify-between">
					<h3 class="font-medium text-gray-900 dark:text-gray-100">
						{sshId() ? "Edit Connection" : "Add New Connection"}
					</h3>
					<Show when={sshId()}>
						<button
							onClick={handleCancelEdit}
							class="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
						>
							Cancel Edit
						</button>
					</Show>
				</div>
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<div class="space-y-1">
						<label class="text-xs font-medium text-gray-500 uppercase">
							Host / IP
						</label>
						<input
							class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
							placeholder="e.g. 192.168.1.1 or vps.example.com"
							value={sshHost()}
							onInput={(e) => setSshHost(e.currentTarget.value)}
						/>
					</div>
					<div class="space-y-1">
						<label class="text-xs font-medium text-gray-500 uppercase">
							Port
						</label>
						<input
							class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
							placeholder="22"
							type="number"
							value={sshPort()}
							onInput={(e) => setSshPort(parseInt(e.currentTarget.value) || 22)}
						/>
					</div>
					<div class="space-y-1">
						<label class="text-xs font-medium text-gray-500 uppercase">
							Username
						</label>
						<input
							class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
							placeholder="root"
							value={sshUser()}
							onInput={(e) => setSshUser(e.currentTarget.value)}
						/>
					</div>
					<div class="space-y-1">
						<label class="text-xs font-medium text-gray-500 uppercase">
							Password (Not Supported)
						</label>
						<input
							class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-sm cursor-not-allowed"
							placeholder="Password auth not supported - Use Key File"
							type="password"
							disabled
							value={sshPass()}
							onInput={(e) => setSshPass(e.currentTarget.value)}
						/>
						<p class="text-[10px] text-orange-500">
							Note: Password authentication is not supported. Please use a
							Private Key file.
						</p>
					</div>
					<div class="col-span-1 sm:col-span-2 space-y-1">
						<label class="text-xs font-medium text-gray-500 uppercase">
							Private Key File
						</label>
						<div class="flex gap-2">
							<input
								class="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
								placeholder="/path/to/private_key"
								value={sshKey()}
								onInput={(e) => setSshKey(e.currentTarget.value)}
							/>
							<button
								class="px-3 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-sm font-medium rounded-lg transition-colors"
								onClick={handlePickKeyFile}
							>
								Browse
							</button>
						</div>
					</div>
					<div class="space-y-1">
						<label class="text-xs font-medium text-gray-500 uppercase">
							Remote Port (VPS)
						</label>
						<input
							class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
							placeholder="8317"
							type="number"
							value={sshRemote()}
							onInput={(e) =>
								setSshRemote(parseInt(e.currentTarget.value) || 0)
							}
						/>
						<p class="text-[10px] text-gray-400">
							Port to open on the remote server
						</p>
					</div>
					<div class="space-y-1">
						<label class="text-xs font-medium text-gray-500 uppercase">
							Local Port (This App)
						</label>
						<input
							class="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
							placeholder="8317"
							type="number"
							value={sshLocal()}
							onInput={(e) => setSshLocal(parseInt(e.currentTarget.value) || 0)}
						/>
						<p class="text-[10px] text-gray-400">
							Port running locally (default 8317)
						</p>
					</div>
				</div>
				<div class="pt-2">
					<Button
						onClick={handleSaveSsh}
						loading={sshAdding()}
						variant="primary"
						class="w-full sm:w-auto"
					>
						{sshId() ? "Update Connection" : "Add Connection"}
					</Button>
				</div>
			</div>
		</div>
	);
}
