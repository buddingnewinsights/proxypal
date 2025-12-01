import { createSignal, createEffect, onCleanup, For, Show } from "solid-js";
import { appStore } from "../stores/app";
import { toastStore } from "../stores/toast";
import { startProxy, stopProxy } from "../lib/tauri";

interface Command {
  id: string;
  label: string;
  shortcut?: string;
  icon: string;
  action: () => void;
  category: "proxy" | "navigation" | "providers";
}

// Export signal for external control
const [isOpen, setIsOpen] = createSignal(false);

export function openCommandPalette() {
  setIsOpen(true);
}

export function CommandPalette() {
  const [search, setSearch] = createSignal("");
  const [selectedIndex, setSelectedIndex] = createSignal(0);

  const { proxyStatus, setProxyStatus, setCurrentPage } = appStore;

  // Define commands
  const commands = (): Command[] => [
    {
      id: "toggle-proxy",
      label: proxyStatus().running ? "Stop Proxy" : "Start Proxy",
      shortcut: "⌘S",
      icon: proxyStatus().running ? "stop" : "play",
      category: "proxy",
      action: async () => {
        try {
          if (proxyStatus().running) {
            const status = await stopProxy();
            setProxyStatus(status);
            toastStore.info("Proxy stopped");
          } else {
            const status = await startProxy();
            setProxyStatus(status);
            toastStore.success("Proxy started");
          }
        } catch (error) {
          toastStore.error("Failed to toggle proxy", String(error));
        }
        setIsOpen(false);
      },
    },
    {
      id: "go-dashboard",
      label: "Go to Dashboard",
      shortcut: "⌘1",
      icon: "home",
      category: "navigation",
      action: () => {
        setCurrentPage("dashboard");
        setIsOpen(false);
      },
    },
    {
      id: "go-settings",
      label: "Go to Settings",
      shortcut: "⌘,",
      icon: "settings",
      category: "navigation",
      action: () => {
        setCurrentPage("settings");
        setIsOpen(false);
      },
    },
    {
      id: "copy-endpoint",
      label: "Copy API Endpoint",
      icon: "copy",
      category: "proxy",
      action: () => {
        navigator.clipboard.writeText(proxyStatus().endpoint);
        toastStore.success("Copied to clipboard!");
        setIsOpen(false);
      },
    },
  ];

  // Filter commands based on search
  const filteredCommands = () => {
    const q = search().toLowerCase();
    if (!q) return commands();
    return commands().filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(q) ||
        cmd.category.toLowerCase().includes(q),
    );
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: KeyboardEvent) => {
    // Open palette with Cmd+K
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      setIsOpen(true);
      setSearch("");
      setSelectedIndex(0);
      return;
    }

    // Global shortcuts (work even when palette is closed)
    if (e.metaKey || e.ctrlKey) {
      switch (e.key) {
        case "s":
          e.preventDefault();
          commands()
            .find((c) => c.id === "toggle-proxy")
            ?.action();
          break;
        case ",":
          e.preventDefault();
          setCurrentPage("settings");
          break;
        case "1":
          e.preventDefault();
          setCurrentPage("dashboard");
          break;
      }
    }

    // Palette-specific navigation
    if (!isOpen()) return;

    switch (e.key) {
      case "Escape":
        setIsOpen(false);
        break;
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filteredCommands().length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        const cmd = filteredCommands()[selectedIndex()];
        if (cmd) cmd.action();
        break;
    }
  };

  // Reset selection when search changes
  createEffect(() => {
    search();
    setSelectedIndex(0);
  });

  // Global keyboard listener
  createEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  const getIcon = (icon: string) => {
    switch (icon) {
      case "play":
        return (
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
              d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
            />
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
      case "stop":
        return (
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
              d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
            />
          </svg>
        );
      case "home":
        return (
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
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
        );
      case "settings":
        return (
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
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        );
      case "copy":
        return (
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
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <Show when={isOpen()}>
      {/* Backdrop */}
      <div
        class="fixed inset-0 bg-black/50 z-50 animate-fade-in"
        onClick={() => setIsOpen(false)}
      />

      {/* Modal */}
      <div class="fixed inset-x-4 top-[20%] z-50 mx-auto max-w-lg animate-scale-in">
        <div class="bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Search input */}
          <div class="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <svg
              class="w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Type a command or search..."
              class="flex-1 bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 outline-none text-sm"
              value={search()}
              onInput={(e) => setSearch(e.currentTarget.value)}
              autofocus
            />
            <kbd class="hidden sm:inline-flex px-2 py-1 text-xs font-medium text-gray-400 bg-gray-100 dark:bg-gray-800 rounded">
              esc
            </kbd>
          </div>

          {/* Commands list */}
          <div class="max-h-72 overflow-y-auto py-2">
            <Show
              when={filteredCommands().length > 0}
              fallback={
                <div class="px-4 py-8 text-center text-sm text-gray-500">
                  No commands found
                </div>
              }
            >
              <For each={filteredCommands()}>
                {(cmd, index) => (
                  <button
                    class={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      selectedIndex() === index()
                        ? "bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                    }`}
                    onClick={() => cmd.action()}
                    onMouseEnter={() => setSelectedIndex(index())}
                  >
                    <span class="text-gray-400">{getIcon(cmd.icon)}</span>
                    <span class="flex-1 text-sm font-medium">{cmd.label}</span>
                    {cmd.shortcut && (
                      <kbd class="px-2 py-0.5 text-xs font-medium text-gray-400 bg-gray-100 dark:bg-gray-800 rounded">
                        {cmd.shortcut}
                      </kbd>
                    )}
                  </button>
                )}
              </For>
            </Show>
          </div>

          {/* Footer hint */}
          <div class="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <div class="flex items-center gap-4 text-xs text-gray-500">
              <span class="flex items-center gap-1">
                <kbd class="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">
                  ↑↓
                </kbd>
                navigate
              </span>
              <span class="flex items-center gap-1">
                <kbd class="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">
                  ↵
                </kbd>
                select
              </span>
              <span class="flex items-center gap-1">
                <kbd class="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">
                  esc
                </kbd>
                close
              </span>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}
