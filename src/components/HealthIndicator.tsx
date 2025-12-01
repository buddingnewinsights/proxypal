import { createSignal, createEffect, onCleanup, Show } from "solid-js";
import {
  checkProviderHealth,
  type ProviderHealth,
  type HealthStatus,
  type Provider,
} from "../lib/tauri";
import { appStore } from "../stores/app";

const statusConfig = {
  healthy: {
    color: "bg-green-500",
    label: "Healthy",
    textColor: "text-green-600 dark:text-green-400",
  },
  degraded: {
    color: "bg-amber-500",
    label: "Degraded",
    textColor: "text-amber-600 dark:text-amber-400",
  },
  offline: {
    color: "bg-red-500",
    label: "Offline",
    textColor: "text-red-600 dark:text-red-400",
  },
  unconfigured: {
    color: "bg-gray-400",
    label: "Not configured",
    textColor: "text-gray-500 dark:text-gray-400",
  },
};

interface HealthIndicatorProps {
  provider: Provider;
  showLabel?: boolean;
}

export function HealthIndicator(props: HealthIndicatorProps) {
  const { proxyStatus } = appStore;
  const [health, setHealth] = createSignal<HealthStatus | null>(null);
  const [checking, setChecking] = createSignal(false);

  const checkHealth = async () => {
    if (checking()) return;
    setChecking(true);
    try {
      const result = await checkProviderHealth();
      setHealth(result[props.provider]);
    } catch (error) {
      console.error("Failed to check health:", error);
      setHealth({ status: "offline", lastChecked: Date.now() / 1000 });
    } finally {
      setChecking(false);
    }
  };

  // Check health on mount and when proxy status changes
  createEffect(() => {
    if (proxyStatus().running) {
      checkHealth();
      // Check every 30 seconds
      const interval = setInterval(checkHealth, 30000);
      onCleanup(() => clearInterval(interval));
    } else {
      setHealth({ status: "offline", lastChecked: Date.now() / 1000 });
    }
  });

  const status = () => health()?.status || "unconfigured";
  const config = () => statusConfig[status()];

  return (
    <div
      class="flex items-center gap-1.5"
      title={`${config().label}${health()?.latencyMs ? ` (${health()!.latencyMs}ms)` : ""}`}
    >
      <div
        class={`w-2 h-2 rounded-full ${config().color} ${status() === "healthy" ? "animate-pulse" : ""} ${checking() ? "opacity-50" : ""}`}
      />
      <Show when={props.showLabel}>
        <span class={`text-xs ${config().textColor}`}>
          {config().label}
          <Show when={health()?.latencyMs}>
            <span class="text-gray-400 ml-1">({health()!.latencyMs}ms)</span>
          </Show>
        </span>
      </Show>
    </div>
  );
}

// Full health panel showing all providers
export function HealthPanel() {
  const { authStatus, proxyStatus } = appStore;
  const [health, setHealth] = createSignal<ProviderHealth | null>(null);
  const [lastChecked, setLastChecked] = createSignal<Date | null>(null);

  const checkHealth = async () => {
    try {
      const result = await checkProviderHealth();
      setHealth(result);
      setLastChecked(new Date());
    } catch (error) {
      console.error("Failed to check health:", error);
    }
  };

  createEffect(() => {
    if (proxyStatus().running) {
      checkHealth();
      const interval = setInterval(checkHealth, 30000);
      onCleanup(() => clearInterval(interval));
    }
  });

  const providers = [
    { id: "claude" as const, name: "Claude", connected: authStatus().claude },
    { id: "openai" as const, name: "ChatGPT", connected: authStatus().openai },
    { id: "gemini" as const, name: "Gemini", connected: authStatus().gemini },
    { id: "qwen" as const, name: "Qwen", connected: authStatus().qwen },
    { id: "iflow" as const, name: "iFlow", connected: authStatus().iflow },
    {
      id: "vertex" as const,
      name: "Vertex AI",
      connected: authStatus().vertex,
    },
    {
      id: "antigravity" as const,
      name: "Antigravity",
      connected: authStatus().antigravity,
    },
  ];

  const connectedProviders = () => providers.filter((p) => p.connected);

  return (
    <Show when={connectedProviders().length > 0}>
      <div class="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Provider Status
          </span>
          <button
            onClick={checkHealth}
            class="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            title="Refresh health status"
          >
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
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>

        <div class="space-y-1.5">
          {connectedProviders().map((provider) => {
            const providerHealth = () => health()?.[provider.id];
            const status = () => providerHealth()?.status || "unconfigured";
            const cfg = () => statusConfig[status()];

            return (
              <div class="flex items-center justify-between py-1">
                <span class="text-sm text-gray-700 dark:text-gray-300">
                  {provider.name}
                </span>
                <div class="flex items-center gap-2">
                  <Show when={providerHealth()?.latencyMs}>
                    <span class="text-xs text-gray-400">
                      {providerHealth()!.latencyMs}ms
                    </span>
                  </Show>
                  <div
                    class={`w-2 h-2 rounded-full ${cfg().color} ${status() === "healthy" ? "animate-pulse" : ""}`}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <Show when={lastChecked()}>
          <p class="text-xs text-gray-400 mt-2">
            Last checked: {lastChecked()!.toLocaleTimeString()}
          </p>
        </Show>
      </div>
    </Show>
  );
}
