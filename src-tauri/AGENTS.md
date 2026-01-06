# Backend Guidelines (Rust + Tauri)

## Commands

- Use `#[tauri::command]` for all IPC functions.
- Return `Result<T, String>` for error propagation to frontend.
- Access shared state via `State<AppState>`.

```rust
#[tauri::command]
pub fn get_status(state: State<AppState>) -> Result<Status, String> {
    let status = state.status.lock().map_err(|e| e.to_string())?;
    Ok(status.clone())
}
```

## State Management

- Shared state lives in `AppState` (`state.rs`).
- Use `Mutex<T>` for interior mutability.
- Use `Arc<AtomicBool>` for simple flags (e.g., `should_stop`).
- Always handle mutex poisoning gracefully with `map_err`.

## Serialization

- IPC types live in `src/types/*.rs`.
- Derive `Serialize, Deserialize` for all IPC structs.
- Use `#[serde(rename_all = "camelCase")]` for frontend compatibility.

```rust
#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProxyStatus {
    pub running: bool,
    pub port: u16,
    pub endpoint: String,
}
```

## Config

- Config schema is in `config.rs` (`AppConfig`).
- All new fields need defaults and migration logic.
- Config is stored in platform config dir as YAML.

## Process Management

- Long-running processes (SSH, Cloudflare) are managed by dedicated managers.
- Use `tokio::process::Command` for async subprocess spawning.
- Emit status via Tauri events (`ssh-status-changed`, `cloudflare-status-changed`).
- Use non-interactive options for SSH (`BatchMode=yes`, `ExitOnForwardFailure=yes`).

## Logging

- Use `eprintln!` with clear prefixes: `[ProxyPal Debug]`, `[Migration]`, `[SSH]`.

## Boundaries

✅ **Always**: Handle `Result` with `map_err`, use camelCase for IPC types.
⚠️ **Ask first**: New Tauri plugins, `AppConfig` schema changes, new IPC types.
🚫 **Never**: Block async tasks with sync IO, use `unwrap()` on user-facing state, ignore mutex errors.
