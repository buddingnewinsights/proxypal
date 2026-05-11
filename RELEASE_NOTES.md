# ProxyPal v0.4.34

**Released:** 2026-05-12

## Sidecar Upgrade: CLIProxyAPI v6.10.8 → v7.0.2

This release upgrades the bundled CLIProxyAPI sidecar from **v6.10.8** (built May 4, 2026) to **v7.0.2** (released May 10, 2026), jumping 4 releases including a major version bump.

### Why this matters

The bundled sidecar was 12 days stale while upstream ships daily. v7.0.2 has been battle-tested (2,677+ downloads on linux_amd64 alone) with 2 patch releases on top of v7.0.0.

### What changed in CLIProxyAPI (v6.10.9 → v7.0.2)

**Stability fixes (v6.10.9 → v7.0.2):**
- Codex WebSocket upstream disconnect handling (prevents zombie sessions)
- Amp thread actors route fix
- OpenAI → Kimi continuous function_call conversion fix
- OpenAI streaming: null usage chunks now ignored, empty responses stream repaired
- Claude OAuth refresh 429 backoff deduplication
- Gemini CLI project ID from onboarding response
- Goroutine leak prevention in streaming executors
- Antigravity cancellation error preservation

**New v7 features (available for future ProxyPal integration):**
- Remote home control plane config loading (multi-device sync potential)
- Per-auth `disable_cooling` override support
- `disabled` flag persistence in token storage (survives restarts)
- Home auth dispatch usage statistics
- Home request-log forwarding
- WebSocket session reuse for home auths with caching (v7.0.1)
- Detailed logging for home config changes (v7.0.2)

**Breaking change in v7.0.0 (no impact on ProxyPal):**
- Removed `ClaudeCodeSessionAffinity` — **ProxyPal does not reference this, zero impact verified**

### ProxyPal code changes
- `src-tauri/binaries/cli-proxy-api-aarch64-apple-darwin` — v6.10.8 → v7.0.2 binary
- `src-tauri/Cargo.toml:3` — version 0.4.33 → 0.4.34
- `src-tauri/tauri.conf.json:4` — version 0.4.33 → 0.4.34
- `package.json` — version 0.4.33 → 0.4.34

### No API breakage

All management API endpoints used by ProxyPal remain backward-compatible:
- `GET/PATCH /v0/management/*` — unchanged
- `GET /api/auth/status` — unchanged
- `GET /v1/models` — unchanged

### Verification
- Binary verified: `CLIProxyAPI Version: 7.0.2, Commit: 1fca942b, BuiltAt: 2026-05-10T12:57:00Z`
- Management API compatibility: all 23 endpoints checked, zero regressions
- No code changes required beyond binary replacement and version bump

---

*Full CLIProxyAPI changelog: https://github.com/router-for-me/CLIProxyAPI/releases*