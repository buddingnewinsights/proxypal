# Management API

Base URL: `http://localhost:8317/v0/management`

This API manages runtime configuration and authentication files for the CLI Proxy API. All changes persist to the YAML config file and are hot‑reloaded by the server.

Note: The following options cannot be changed via API and must be edited in the config file, then restart if needed:
- `allow-remote-management`
- `remote-management-key` (stored as bcrypt hash after startup if plaintext was provided)

## Authentication

- All requests (including localhost) must include a management key.
- Remote access additionally requires `allow-remote-management: true` in config.
- Provide the key via one of:
  - `Authorization: Bearer <plaintext-key>`
  - `X-Management-Key: <plaintext-key>`

If a plaintext key is present in the config on startup, it is bcrypt-hashed and written back to the config file automatically. If `remote-management-key` is empty, the Management API is entirely disabled (404 for `/v0/management/*`).

## Request/Response Conventions

- Content type: `application/json` unless noted.
- Boolean/int/string updates use body: `{ "value": <type> }`.
- Array PUT bodies can be either a raw array (e.g. `["a","b"]`) or `{ "items": [ ... ] }`.
- Array PATCH accepts either `{ "old": "k1", "new": "k2" }` or `{ "index": 0, "value": "k2" }`.
- Object-array PATCH supports either index or key match (documented per endpoint).

## Endpoints

### Debug
- GET `/debug` — get current debug flag
- PUT/PATCH `/debug` — set debug (boolean)

Example (set true):
```bash
curl -X PUT \
-H 'Authorization: Bearer <MANAGEMENT_KEY>' \
  -H 'Content-Type: application/json' \
  -d '{"value":true}' \
  http://localhost:8317/v0/management/debug
```
Response:
```json
{ "status": "ok" }
```

### Proxy URL
- GET `/proxy-url` — get proxy URL string
- PUT/PATCH `/proxy-url` — set proxy URL string
- DELETE `/proxy-url` — clear proxy URL

Example (set):
```bash
curl -X PATCH -H 'Content-Type: application/json' \
-H 'Authorization: Bearer <MANAGEMENT_KEY>' \
  -d '{"value":"socks5://user:pass@127.0.0.1:1080/"}' \
  http://localhost:8317/v0/management/proxy-url
```
Response:
```json
{ "status": "ok" }
```

### Quota Exceeded Behavior
- GET `/quota-exceeded/switch-project`
- PUT/PATCH `/quota-exceeded/switch-project` — boolean
- GET `/quota-exceeded/switch-preview-model`
- PUT/PATCH `/quota-exceeded/switch-preview-model` — boolean

Example:
```bash
curl -X PUT -H 'Content-Type: application/json' \
-H 'Authorization: Bearer <MANAGEMENT_KEY>' \
  -d '{"value":false}' \
  http://localhost:8317/v0/management/quota-exceeded/switch-project
```
Response:
```json
{ "status": "ok" }
```

### API Keys (proxy server auth)
- GET `/api-keys` — return the full list
- PUT `/api-keys` — replace the full list
- PATCH `/api-keys` — update one entry (by `old/new` or `index/value`)
- DELETE `/api-keys` — remove one entry (by `?value=` or `?index=`)

Examples:
```bash
# Replace list
curl -X PUT -H 'Content-Type: application/json' \
-H 'Authorization: Bearer <MANAGEMENT_KEY>' \
  -d '["k1","k2","k3"]' \
  http://localhost:8317/v0/management/api-keys

# Patch: replace k2 -> k2b
curl -X PATCH -H 'Content-Type: application/json' \
-H 'Authorization: Bearer <MANAGEMENT_KEY>' \
  -d '{"old":"k2","new":"k2b"}' \
  http://localhost:8317/v0/management/api-keys

# Delete by value
curl -H 'Authorization: Bearer <MANAGEMENT_KEY>' -X DELETE 'http://localhost:8317/v0/management/api-keys?value=k1'
```
Response (GET):
```json
{ "api-keys": ["k1","k2b","k3"] }
```

### Generative Language API Keys (Gemini)
- GET `/generative-language-api-key`
- PUT `/generative-language-api-key`
- PATCH `/generative-language-api-key`
- DELETE `/generative-language-api-key`

Same request/response shapes as API keys.

### Codex API Keys (OpenAI)
- GET `/codex-api-key`
  - Request:
    ```bash
    curl -H 'Authorization: Bearer <MANAGEMENT_KEY>' http://localhost:8317/v0/management/codex-api-key
    ```
  - Response:
    ```json
    { "codex-api-key": ["sk-proj-01","sk-proj-02"] }
    ```
- PUT `/codex-api-key`
  - Request:
    ```bash
    curl -X PUT -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer <MANAGEMENT_KEY>' \
      -d '["sk-proj-1","sk-proj-2"]' \
      http://localhost:8317/v0/management/codex-api-key
    ```
  - Response:
    ```json
    { "status": "ok" }
    ```
- PATCH `/codex-api-key`
  - Request:
    ```bash
    curl -X PATCH -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer <MANAGEMENT_KEY>' \
      -d '{"old":"sk-proj-1","new":"sk-proj-1b"}' \
      http://localhost:8317/v0/management/codex-api-key
    ```
  - Response:
    ```json
    { "status": "ok" }
    ```
- DELETE `/codex-api-key`
  - Request:
    ```bash
    curl -H 'Authorization: Bearer <MANAGEMENT_KEY>' -X DELETE 'http://localhost:8317/v0/management/codex-api-key?value=sk-proj-2'
    ```
  - Response:
    ```json
    { "status": "ok" }
    ```

### Request Logging
- GET `/request-log` — get boolean
- PUT/PATCH `/request-log` — set boolean

### Request Retry
- GET `/request-retry` — get integer
- PUT/PATCH `/request-retry` — set integer

### Allow Localhost Unauthenticated
- GET `/allow-localhost-unauthenticated` — get boolean
- PUT/PATCH `/allow-localhost-unauthenticated` — set boolean

### Claude API Keys (object array)
- GET `/claude-api-key` — full list
- PUT `/claude-api-key` — replace list
- PATCH `/claude-api-key` — update one item (by `index` or `match` API key)
- DELETE `/claude-api-key` — remove one item (`?api-key=` or `?index=`)

Object shape:
```json
{
  "api-key": "sk-...",
  "base-url": "https://custom.example.com"   // optional
}
```

Examples:
```bash
# Replace list
curl -X PUT -H 'Content-Type: application/json' \
-H 'Authorization: Bearer <MANAGEMENT_KEY>' \
  -d '[{"api-key":"sk-a"},{"api-key":"sk-b","base-url":"https://c.example.com"}]' \
  http://localhost:8317/v0/management/claude-api-key

# Patch by index
curl -X PATCH -H 'Content-Type: application/json' \
-H 'Authorization: Bearer <MANAGEMENT_KEY>' \
  -d '{"index":1,"value":{"api-key":"sk-b2","base-url":"https://c.example.com"}}' \
  http://localhost:8317/v0/management/claude-api-key

# Patch by match (api-key)
curl -X PATCH -H 'Content-Type: application/json' \
-H 'Authorization: Bearer <MANAGEMENT_KEY>' \
  -d '{"match":"sk-a","value":{"api-key":"sk-a","base-url":""}}' \
  http://localhost:8317/v0/management/claude-api-key

# Delete by api-key
curl -H 'Authorization: Bearer <MANAGEMENT_KEY>' -X DELETE 'http://localhost:8317/v0/management/claude-api-key?api-key=sk-b2'
```
Response (GET):
```json
{
  "claude-api-key": [
    { "api-key": "sk-a", "base-url": "" }
  ]
}
```

### OpenAI Compatibility Providers (object array)
- GET `/openai-compatibility` — full list
- PUT `/openai-compatibility` — replace list
- PATCH `/openai-compatibility` — update one item by `index` or `name`
- DELETE `/openai-compatibility` — remove by `?name=` or `?index=`

Object shape:
```json
{
  "name": "openrouter",
  "base-url": "https://openrouter.ai/api/v1",
  "api-keys": ["sk-..."],
  "models": [ {"name": "moonshotai/kimi-k2:free", "alias": "kimi-k2"} ]
}
```

Examples:
```bash
# Replace list
curl -X PUT -H 'Content-Type: application/json' \
-H 'Authorization: Bearer <MANAGEMENT_KEY>' \
  -d '[{"name":"openrouter","base-url":"https://openrouter.ai/api/v1","api-keys":["sk"],"models":[{"name":"m","alias":"a"}]}]' \
  http://localhost:8317/v0/management/openai-compatibility

# Patch by name
curl -X PATCH -H 'Content-Type: application/json' \
-H 'Authorization: Bearer <MANAGEMENT_KEY>' \
  -d '{"name":"openrouter","value":{"name":"openrouter","base-url":"https://openrouter.ai/api/v1","api-keys":[],"models":[]}}' \
  http://localhost:8317/v0/management/openai-compatibility

# Delete by index
curl -H 'Authorization: Bearer <MANAGEMENT_KEY>' -X DELETE 'http://localhost:8317/v0/management/openai-compatibility?index=0'
```
Response (GET):
```json
{ "openai-compatibility": [ { "name": "openrouter", "base-url": "...", "api-keys": [], "models": [] } ] }
```

### Auth Files Management

List JSON token files under `auth-dir`, download/upload/delete.

- GET `/auth-files` — list
  - Response:
    ```json
    { "files": [ { "name": "acc1.json", "size": 1234, "modtime": "2025-08-30T12:34:56Z" } ] }
    ```

- GET `/auth-files/download?name=<file.json>` — download a single file

- POST `/auth-files` — upload
  - Multipart form: field `file` (must be `.json`)
  - Or raw JSON body with `?name=<file.json>`
  - Response: `{ "status": "ok" }`

- DELETE `/auth-files?name=<file.json>` — delete a single file
- DELETE `/auth-files?all=true` — delete all `.json` files in `auth-dir`

## Error Responses

Generic error shapes:
- 400 Bad Request: `{ "error": "invalid body" }`
- 401 Unauthorized: `{ "error": "missing management key" }` or `{ "error": "invalid management key" }`
- 403 Forbidden: `{ "error": "remote management disabled" }`
- 404 Not Found: `{ "error": "item not found" }` or `{ "error": "file not found" }`
- 500 Internal Server Error: `{ "error": "failed to save config: ..." }`

## Notes

- Changes are written to the YAML configuration file and picked up by the server’s file watcher to hot-reload clients and settings.
- `allow-remote-management` and `remote-management-key` must be edited in the configuration file and cannot be changed via the API.

