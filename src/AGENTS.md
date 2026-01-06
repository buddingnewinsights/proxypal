# Frontend Guidelines (SolidJS + TypeScript)

## Reactivity

- Use `createSignal` for local state, `createMemo` for derived values.
- Use `createEffect` sparingly; prefer reactive derivations.
- Use `splitProps` to separate component-specific props from pass-through props.

```tsx
const [local, others] = splitProps(props, ["variant", "class"]);
```

## Components

- Functional components only.
- Define `interface Props` directly above the component.
- Use `JSX.HTMLAttributes<T>` for extending native element props.

```tsx
interface StatusProps {
  status: "online" | "offline";
  label?: string;
}

export function StatusIndicator(props: StatusProps) {
  return <span class={`status-${props.status}`}>{props.label}</span>;
}
```

## Stores

- Centralized state lives in `stores/` (e.g., `appStore`, `requestStore`, `themeStore`).
- Use `createRoot` for global reactive stores.
- Access stores directly; don't prop-drill deeply.

## Styling

- Use Tailwind CSS with `class` (NOT `className`).
- Preserve existing card/badge patterns from `components/ui/`.
- Use conditional classes via template literals or `classList`.

## Imports

Order: External libs -> Internal aliases (`../lib`, `../stores`) -> Relative (`./ui`).

```tsx
import { createSignal } from "solid-js";
import type { AuthStatus } from "../lib/tauri";
import { getAuthStatus } from "../lib/tauri";
import { Button } from "./ui/Button";
```

## Error Handling

- Surface errors via `toastStore.error(message)`.
- Never swallow errors silently in async flows.

## Boundaries

✅ **Always**: Use `createMemo` for derived state, `splitProps` in components.
⚠️ **Ask first**: Changing global store structure in `stores/`.
🚫 **Never**: Use `className`, perform heavy computation in JSX, mutate signals directly.
