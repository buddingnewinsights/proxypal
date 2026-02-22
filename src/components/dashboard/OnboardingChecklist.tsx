import { Show, splitProps } from "solid-js";
import { useI18n } from "../../i18n";
import type { Provider } from "../../lib/tauri";
import { Button } from "../ui";

interface OnboardingChecklistProps {
	isComplete: boolean;
	proxyRunning: boolean;
	isToggling: boolean;
	onToggleProxy: () => Promise<void>;
	hasProvider: boolean;
	onConnectProvider: (provider: Provider) => Promise<void>;
	firstDisconnectedProvider?: Provider;
	hasAgent: boolean;
	onNavigateSettings: () => void;
}

export function OnboardingChecklist(props: OnboardingChecklistProps) {
	const { t } = useI18n();
	const [local] = splitProps(props, [
		"isComplete",
		"proxyRunning",
		"isToggling",
		"onToggleProxy",
		"hasProvider",
		"onConnectProvider",
		"firstDisconnectedProvider",
		"hasAgent",
		"onNavigateSettings",
	]);

	return (
		<Show when={!local.isComplete}>
			<div class="p-4 sm:p-6 rounded-2xl bg-gradient-to-br from-brand-50 to-purple-50 dark:from-brand-900/30 dark:to-purple-900/20 border border-brand-200 dark:border-brand-800/50">
				<div class="mb-4">
					<h2 class="text-lg font-bold text-gray-900 dark:text-gray-100">
						{t("dashboard.onboarding.getStarted")}
					</h2>
					<p class="text-sm text-gray-600 dark:text-gray-400">
						{t("dashboard.onboarding.completeSteps")}
					</p>
				</div>
				<div class="space-y-3">
					{/* Step 1: Start Proxy */}
					<div
						class={`flex items-center gap-3 p-3 rounded-xl border ${local.proxyRunning ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800" : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"}`}
					>
						<div
							class={`w-8 h-8 rounded-full flex items-center justify-center ${local.proxyRunning ? "bg-green-500 text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-500"}`}
						>
							{local.proxyRunning ? (
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
								{t("dashboard.onboarding.startProxy")}
							</p>
							<p class="text-xs text-gray-500 dark:text-gray-400">
								{t("dashboard.onboarding.enableLocalProxy")}
							</p>
						</div>
						<Show when={!local.proxyRunning}>
							<Button
								size="sm"
								variant="primary"
								onClick={local.onToggleProxy}
								disabled={local.isToggling}
							>
								{local.isToggling
									? t("dashboard.onboarding.starting")
									: t("dashboard.onboarding.start")}
							</Button>
						</Show>
					</div>
					{/* Step 2: Connect Provider */}
					<div
						class={`flex items-center gap-3 p-3 rounded-xl border ${local.hasProvider ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800" : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"}`}
					>
						<div
							class={`w-8 h-8 rounded-full flex items-center justify-center ${local.hasProvider ? "bg-green-500 text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-500"}`}
						>
							{local.hasProvider ? (
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
								{t("dashboard.checklist.connectProvider")}
							</p>
							<p class="text-xs text-gray-500 dark:text-gray-400">
								{t("dashboard.checklist.connectProviderDescription")}
							</p>
						</div>
						<Show when={!local.hasProvider && local.proxyRunning}>
							<Button
								size="sm"
								variant="secondary"
								onClick={() => {
									const first = local.firstDisconnectedProvider;
									if (first) local.onConnectProvider(first);
								}}
							>
								{t("dashboard.checklist.connect")}
							</Button>
						</Show>
					</div>
					{/* Step 3: Configure Agent */}
					<div
						class={`flex items-center gap-3 p-3 rounded-xl border ${local.hasAgent ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800" : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"}`}
					>
						<div
							class={`w-8 h-8 rounded-full flex items-center justify-center ${local.hasAgent ? "bg-green-500 text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-500"}`}
						>
							{local.hasAgent ? (
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
								{t("dashboard.checklist.configureAgent")}
							</p>
							<p class="text-xs text-gray-500 dark:text-gray-400">
								{t("dashboard.checklist.configureAgentDescription")}
							</p>
						</div>
						<Show when={!local.hasAgent && local.hasProvider}>
							<Button
								size="sm"
								variant="secondary"
								onClick={local.onNavigateSettings}
							>
								{t("dashboard.checklist.setup")}
							</Button>
						</Show>
					</div>
				</div>
			</div>
		</Show>
	);
}
