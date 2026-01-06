# ProxyPal Development Guidelines

## Commands

- **Dev**: `pnpm tauri dev`
- **Type check**: `pnpm tsc --noEmit`
- **Rust check**: `cd src-tauri && cargo check`

## Code Style

### TypeScript (Frontend - SolidJS)

- **Components**: Functional components with `interface Props` directly above.
- **Reactivity**: Use `createSignal`, `createMemo`, and `splitProps` for clean prop handling.
- **Tailwind**: Use `class` instead of `className`.
- **Imports**: External -> Internal Aliases (`../lib`, `../stores`) -> Relative.

```tsx
interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
}

export function Button(props: ButtonProps) {
  const [local, others] = splitProps(props, ["variant", "class", "children"]);
  return (
    <button class={`btn-${local.variant} ${local.class}`} {...others}>
      {local.children}
    </button>
  );
}
```

### Rust (Backend - Tauri)

- **Commands**: Return `Result<T, String>` for error propagation.
- **State**: Access via `State<AppState>`, handle mutex locking gracefully.
- **JSON**: Use `#[serde(rename_all = "camelCase")]` for frontend compatibility.

```rust
#[tauri::command]
pub fn save_config(state: State<AppState>, config: AppConfig) -> Result<(), String> {
    let mut current_config = state.config.lock().unwrap();
    *current_config = config;
    save_config_to_file(&current_config)?;
    Ok(())
}
```

## Boundaries

✅ **Always**:

- Run `pnpm tsc --noEmit` and `cargo check` before claiming a task is done.
- Use `bd sync` after creating or closing issues.
- Preserve existing Tailwind styling patterns for cards and badges.

⚠️ **Ask first**:

- Adding new external dependencies.
- Modifying `AppConfig` schema or global state structure.
- Changing CLIProxyAPI lifecycle management logic.

🚫 **Never**:

- Commit secrets or `.env` files.
- Use blocking IO in async Rust tasks without `spawn_blocking`.
- Modify `dist/` or `src-tauri/target/` directories manually.

## Beads Workflow

1. **Claim**: `bd update <id> --status in_progress`
2. **Work**: Implement change -> `git add` -> `bd sync`
3. **Finish**: `bd close <id> --reason "..."` -> `bd sync` -> `git commit` -> `git push`

---

_Refer to .opencode/memory/ for detailed architecture and conventions._
