import { createSignal, For, Show, createEffect } from "solid-js";
import { Button, Switch } from "../components/ui";
import { appStore } from "../stores/app";
import { toastStore } from "../stores/toast";
import { saveConfig, AMP_MODEL_SLOTS, testOpenAIProvider } from "../lib/tauri";
import type {
  AmpOpenAIModel,
  AmpOpenAIProvider,
  AmpModelMapping,
  ProviderTestResult,
} from "../lib/tauri";

export function SettingsPage() {
  const { config, setConfig, setCurrentPage, authStatus } = appStore;
  const [saving, setSaving] = createSignal(false);

  // OpenAI provider state
  const [providerName, setProviderName] = createSignal("");
  const [providerBaseUrl, setProviderBaseUrl] = createSignal("");
  const [providerApiKey, setProviderApiKey] = createSignal("");
  const [providerModels, setProviderModels] = createSignal<AmpOpenAIModel[]>(
    [],
  );
  const [newModelName, setNewModelName] = createSignal("");
  const [newModelAlias, setNewModelAlias] = createSignal("");

  // Custom mapping state (for adding new mappings beyond predefined slots)
  const [newMappingFrom, setNewMappingFrom] = createSignal("");
  const [newMappingTo, setNewMappingTo] = createSignal("");

  // Provider test state
  const [testingProvider, setTestingProvider] = createSignal(false);
  const [providerTestResult, setProviderTestResult] =
    createSignal<ProviderTestResult | null>(null);

  // Test connection to the custom OpenAI provider
  const testProviderConnection = async () => {
    const baseUrl = providerBaseUrl().trim();
    const apiKey = providerApiKey().trim();

    if (!baseUrl || !apiKey) {
      toastStore.error("Base URL and API key are required to test connection");
      return;
    }

    setTestingProvider(true);
    setProviderTestResult(null);

    try {
      const result = await testOpenAIProvider(baseUrl, apiKey);
      setProviderTestResult(result);

      if (result.success) {
        const modelsInfo = result.modelsFound
          ? ` Found ${result.modelsFound} models.`
          : "";
        toastStore.success(`Connection successful!${modelsInfo}`);
      } else {
        toastStore.error(result.message);
      }
    } catch (error) {
      const errorMsg = String(error);
      setProviderTestResult({
        success: false,
        message: errorMsg,
      });
      toastStore.error("Connection test failed", errorMsg);
    } finally {
      setTestingProvider(false);
    }
  };

  // Initialize OpenAI provider form from config
  createEffect(() => {
    const provider = config().ampOpenaiProvider;
    if (provider) {
      setProviderName(provider.name);
      setProviderBaseUrl(provider.baseUrl);
      setProviderApiKey(provider.apiKey);
      setProviderModels(provider.models || []);
    }
  });

  // Helper to get mapping for a slot
  const getMappingForSlot = (slotId: string) => {
    const slot = AMP_MODEL_SLOTS.find((s) => s.id === slotId);
    if (!slot) return null;
    const mappings = config().ampModelMappings || [];
    return mappings.find((m) => m.from === slot.fromModel);
  };

  // Update mapping for a slot
  const updateSlotMapping = async (
    slotId: string,
    toModel: string,
    enabled: boolean,
  ) => {
    const slot = AMP_MODEL_SLOTS.find((s) => s.id === slotId);
    if (!slot) return;

    const currentMappings = config().ampModelMappings || [];
    // Remove existing mapping for this slot
    const filteredMappings = currentMappings.filter(
      (m) => m.from !== slot.fromModel,
    );

    // Add new mapping if enabled and has a target
    let newMappings: AmpModelMapping[];
    if (enabled && toModel) {
      newMappings = [
        ...filteredMappings,
        { from: slot.fromModel, to: toModel, enabled: true },
      ];
    } else {
      newMappings = filteredMappings;
    }

    const newConfig = { ...config(), ampModelMappings: newMappings };
    setConfig(newConfig);

    setSaving(true);
    try {
      await saveConfig(newConfig);
      toastStore.success("Model mapping updated");
    } catch (error) {
      console.error("Failed to save config:", error);
      toastStore.error("Failed to save settings", String(error));
    } finally {
      setSaving(false);
    }
  };

  // Get custom mappings (mappings that are not in predefined slots)
  const getCustomMappings = () => {
    const mappings = config().ampModelMappings || [];
    const slotFromModels = new Set(AMP_MODEL_SLOTS.map((s) => s.fromModel));
    return mappings.filter((m) => !slotFromModels.has(m.from));
  };

  // Add a custom mapping
  const addCustomMapping = async () => {
    const from = newMappingFrom().trim();
    const to = newMappingTo().trim();

    if (!from || !to) {
      toastStore.error("Both 'from' and 'to' models are required");
      return;
    }

    // Check for duplicates
    const existingMappings = config().ampModelMappings || [];
    if (existingMappings.some((m) => m.from === from)) {
      toastStore.error(`A mapping for '${from}' already exists`);
      return;
    }

    const newMapping: AmpModelMapping = { from, to, enabled: true };
    const newMappings = [...existingMappings, newMapping];

    const newConfig = { ...config(), ampModelMappings: newMappings };
    setConfig(newConfig);

    setSaving(true);
    try {
      await saveConfig(newConfig);
      toastStore.success("Custom mapping added");
      setNewMappingFrom("");
      setNewMappingTo("");
    } catch (error) {
      console.error("Failed to save config:", error);
      toastStore.error("Failed to save settings", String(error));
    } finally {
      setSaving(false);
    }
  };

  // Remove a custom mapping
  const removeCustomMapping = async (fromModel: string) => {
    const currentMappings = config().ampModelMappings || [];
    const newMappings = currentMappings.filter((m) => m.from !== fromModel);

    const newConfig = { ...config(), ampModelMappings: newMappings };
    setConfig(newConfig);

    setSaving(true);
    try {
      await saveConfig(newConfig);
      toastStore.success("Custom mapping removed");
    } catch (error) {
      console.error("Failed to save config:", error);
      toastStore.error("Failed to save settings", String(error));
    } finally {
      setSaving(false);
    }
  };

  // Update an existing custom mapping
  const updateCustomMapping = async (
    fromModel: string,
    newToModel: string,
    enabled: boolean,
  ) => {
    const currentMappings = config().ampModelMappings || [];
    const newMappings = currentMappings.map((m) =>
      m.from === fromModel ? { ...m, to: newToModel, enabled } : m,
    );

    const newConfig = { ...config(), ampModelMappings: newMappings };
    setConfig(newConfig);

    setSaving(true);
    try {
      await saveConfig(newConfig);
      toastStore.success("Mapping updated");
    } catch (error) {
      console.error("Failed to save config:", error);
      toastStore.error("Failed to save settings", String(error));
    } finally {
      setSaving(false);
    }
  };

  // Built-in models organized by provider
  // These are models available through CLIProxyAPI's standard providers
  const BUILTIN_MODELS = {
    anthropic: [
      { value: "claude-opus-4-5-20250514", label: "Claude Opus 4.5" },
      { value: "claude-sonnet-4-5-20250514", label: "Claude Sonnet 4.5" },
      { value: "claude-haiku-4-5-20250514", label: "Claude Haiku 4.5" },
      { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
      { value: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet" },
      { value: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku" },
    ],
    google: [
      { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
      { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
      { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
      {
        value: "gemini-2.0-flash-thinking-exp",
        label: "Gemini 2.0 Flash Thinking",
      },
      { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
      { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
    ],
    openai: [
      { value: "gpt-5.1", label: "GPT-5.1" },
      { value: "gpt-5.1-mini", label: "GPT-5.1 Mini" },
      { value: "gpt-4.1", label: "GPT-4.1" },
      { value: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
      { value: "gpt-4o", label: "GPT-4o" },
      { value: "gpt-4o-mini", label: "GPT-4o Mini" },
      { value: "o3", label: "o3" },
      { value: "o3-mini", label: "o3 Mini" },
      { value: "o4-mini", label: "o4 Mini" },
    ],
    qwen: [
      { value: "qwen3-235b-a22b", label: "Qwen3 235B" },
      { value: "qwen3-32b", label: "Qwen3 32B" },
      { value: "qwen-coder-plus", label: "Qwen Coder Plus" },
      { value: "qwen-plus", label: "Qwen Plus" },
    ],
  };

  // Get list of available target models (from OpenAI provider aliases + built-in models)
  const getAvailableTargetModels = () => {
    const customModels: { value: string; label: string }[] = [];

    // Add models from custom OpenAI provider aliases
    const provider = config().ampOpenaiProvider;
    if (provider?.models) {
      for (const model of provider.models) {
        if (model.alias) {
          customModels.push({
            value: model.alias,
            label: `${model.alias} (${provider.name})`,
          });
        } else {
          customModels.push({
            value: model.name,
            label: `${model.name} (${provider.name})`,
          });
        }
      }
    }

    return { customModels, builtInModels: BUILTIN_MODELS };
  };

  const handleConfigChange = async (
    key: keyof ReturnType<typeof config>,
    value: boolean | number | string,
  ) => {
    const newConfig = { ...config(), [key]: value };
    setConfig(newConfig);

    // Auto-save config
    setSaving(true);
    try {
      await saveConfig(newConfig);
      toastStore.success("Settings saved");
    } catch (error) {
      console.error("Failed to save config:", error);
      toastStore.error("Failed to save settings", String(error));
    } finally {
      setSaving(false);
    }
  };

  const connectedCount = () => {
    const auth = authStatus();
    return [auth.claude, auth.openai, auth.gemini, auth.qwen].filter(Boolean)
      .length;
  };

  const addProviderModel = () => {
    const name = newModelName().trim();
    const alias = newModelAlias().trim();
    if (!name) {
      toastStore.error("Model name is required");
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
      toastStore.error("Provider name, base URL, and API key are required");
      return;
    }

    const provider: AmpOpenAIProvider = {
      name,
      baseUrl,
      apiKey,
      models: providerModels(),
    };

    const newConfig = { ...config(), ampOpenaiProvider: provider };
    setConfig(newConfig);

    setSaving(true);
    try {
      await saveConfig(newConfig);
      toastStore.success("OpenAI provider configuration saved");
    } catch (error) {
      console.error("Failed to save config:", error);
      toastStore.error("Failed to save settings", String(error));
    } finally {
      setSaving(false);
    }
  };

  const clearOpenAIProvider = async () => {
    setProviderName("");
    setProviderBaseUrl("");
    setProviderApiKey("");
    setProviderModels([]);

    const newConfig = { ...config(), ampOpenaiProvider: undefined };
    setConfig(newConfig);

    setSaving(true);
    try {
      await saveConfig(newConfig);
      toastStore.success("OpenAI provider configuration cleared");
    } catch (error) {
      console.error("Failed to save config:", error);
      toastStore.error("Failed to save settings", String(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div class="min-h-screen flex flex-col">
      {/* Header */}
      <header class="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-800">
        <div class="flex items-center gap-2 sm:gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentPage("dashboard")}
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
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </Button>
          <h1 class="font-bold text-lg text-gray-900 dark:text-gray-100">
            Settings
          </h1>
          {saving() && (
            <span class="text-xs text-gray-400 ml-2 flex items-center gap-1">
              <svg class="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
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
              Saving
            </span>
          )}
        </div>
      </header>

      {/* Main content */}
      <main class="flex-1 p-4 sm:p-6 overflow-y-auto">
        <div class="max-w-xl mx-auto space-y-4 sm:space-y-6 animate-stagger">
          {/* General settings */}
          <div class="space-y-4">
            <h2 class="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
              General
            </h2>

            <div class="space-y-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
              <Switch
                label="Launch at login"
                description="Start ProxyPal automatically when you log in"
                checked={config().launchAtLogin}
                onChange={(checked) =>
                  handleConfigChange("launchAtLogin", checked)
                }
              />

              <div class="border-t border-gray-200 dark:border-gray-700" />

              <Switch
                label="Auto-start proxy"
                description="Start the proxy server when ProxyPal launches"
                checked={config().autoStart}
                onChange={(checked) => handleConfigChange("autoStart", checked)}
              />
            </div>
          </div>

          {/* Proxy settings */}
          <div class="space-y-4">
            <h2 class="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
              Proxy Configuration
            </h2>

            <div class="space-y-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
              <label class="block">
                <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Port
                </span>
                <input
                  type="number"
                  value={config().port}
                  onInput={(e) =>
                    handleConfigChange(
                      "port",
                      parseInt(e.currentTarget.value) || 8317,
                    )
                  }
                  class="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-smooth"
                  min="1024"
                  max="65535"
                />
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  The port where the proxy server will listen (default: 8317)
                </p>
              </label>

              <div class="border-t border-gray-200 dark:border-gray-700" />

              <label class="block">
                <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Upstream Proxy URL
                </span>
                <input
                  type="text"
                  value={config().proxyUrl}
                  onInput={(e) =>
                    handleConfigChange("proxyUrl", e.currentTarget.value)
                  }
                  placeholder="socks5://127.0.0.1:1080"
                  class="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-smooth"
                />
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Optional SOCKS5/HTTP proxy for outbound requests (e.g.
                  socks5://host:port)
                </p>
              </label>

              <div class="border-t border-gray-200 dark:border-gray-700" />

              <label class="block">
                <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Request Retry Count
                </span>
                <input
                  type="number"
                  value={config().requestRetry}
                  onInput={(e) =>
                    handleConfigChange(
                      "requestRetry",
                      Math.max(
                        0,
                        Math.min(10, parseInt(e.currentTarget.value) || 0),
                      ),
                    )
                  }
                  class="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-smooth"
                  min="0"
                  max="10"
                />
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Number of retries on 403, 408, 500, 502, 503, 504 errors
                  (0-10)
                </p>
              </label>
            </div>
          </div>

          {/* Amp CLI Integration */}
          <div class="space-y-4">
            <h2 class="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
              Amp CLI Integration
            </h2>

            <div class="space-y-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
              <label class="block">
                <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Amp API Key
                </span>
                <input
                  type="password"
                  value={config().ampApiKey || ""}
                  onInput={(e) =>
                    handleConfigChange("ampApiKey", e.currentTarget.value)
                  }
                  placeholder="amp_..."
                  class="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-smooth font-mono"
                />
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Get your API key from{" "}
                  <a
                    href="https://ampcode.com/settings"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-brand-500 hover:text-brand-600 underline"
                  >
                    ampcode.com/settings
                  </a>
                  . Required for Amp CLI to authenticate through the proxy.
                </p>
              </label>

              <div class="border-t border-gray-200 dark:border-gray-700" />

              {/* Model Mappings */}
              <div class="space-y-3">
                <div>
                  <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Model Mappings
                  </span>
                  <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    Route Amp model requests to different providers
                  </p>
                </div>

                {/* Slot-based mappings */}
                <div class="space-y-2">
                  <For each={AMP_MODEL_SLOTS}>
                    {(slot) => {
                      const mapping = () => getMappingForSlot(slot.id);
                      const isEnabled = () => !!mapping();
                      const currentTarget = () => mapping()?.to || "";

                      return (
                        <div class="flex items-center gap-3 p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                          {/* Checkbox */}
                          <input
                            type="checkbox"
                            checked={isEnabled()}
                            onChange={(e) => {
                              const checked = e.currentTarget.checked;
                              if (checked) {
                                // Enable with first available target or same model
                                const { customModels, builtInModels } =
                                  getAvailableTargetModels();
                                const defaultTarget =
                                  customModels[0]?.value ||
                                  builtInModels.google[0]?.value ||
                                  slot.fromModel;
                                updateSlotMapping(slot.id, defaultTarget, true);
                              } else {
                                updateSlotMapping(slot.id, "", false);
                              }
                            }}
                            class="w-4 h-4 text-brand-500 bg-gray-100 border-gray-300 rounded focus:ring-brand-500 dark:focus:ring-brand-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                          />

                          {/* Slot name */}
                          <span class="w-16 text-sm font-medium text-gray-700 dark:text-gray-300">
                            {slot.name}
                          </span>

                          {/* From model (readonly) */}
                          <div class="flex-1 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-400">
                            {slot.fromLabel}
                          </div>

                          {/* Arrow */}
                          <span class="text-gray-400 text-sm">TO</span>

                          {/* To model (dropdown) - organized by provider */}
                          {(() => {
                            const { customModels, builtInModels } =
                              getAvailableTargetModels();
                            return (
                              <select
                                value={currentTarget()}
                                onChange={(e) => {
                                  const newTarget = e.currentTarget.value;
                                  updateSlotMapping(slot.id, newTarget, true);
                                }}
                                disabled={!isEnabled()}
                                class={`flex-1 px-3 py-1.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-smooth ${
                                  !isEnabled()
                                    ? "opacity-50 cursor-not-allowed"
                                    : ""
                                }`}
                              >
                                <option value="">Select target model...</option>
                                <Show when={customModels.length > 0}>
                                  <optgroup label="Custom Provider">
                                    <For each={customModels}>
                                      {(model) => (
                                        <option value={model.value}>
                                          {model.label}
                                        </option>
                                      )}
                                    </For>
                                  </optgroup>
                                </Show>
                                <optgroup label="Anthropic">
                                  <For each={builtInModels.anthropic}>
                                    {(model) => (
                                      <option value={model.value}>
                                        {model.label}
                                      </option>
                                    )}
                                  </For>
                                </optgroup>
                                <optgroup label="Google">
                                  <For each={builtInModels.google}>
                                    {(model) => (
                                      <option value={model.value}>
                                        {model.label}
                                      </option>
                                    )}
                                  </For>
                                </optgroup>
                                <optgroup label="OpenAI">
                                  <For each={builtInModels.openai}>
                                    {(model) => (
                                      <option value={model.value}>
                                        {model.label}
                                      </option>
                                    )}
                                  </For>
                                </optgroup>
                                <optgroup label="Qwen">
                                  <For each={builtInModels.qwen}>
                                    {(model) => (
                                      <option value={model.value}>
                                        {model.label}
                                      </option>
                                    )}
                                  </For>
                                </optgroup>
                              </select>
                            );
                          })()}
                        </div>
                      );
                    }}
                  </For>
                </div>

                {/* Custom Mappings Section */}
                <div class="pt-2">
                  <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    Custom model mappings (for models not in predefined slots)
                  </p>

                  {/* Existing custom mappings */}
                  <For each={getCustomMappings()}>
                    {(mapping) => {
                      const { customModels, builtInModels } =
                        getAvailableTargetModels();
                      return (
                        <div class="flex items-center gap-3 p-3 mb-2 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                          {/* Checkbox */}
                          <input
                            type="checkbox"
                            checked={mapping.enabled !== false}
                            onChange={(e) => {
                              updateCustomMapping(
                                mapping.from,
                                mapping.to,
                                e.currentTarget.checked,
                              );
                            }}
                            class="w-4 h-4 text-brand-500 bg-gray-100 border-gray-300 rounded focus:ring-brand-500 dark:focus:ring-brand-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                          />

                          {/* From model (readonly) */}
                          <div class="flex-1 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-400 font-mono truncate">
                            {mapping.from}
                          </div>

                          {/* Arrow */}
                          <span class="text-gray-400 text-sm">TO</span>

                          {/* To model (dropdown) */}
                          <select
                            value={mapping.to}
                            onChange={(e) => {
                              updateCustomMapping(
                                mapping.from,
                                e.currentTarget.value,
                                mapping.enabled !== false,
                              );
                            }}
                            disabled={mapping.enabled === false}
                            class={`flex-1 px-3 py-1.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-smooth ${
                              mapping.enabled === false
                                ? "opacity-50 cursor-not-allowed"
                                : ""
                            }`}
                          >
                            <option value="">Select target model...</option>
                            <Show when={customModels.length > 0}>
                              <optgroup label="Custom Provider">
                                <For each={customModels}>
                                  {(model) => (
                                    <option value={model.value}>
                                      {model.label}
                                    </option>
                                  )}
                                </For>
                              </optgroup>
                            </Show>
                            <optgroup label="Anthropic">
                              <For each={builtInModels.anthropic}>
                                {(model) => (
                                  <option value={model.value}>
                                    {model.label}
                                  </option>
                                )}
                              </For>
                            </optgroup>
                            <optgroup label="Google">
                              <For each={builtInModels.google}>
                                {(model) => (
                                  <option value={model.value}>
                                    {model.label}
                                  </option>
                                )}
                              </For>
                            </optgroup>
                            <optgroup label="OpenAI">
                              <For each={builtInModels.openai}>
                                {(model) => (
                                  <option value={model.value}>
                                    {model.label}
                                  </option>
                                )}
                              </For>
                            </optgroup>
                            <optgroup label="Qwen">
                              <For each={builtInModels.qwen}>
                                {(model) => (
                                  <option value={model.value}>
                                    {model.label}
                                  </option>
                                )}
                              </For>
                            </optgroup>
                          </select>

                          {/* Delete button */}
                          <button
                            type="button"
                            onClick={() => removeCustomMapping(mapping.from)}
                            class="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                            title="Remove mapping"
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
                      );
                    }}
                  </For>

                  {/* Add new custom mapping */}
                  <div class="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-dashed border-gray-300 dark:border-gray-600">
                    <input
                      type="text"
                      value={newMappingFrom()}
                      onInput={(e) => setNewMappingFrom(e.currentTarget.value)}
                      placeholder="From model (e.g. my-custom-model)"
                      class="flex-1 px-2 py-1.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-xs font-mono focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-smooth"
                    />
                    <span class="text-gray-400 text-xs">TO</span>
                    {(() => {
                      const { customModels, builtInModels } =
                        getAvailableTargetModels();
                      return (
                        <select
                          value={newMappingTo()}
                          onChange={(e) =>
                            setNewMappingTo(e.currentTarget.value)
                          }
                          class="flex-1 px-2 py-1.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-smooth"
                        >
                          <option value="">Select target...</option>
                          <Show when={customModels.length > 0}>
                            <optgroup label="Custom Provider">
                              <For each={customModels}>
                                {(model) => (
                                  <option value={model.value}>
                                    {model.label}
                                  </option>
                                )}
                              </For>
                            </optgroup>
                          </Show>
                          <optgroup label="Anthropic">
                            <For each={builtInModels.anthropic}>
                              {(model) => (
                                <option value={model.value}>
                                  {model.label}
                                </option>
                              )}
                            </For>
                          </optgroup>
                          <optgroup label="Google">
                            <For each={builtInModels.google}>
                              {(model) => (
                                <option value={model.value}>
                                  {model.label}
                                </option>
                              )}
                            </For>
                          </optgroup>
                          <optgroup label="OpenAI">
                            <For each={builtInModels.openai}>
                              {(model) => (
                                <option value={model.value}>
                                  {model.label}
                                </option>
                              )}
                            </For>
                          </optgroup>
                          <optgroup label="Qwen">
                            <For each={builtInModels.qwen}>
                              {(model) => (
                                <option value={model.value}>
                                  {model.label}
                                </option>
                              )}
                            </For>
                          </optgroup>
                        </select>
                      );
                    })()}
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={addCustomMapping}
                      disabled={
                        !newMappingFrom().trim() || !newMappingTo().trim()
                      }
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
              </div>

              <div class="border-t border-gray-200 dark:border-gray-700" />

              {/* Custom OpenAI-Compatible Provider */}
              <div class="space-y-4">
                <div>
                  <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Custom OpenAI-Compatible Provider
                  </span>
                  <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    Add a provider (e.g., ZenMux, OpenRouter) whose model
                    aliases can be used as mapping targets above
                  </p>
                </div>

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
                    class="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-smooth"
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
                    class="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-mono focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-smooth"
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
                    class="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-mono focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-smooth"
                  />
                </label>

                {/* Models */}
                <div class="space-y-2">
                  <span class="text-xs font-medium text-gray-600 dark:text-gray-400">
                    Model Aliases (map Amp model names to provider model names)
                  </span>

                  {/* Existing models */}
                  <For each={providerModels()}>
                    {(model, index) => (
                      <div class="flex items-center gap-2 p-2 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
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
                      placeholder="Provider model (e.g. anthropic/claude-opus-4.5)"
                      class="flex-1 px-2 py-1.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-xs font-mono focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-smooth"
                    />
                    <input
                      type="text"
                      value={newModelAlias()}
                      onInput={(e) => setNewModelAlias(e.currentTarget.value)}
                      placeholder="Alias (e.g. claude-opus-4-5-20251101)"
                      class="flex-1 px-2 py-1.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-xs font-mono focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-smooth"
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

                {/* Save / Clear / Test buttons */}
                <div class="flex flex-wrap gap-2 pt-2">
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
                    Save Provider
                  </Button>
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
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearOpenAIProvider}
                  >
                    Clear
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

              <p class="text-xs text-gray-400 dark:text-gray-500">
                After changing settings, restart the proxy for changes to take
                effect.
              </p>
            </div>
          </div>

          {/* Advanced Settings */}
          <div class="space-y-4">
            <h2 class="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
              Advanced Settings
            </h2>

            <div class="space-y-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
              <Switch
                label="Debug Mode"
                description="Enable verbose logging for troubleshooting"
                checked={config().debug}
                onChange={(checked) => handleConfigChange("debug", checked)}
              />

              <div class="border-t border-gray-200 dark:border-gray-700" />

              <Switch
                label="Usage Statistics"
                description="Track request counts and token usage"
                checked={config().usageStatsEnabled}
                onChange={(checked) =>
                  handleConfigChange("usageStatsEnabled", checked)
                }
              />

              <div class="border-t border-gray-200 dark:border-gray-700" />

              <Switch
                label="Request Logging"
                description="Log all API requests for debugging"
                checked={config().requestLogging}
                onChange={(checked) =>
                  handleConfigChange("requestLogging", checked)
                }
              />

              <div class="border-t border-gray-200 dark:border-gray-700" />

              <Switch
                label="Log to File"
                description="Write logs to rotating files instead of stdout"
                checked={config().loggingToFile}
                onChange={(checked) =>
                  handleConfigChange("loggingToFile", checked)
                }
              />
            </div>
          </div>

          {/* Quota Exceeded Behavior */}
          <div class="space-y-4">
            <h2 class="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
              Quota Exceeded Behavior
            </h2>

            <div class="space-y-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
              <Switch
                label="Auto-switch Project"
                description="Automatically switch to another project when quota is exceeded"
                checked={config().quotaSwitchProject}
                onChange={(checked) =>
                  handleConfigChange("quotaSwitchProject", checked)
                }
              />

              <div class="border-t border-gray-200 dark:border-gray-700" />

              <Switch
                label="Switch to Preview Model"
                description="Fall back to preview/beta models when quota is exceeded"
                checked={config().quotaSwitchPreviewModel}
                onChange={(checked) =>
                  handleConfigChange("quotaSwitchPreviewModel", checked)
                }
              />
            </div>
          </div>

          {/* Accounts */}
          <div class="space-y-4">
            <h2 class="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
              Connected Accounts
            </h2>

            <div class="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {connectedCount()} of 4 providers connected
                  </p>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Manage your AI provider connections
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setCurrentPage("dashboard")}
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
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                  Manage
                </Button>
              </div>
            </div>
          </div>

          {/* API Keys */}
          <div class="space-y-4">
            <h2 class="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
              API Keys
            </h2>

            <div class="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Manage API Keys
                  </p>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Add Gemini, Claude, Codex, or OpenAI-compatible API keys
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setCurrentPage("api-keys")}
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
                      d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                    />
                  </svg>
                  Configure
                </Button>
              </div>
            </div>
          </div>

          {/* Auth Files */}
          <div class="space-y-4">
            <h2 class="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
              Auth Files
            </h2>

            <div class="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Manage Auth Files
                  </p>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Upload, enable, or remove OAuth credential files
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setCurrentPage("auth-files")}
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
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  Manage
                </Button>
              </div>
            </div>
          </div>

          {/* Logs */}
          <div class="space-y-4">
            <h2 class="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
              Logs
            </h2>

            <div class="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm font-medium text-gray-700 dark:text-gray-300">
                    View Logs
                  </p>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Live proxy server logs with filtering
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setCurrentPage("logs")}
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
                      d="M4 6h16M4 12h16M4 18h7"
                    />
                  </svg>
                  View
                </Button>
              </div>
            </div>
          </div>

          {/* Analytics */}
          <div class="space-y-4">
            <h2 class="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
              Analytics
            </h2>

            <div class="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Usage Analytics
                  </p>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    View request and token usage trends with charts
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setCurrentPage("analytics")}
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
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                  View
                </Button>
              </div>
            </div>
          </div>

          {/* About */}
          <div class="space-y-4">
            <h2 class="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
              About
            </h2>

            <div class="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-center">
              <div class="w-12 h-12 mx-auto rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center mb-3">
                <span class="text-white text-2xl">⚡</span>
              </div>
              <h3 class="font-bold text-gray-900 dark:text-gray-100">
                ProxyPal
              </h3>
              <p class="text-sm text-gray-500 dark:text-gray-400">
                Version 0.1.0
              </p>
              <p class="text-xs text-gray-400 dark:text-gray-500 mt-2">
                Built with Tauri, SolidJS, and TailwindCSS
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
