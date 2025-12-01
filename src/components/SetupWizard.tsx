import { createSignal, createEffect, For, Show, onMount } from "solid-js";
import { Button } from "./ui";
import {
  detectAiTools,
  getToolSetupInfo,
  configureContinue,
  type DetectedTool,
  type ToolSetupInfo,
} from "../lib/tauri";
import { toastStore } from "../stores/toast";
import { appStore } from "../stores/app";

interface SetupWizardProps {
  onClose?: () => void;
  onComplete?: () => void;
}

const toolLogos: Record<string, string> = {
  cursor: "/logos/cursor.svg",
  continue: "/logos/continue.svg",
  cline: "/logos/cline.svg",
  windsurf: "/logos/windsurf.svg",
};

export function SetupWizard(props: SetupWizardProps) {
  const { proxyStatus } = appStore;
  const [tools, setTools] = createSignal<DetectedTool[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [selectedTool, setSelectedTool] = createSignal<string | null>(null);
  const [setupInfo, setSetupInfo] = createSignal<ToolSetupInfo | null>(null);
  const [configuring, setConfiguring] = createSignal(false);
  const [copiedField, setCopiedField] = createSignal<string | null>(null);

  // Detect tools on mount
  onMount(async () => {
    try {
      const detected = await detectAiTools();
      setTools(detected);
    } catch (error) {
      console.error("Failed to detect tools:", error);
      toastStore.error("Failed to detect installed tools");
    } finally {
      setLoading(false);
    }
  });

  // Load setup info when tool is selected
  createEffect(async () => {
    const toolId = selectedTool();
    if (toolId) {
      try {
        const info = await getToolSetupInfo(toolId);
        setSetupInfo(info);
      } catch (error) {
        console.error("Failed to get setup info:", error);
      }
    } else {
      setSetupInfo(null);
    }
  });

  const handleCopy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toastStore.success("Copied to clipboard!");
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toastStore.error("Failed to copy");
    }
  };

  const handleAutoConfigure = async () => {
    const toolId = selectedTool();
    if (toolId !== "continue") return;

    setConfiguring(true);
    try {
      const configPath = await configureContinue();
      toastStore.success(`Continue configured! Config saved to ${configPath}`);
      props.onComplete?.();
    } catch (error) {
      toastStore.error(`Failed to configure: ${error}`);
    } finally {
      setConfiguring(false);
    }
  };

  const installedTools = () => tools().filter((t) => t.installed);
  const notInstalledTools = () => tools().filter((t) => !t.installed);

  const endpoint = () => proxyStatus().endpoint || "http://localhost:8317/v1";

  return (
    <div class="flex flex-col h-full">
      {/* Header */}
      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
        <div>
          <h2 class="text-lg font-bold text-gray-900 dark:text-gray-100">
            Setup Your Tools
          </h2>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            Configure your AI coding tools to use ProxyPal
          </p>
        </div>
        <Show when={props.onClose}>
          <button
            class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            onClick={props.onClose}
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
        </Show>
      </div>

      <div class="flex-1 overflow-hidden flex">
        {/* Tool list sidebar */}
        <div class="w-64 border-r border-gray-200 dark:border-gray-800 overflow-y-auto">
          <Show
            when={!loading()}
            fallback={
              <div class="p-4 space-y-3">
                <div class="animate-pulse h-12 bg-gray-200 dark:bg-gray-700 rounded-lg" />
                <div class="animate-pulse h-12 bg-gray-200 dark:bg-gray-700 rounded-lg" />
                <div class="animate-pulse h-12 bg-gray-200 dark:bg-gray-700 rounded-lg" />
              </div>
            }
          >
            {/* Installed tools */}
            <Show when={installedTools().length > 0}>
              <div class="p-3">
                <h3 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-2">
                  Detected Tools
                </h3>
                <For each={installedTools()}>
                  {(tool) => (
                    <button
                      class={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                        selectedTool() === tool.id
                          ? "bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300"
                          : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
                      }`}
                      onClick={() => setSelectedTool(tool.id)}
                    >
                      <div class="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden">
                        <img
                          src={toolLogos[tool.id] || "/logos/default.svg"}
                          alt={tool.name}
                          class="w-5 h-5"
                        />
                      </div>
                      <div class="flex-1 text-left">
                        <div class="font-medium text-sm">{tool.name}</div>
                        <div class="text-xs text-gray-500 dark:text-gray-400">
                          {tool.canAutoConfigure
                            ? "Auto-config available"
                            : "Manual setup"}
                        </div>
                      </div>
                      <Show when={tool.canAutoConfigure}>
                        <span class="w-2 h-2 rounded-full bg-green-500" />
                      </Show>
                    </button>
                  )}
                </For>
              </div>
            </Show>

            {/* Not installed tools */}
            <Show when={notInstalledTools().length > 0}>
              <div class="p-3 border-t border-gray-200 dark:border-gray-800">
                <h3 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-2">
                  Other Tools
                </h3>
                <For each={notInstalledTools()}>
                  {(tool) => (
                    <button
                      class={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors opacity-60 ${
                        selectedTool() === tool.id
                          ? "bg-gray-100 dark:bg-gray-800"
                          : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                      }`}
                      onClick={() => setSelectedTool(tool.id)}
                    >
                      <div class="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden">
                        <img
                          src={toolLogos[tool.id] || "/logos/default.svg"}
                          alt={tool.name}
                          class="w-5 h-5 grayscale"
                        />
                      </div>
                      <div class="flex-1 text-left">
                        <div class="font-medium text-sm text-gray-600 dark:text-gray-400">
                          {tool.name}
                        </div>
                        <div class="text-xs text-gray-400 dark:text-gray-500">
                          Not detected
                        </div>
                      </div>
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </Show>
        </div>

        {/* Setup instructions panel */}
        <div class="flex-1 overflow-y-auto p-6">
          <Show
            when={selectedTool() && setupInfo()}
            fallback={
              <div class="h-full flex items-center justify-center">
                <div class="text-center">
                  <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                    <svg
                      class="w-8 h-8 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="1.5"
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </div>
                  <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">
                    Select a Tool
                  </h3>
                  <p class="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
                    Choose an AI coding tool from the list to see setup
                    instructions
                  </p>
                </div>
              </div>
            }
          >
            {/* Tool header */}
            <div class="flex items-center gap-4 mb-6">
              <div class="w-14 h-14 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden">
                <img
                  src={setupInfo()!.logo}
                  alt={setupInfo()!.name}
                  class="w-9 h-9"
                />
              </div>
              <div class="flex-1">
                <h3 class="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {setupInfo()!.name}
                </h3>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  {setupInfo()!.canAutoConfigure
                    ? "Auto-configuration available"
                    : "Manual configuration required"}
                </p>
              </div>
              <Show when={setupInfo()!.canAutoConfigure}>
                <Button
                  variant="primary"
                  onClick={handleAutoConfigure}
                  disabled={configuring()}
                >
                  {configuring() ? (
                    <>
                      <svg
                        class="animate-spin -ml-1 mr-2 h-4 w-4"
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
                      Configuring...
                    </>
                  ) : (
                    <>
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
                          d="M13 10V3L4 14h7v7l9-11h-7z"
                        />
                      </svg>
                      Auto-Configure
                    </>
                  )}
                </Button>
              </Show>
            </div>

            {/* Note if present */}
            <Show when={setupInfo()!.note}>
              <div class="mb-6 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <div class="flex gap-3">
                  <svg
                    class="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <p class="text-sm text-amber-800 dark:text-amber-200">
                    {setupInfo()!.note}
                  </p>
                </div>
              </div>
            </Show>

            {/* Endpoint quick copy */}
            <Show when={setupInfo()!.endpoint}>
              <div class="mb-6 p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
                    ProxyPal Endpoint
                  </span>
                  <button
                    class="text-xs text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1"
                    onClick={() => handleCopy(endpoint(), "endpoint")}
                  >
                    {copiedField() === "endpoint" ? (
                      <>
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
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        Copied!
                      </>
                    ) : (
                      <>
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
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                          />
                        </svg>
                        Copy
                      </>
                    )}
                  </button>
                </div>
                <code class="block text-sm font-mono text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 px-3 py-2 rounded border border-gray-200 dark:border-gray-700">
                  {endpoint()}
                </code>
              </div>
            </Show>

            {/* Setup steps */}
            <div class="space-y-4">
              <h4 class="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Setup Steps
              </h4>
              <For each={setupInfo()!.steps}>
                {(step, index) => (
                  <div class="flex gap-4">
                    <div class="flex-shrink-0 w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 flex items-center justify-center text-sm font-bold">
                      {index() + 1}
                    </div>
                    <div class="flex-1 min-w-0">
                      <h5 class="font-medium text-gray-900 dark:text-gray-100 mb-1">
                        {step.title}
                      </h5>
                      <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {step.description}
                      </p>
                      <Show when={step.copyable}>
                        <div class="relative">
                          <code class="block text-sm font-mono text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg pr-20 break-all">
                            {step.copyable}
                          </code>
                          <button
                            class="absolute top-1.5 right-1.5 px-2 py-1 text-xs font-medium bg-white dark:bg-gray-700 rounded shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                            onClick={() =>
                              handleCopy(step.copyable!, `step-${index()}`)
                            }
                          >
                            {copiedField() === `step-${index()}`
                              ? "Copied!"
                              : "Copy"}
                          </button>
                        </div>
                      </Show>
                    </div>
                  </div>
                )}
              </For>
            </div>

            {/* Manual config for Continue */}
            <Show when={setupInfo()!.manualConfig}>
              <div class="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <h4 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                  Manual Configuration
                </h4>
                <div class="relative">
                  <pre class="text-xs font-mono text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 p-4 rounded-lg overflow-x-auto">
                    {setupInfo()!.manualConfig}
                  </pre>
                  <button
                    class="absolute top-2 right-2 px-2 py-1 text-xs font-medium bg-white dark:bg-gray-700 rounded shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                    onClick={() =>
                      handleCopy(setupInfo()!.manualConfig!, "manual")
                    }
                  >
                    {copiedField() === "manual" ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>
            </Show>
          </Show>
        </div>
      </div>

      {/* Footer */}
      <div class="px-6 py-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
        <div class="flex items-center justify-between">
          <p class="text-xs text-gray-500 dark:text-gray-400">
            {installedTools().length} tool
            {installedTools().length !== 1 ? "s" : ""} detected on your system
          </p>
          <Show when={props.onComplete}>
            <Button variant="secondary" onClick={props.onComplete}>
              Done
            </Button>
          </Show>
        </div>
      </div>
    </div>
  );
}

// Compact card version for dashboard
export function SetupWizardCard(props: { onOpenWizard: () => void }) {
  const [tools, setTools] = createSignal<DetectedTool[]>([]);
  const [loading, setLoading] = createSignal(true);

  onMount(async () => {
    try {
      const detected = await detectAiTools();
      setTools(detected);
    } catch (error) {
      console.error("Failed to detect tools:", error);
    } finally {
      setLoading(false);
    }
  });

  const installedCount = () => tools().filter((t) => t.installed).length;
  const autoConfigurable = () =>
    tools().filter((t) => t.installed && t.canAutoConfigure);

  return (
    <div class="rounded-xl bg-gradient-to-br from-brand-50 to-brand-100 dark:from-brand-900/20 dark:to-brand-800/20 border border-brand-200 dark:border-brand-800 p-4">
      <div class="flex items-start gap-4">
        <div class="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center flex-shrink-0">
          <svg
            class="w-5 h-5 text-white"
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
        </div>
        <div class="flex-1 min-w-0">
          <h3 class="font-semibold text-gray-900 dark:text-gray-100 mb-1">
            Configure Your Tools
          </h3>
          <Show
            when={!loading()}
            fallback={
              <p class="text-sm text-gray-600 dark:text-gray-400">
                Detecting installed tools...
              </p>
            }
          >
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
              {installedCount() > 0 ? (
                <>
                  Found {installedCount()} tool
                  {installedCount() !== 1 ? "s" : ""}.
                  {autoConfigurable().length > 0 && (
                    <> {autoConfigurable().length} can be auto-configured.</>
                  )}
                </>
              ) : (
                "Set up your AI coding tools to use ProxyPal."
              )}
            </p>
          </Show>
          <Button variant="secondary" size="sm" onClick={props.onOpenWizard}>
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
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            Setup Tools
          </Button>
        </div>
      </div>
    </div>
  );
}
