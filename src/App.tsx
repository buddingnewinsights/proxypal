import { Match, Switch, onMount, Show } from "solid-js";
import { WelcomePage, DashboardPage, SettingsPage, ApiKeysPage } from "./pages";
import { ToastContainer } from "./components/ui";
import { CommandPalette } from "./components/CommandPalette";
import { appStore } from "./stores/app";

function App() {
  const { currentPage, isInitialized, initialize } = appStore;

  onMount(() => {
    initialize();
  });

  return (
    <>
      <Show
        when={isInitialized()}
        fallback={
          <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
            <div class="text-center">
              <div class="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center mb-4 animate-pulse">
                <span class="text-white text-3xl">⚡</span>
              </div>
              <p class="text-gray-500 dark:text-gray-400">
                Loading ProxyPal...
              </p>
            </div>
          </div>
        }
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
        </Switch>
      </Show>
      <ToastContainer />
      <CommandPalette />
    </>
  );
}

export default App;
