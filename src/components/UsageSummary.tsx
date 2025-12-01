import { createSignal, createEffect, onCleanup, Show, For } from "solid-js";
import { appStore } from "../stores/app";
import { getUsageStats, type UsageStats } from "../lib/tauri";

function formatUptime(startTime: number | null): string {
  if (!startTime) return "—";

  const now = Date.now();
  const diff = Math.floor((now - startTime) / 1000);

  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) {
    const hours = Math.floor(diff / 3600);
    const mins = Math.floor((diff % 3600) / 60);
    return `${hours}h ${mins}m`;
  }
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  return `${days}d ${hours}h`;
}

function formatNumber(num: number): string {
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  }
  return num.toLocaleString();
}

function formatTokens(num: number): string {
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(2) + "M";
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1) + "K";
  }
  return num.toLocaleString();
}

// Animated counter component
function AnimatedNumber(props: {
  value: number;
  format?: (n: number) => string;
}) {
  const [displayValue, setDisplayValue] = createSignal(0);
  const format = () => props.format || formatNumber;

  createEffect(() => {
    const target = props.value;
    const current = displayValue();

    if (current === target) return;

    // Animate over 500ms
    const duration = 500;
    const startTime = Date.now();
    const startValue = current;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const newValue = Math.round(startValue + (target - startValue) * eased);

      setDisplayValue(newValue);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  });

  return <span class="tabular-nums">{format()(displayValue())}</span>;
}

export function UsageSummary() {
  const { proxyStatus, proxyStartTime } = appStore;
  const [uptime, setUptime] = createSignal(formatUptime(proxyStartTime()));
  const [stats, setStats] = createSignal<UsageStats | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [expanded, setExpanded] = createSignal(false);

  // Fetch usage stats
  const fetchStats = async () => {
    if (!proxyStatus().running) {
      setStats(null);
      setLoading(false);
      return;
    }

    try {
      const data = await getUsageStats();
      setStats(data);
    } catch (err) {
      console.error("Failed to fetch usage stats:", err);
    } finally {
      setLoading(false);
    }
  };

  // Update uptime every second when proxy is running
  createEffect(() => {
    if (proxyStatus().running) {
      const interval = setInterval(() => {
        setUptime(formatUptime(proxyStartTime()));
      }, 1000);
      onCleanup(() => clearInterval(interval));
    } else {
      setUptime("—");
    }
  });

  // Fetch stats on mount and every 10 seconds
  createEffect(() => {
    fetchStats();

    if (proxyStatus().running) {
      const interval = setInterval(fetchStats, 10000);
      onCleanup(() => clearInterval(interval));
    }
  });

  const successRate = () => {
    const s = stats();
    if (!s || s.totalRequests === 0) return 100;
    return Math.round((s.successCount / s.totalRequests) * 100);
  };

  const hasStats = () => {
    const s = stats();
    return s && s.totalRequests > 0;
  };

  return (
    <div class="space-y-3">
      {/* Primary Stats Row */}
      <div class="grid grid-cols-4 gap-2 sm:gap-3">
        {/* Proxy Status */}
        <div class="p-3 sm:p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
          <div class="flex items-center gap-1.5 mb-1">
            <div
              class={`w-2 h-2 rounded-full transition-colors ${proxyStatus().running ? "bg-green-500 animate-pulse" : "bg-gray-400"}`}
            />
            <span class="text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Status
            </span>
          </div>
          <p class="text-sm sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
            {proxyStatus().running ? "Running" : "Stopped"}
          </p>
        </div>

        {/* Uptime */}
        <div class="p-3 sm:p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
          <div class="flex items-center gap-1.5 mb-1">
            <svg
              class="w-2.5 h-2.5 sm:w-3 sm:h-3 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span class="text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Uptime
            </span>
          </div>
          <p class="text-sm sm:text-lg font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
            {uptime()}
          </p>
        </div>

        {/* Requests Today */}
        <div class="p-3 sm:p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
          <div class="flex items-center gap-1.5 mb-1">
            <svg
              class="w-2.5 h-2.5 sm:w-3 sm:h-3 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            <span class="text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Today
            </span>
          </div>
          <Show
            when={!loading()}
            fallback={
              <div class="h-6 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            }
          >
            <p class="text-sm sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
              <AnimatedNumber value={stats()?.requestsToday || 0} />
              <span class="text-xs font-normal text-gray-500 ml-0.5">req</span>
            </p>
          </Show>
        </div>

        {/* Tokens Today */}
        <div class="p-3 sm:p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
          <div class="flex items-center gap-1.5 mb-1">
            <svg
              class="w-2.5 h-2.5 sm:w-3 sm:h-3 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
              />
            </svg>
            <span class="text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Tokens
            </span>
          </div>
          <Show
            when={!loading()}
            fallback={
              <div class="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            }
          >
            <p class="text-sm sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
              <AnimatedNumber
                value={stats()?.tokensToday || 0}
                format={formatTokens}
              />
            </p>
          </Show>
        </div>
      </div>

      {/* Expandable Details */}
      <Show when={hasStats()}>
        <button
          onClick={() => setExpanded(!expanded())}
          class="w-full flex items-center justify-between px-4 py-2 rounded-lg bg-gray-50 dark:bg-gray-800/30 border border-gray-200 dark:border-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors text-sm"
        >
          <span class="text-gray-600 dark:text-gray-400 font-medium">
            {expanded() ? "Hide details" : "Show usage details"}
          </span>
          <svg
            class={`w-4 h-4 text-gray-400 transition-transform duration-200 ${expanded() ? "rotate-180" : ""}`}
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

        <Show when={expanded()}>
          <div class="space-y-3 animate-slide-down">
            {/* All-time Stats */}
            <div class="grid grid-cols-3 gap-2 sm:gap-3">
              {/* Total Requests */}
              <div class="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50">
                <div class="text-[10px] sm:text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">
                  Total Requests
                </div>
                <div class="text-lg sm:text-xl font-bold text-blue-700 dark:text-blue-300">
                  <AnimatedNumber value={stats()?.totalRequests || 0} />
                </div>
                <div class="flex items-center gap-2 mt-1">
                  <span class="text-[10px] text-green-600 dark:text-green-400">
                    ✓ {formatNumber(stats()?.successCount || 0)}
                  </span>
                  <Show when={(stats()?.failureCount || 0) > 0}>
                    <span class="text-[10px] text-red-500">
                      ✗ {formatNumber(stats()?.failureCount || 0)}
                    </span>
                  </Show>
                </div>
              </div>

              {/* Total Tokens */}
              <div class="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800/50">
                <div class="text-[10px] sm:text-xs font-medium text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-1">
                  Total Tokens
                </div>
                <div class="text-lg sm:text-xl font-bold text-purple-700 dark:text-purple-300">
                  <AnimatedNumber
                    value={stats()?.totalTokens || 0}
                    format={formatTokens}
                  />
                </div>
                <div class="flex items-center gap-2 mt-1 text-[10px] text-gray-500 dark:text-gray-400">
                  <span>↓ {formatTokens(stats()?.inputTokens || 0)}</span>
                  <span>↑ {formatTokens(stats()?.outputTokens || 0)}</span>
                </div>
              </div>

              {/* Success Rate */}
              <div class="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800/50">
                <div class="text-[10px] sm:text-xs font-medium text-green-600 dark:text-green-400 uppercase tracking-wider mb-1">
                  Success Rate
                </div>
                <div class="text-lg sm:text-xl font-bold text-green-700 dark:text-green-300">
                  {successRate()}%
                </div>
                <div class="w-full h-1.5 bg-green-200 dark:bg-green-800 rounded-full mt-2 overflow-hidden">
                  <div
                    class="h-full bg-green-500 dark:bg-green-400 rounded-full transition-all duration-500"
                    style={{ width: `${successRate()}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Model Breakdown */}
            <Show when={stats()?.models && stats()!.models.length > 0}>
              <div class="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/30 border border-gray-200 dark:border-gray-700/50">
                <div class="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">
                  Models Used
                </div>
                <div class="space-y-2">
                  <For each={stats()?.models.slice(0, 5)}>
                    {(model) => {
                      const maxRequests = Math.max(
                        ...(stats()?.models.map((m) => m.requests) || [1]),
                      );
                      const percentage = (model.requests / maxRequests) * 100;

                      return (
                        <div class="flex items-center gap-2">
                          <div
                            class="w-24 sm:w-32 truncate text-xs font-mono text-gray-700 dark:text-gray-300"
                            title={model.model}
                          >
                            {model.model}
                          </div>
                          <div class="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                              class="h-full bg-gradient-to-r from-brand-400 to-brand-600 rounded-full transition-all duration-500"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <div class="w-16 text-right text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                            {formatNumber(model.requests)} req
                          </div>
                        </div>
                      );
                    }}
                  </For>
                </div>
              </div>
            </Show>
          </div>
        </Show>
      </Show>

      {/* Empty state when no usage yet */}
      <Show when={!loading() && !hasStats() && proxyStatus().running}>
        <div class="text-center py-3 px-4 rounded-lg bg-gray-50 dark:bg-gray-800/30 border border-gray-200 dark:border-gray-700/50">
          <p class="text-sm text-gray-500 dark:text-gray-400">
            No API requests yet. Start coding with your connected AI tools!
          </p>
        </div>
      </Show>
    </div>
  );
}
