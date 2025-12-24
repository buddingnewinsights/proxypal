import { Match, onCleanup, onMount, Show, Switch } from "solid-js";
import { CommandPalette } from "./components/CommandPalette";
import { Sidebar } from "./components/Sidebar";
import { ToastContainer } from "./components/ui";
import {
	AnalyticsPage,
	ApiKeysPage,
	AuthFilesPage,
	DashboardPage,
	LogViewerPage,
	SettingsPage,
	WelcomePage,
} from "./pages";
import { appStore } from "./stores/app";
import { themeStore } from "./stores/theme";

function App() {
	const { currentPage, isInitialized, initialize, setCurrentPage } = appStore;

	onMount(() => {
		initialize();

		// Listen for navigation events from child components
		const handleNavigateToSettings = () => {
			setCurrentPage("settings");
		};
		window.addEventListener("navigate-to-settings", handleNavigateToSettings);
		onCleanup(() => {
			window.removeEventListener(
				"navigate-to-settings",
				handleNavigateToSettings,
			);
		});
	});

	return (
		<>
			<Show
				when={isInitialized()}
				fallback={
					<div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
						<div class="text-center">
							<div class="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4  animate-pulse">
								<img
									src={
										themeStore.resolvedTheme() === "dark"
											? "/proxypal-white.png"
											: "/proxypal-black.png"
									}
									alt="ProxyPal Logo"
									class="w-16 h-16 rounded-2xl object-contain"
								/>
							</div>
							<p class="text-gray-500 dark:text-gray-400">
								Loading ProxyPal...
							</p>
						</div>
					</div>
				}
			>
				<Show when={currentPage() !== "welcome"}>
					<Sidebar />
				</Show>
				<div
					classList={{
						"pl-16": currentPage() !== "welcome" && !appStore.sidebarExpanded(),
						"pl-48": currentPage() !== "welcome" && appStore.sidebarExpanded(),
					}}
				>
					<Switch fallback={<WelcomePage />}>
						<Match when={currentPage() === "welcome"}>
							<WelcomePage />
						</Match>
						<Match when={currentPage() === "dashboard"}>
							<DashboardPage />
						</Match>
						<Match when={currentPage() === "settings"}>
							<SettingsPage />
						</Match>
						<Match when={currentPage() === "api-keys"}>
							<ApiKeysPage />
						</Match>
						<Match when={currentPage() === "auth-files"}>
							<AuthFilesPage />
						</Match>
						<Match when={currentPage() === "logs"}>
							<LogViewerPage />
						</Match>
						<Match when={currentPage() === "analytics"}>
							<AnalyticsPage />
						</Match>
					</Switch>
				</div>
			</Show>
			<ToastContainer />
			<CommandPalette />
		</>
	);
}

export default App;
