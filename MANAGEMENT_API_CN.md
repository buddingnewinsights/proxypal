# 管理 API

基础路径：`http://localhost:8317/v0/management`

该 API 用于管理 CLI Proxy API 的运行时配置与认证文件。所有变更会持久化写入 YAML 配置文件，并由服务自动热重载。

注意：以下选项不能通过 API 修改，需在配置文件中设置（如有必要可重启）：
- `allow-remote-management`
- `remote-management-key`（若在启动时检测到明文，会自动进行 bcrypt 加密并写回配置）

## 认证

- 所有请求（包括本地访问）都必须提供有效的管理密钥.
- 远程访问需要在配置文件中开启远程访问： `allow-remote-management: true`
- 通过以下任意方式提供管理密钥（明文）：
  - `Authorization: Bearer <plaintext-key>`
  - `X-Management-Key: <plaintext-key>`

若在启动时检测到配置中的管理密钥为明文，会自动使用 bcrypt 加密并回写到配置文件中。

## 请求/响应约定

- Content-Type：`application/json`（除非另有说明）。
- 布尔/整数/字符串更新：请求体为 `{ "value": <type> }`。
- 数组 PUT：既可使用原始数组（如 `["a","b"]`），也可使用 `{ "items": [ ... ] }`。
- 数组 PATCH：支持 `{ "old": "k1", "new": "k2" }` 或 `{ "index": 0, "value": "k2" }`。
- 对象数组 PATCH：支持按索引或按关键字段匹配（各端点中单独说明）。

## 端点说明

### Debug
- GET `/debug` — 获取当前 debug 状态
  - 请求：
    ```bash
    curl -H 'Authorization: Bearer <MANAGEMENT_KEY>' http://localhost:8317/v0/management/debug
    ```
  - 响应：
    ```json
    { "debug": false }
    ```
- PUT/PATCH `/debug` — 设置 debug（布尔值）
  - 请求：
    ```bash
    curl -X PUT -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer <MANAGEMENT_KEY>' \
      -d '{"value":true}' \
      http://localhost:8317/v0/management/debug
    ```
  - 响应：
    ```json
    { "status": "ok" }
    ```

### 代理服务器 URL
- GET `/proxy-url` — 获取代理 URL 字符串
  - 请求：
    ```bash
    curl -H 'Authorization: Bearer <MANAGEMENT_KEY>' http://localhost:8317/v0/management/proxy-url
    ```
  - 响应：
    ```json
    { "proxy-url": "socks5://user:pass@127.0.0.1:1080/" }
    ```
- PUT/PATCH `/proxy-url` — 设置代理 URL 字符串
  - 请求（PUT）：
    ```bash
    curl -X PUT -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer <MANAGEMENT_KEY>' \
      -d '{"value":"socks5://user:pass@127.0.0.1:1080/"}' \
      http://localhost:8317/v0/management/proxy-url
    ```
  - 请求（PATCH）：
    ```bash
    curl -X PATCH -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer <MANAGEMENT_KEY>' \
      -d '{"value":"http://127.0.0.1:8080"}' \
      http://localhost:8317/v0/management/proxy-url
    ```
  - 响应：
    ```json
    { "status": "ok" }
    ```
- DELETE `/proxy-url` — 清空代理 URL
  - 请求：
    ```bash
    curl -H 'Authorization: Bearer <MANAGEMENT_KEY>' -X DELETE http://localhost:8317/v0/management/proxy-url
    ```
  - 响应：
    ```json
    { "status": "ok" }
    ```

### 超出配额行为
- GET `/quota-exceeded/switch-project`
  - 请求：
    ```bash
    curl -H 'Authorization: Bearer <MANAGEMENT_KEY>' http://localhost:8317/v0/management/quota-exceeded/switch-project
    ```
  - 响应：
    ```json
    { "switch-project": true }
    ```
- PUT/PATCH `/quota-exceeded/switch-project` — 布尔值
  - 请求：
    ```bash
    curl -X PUT -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer <MANAGEMENT_KEY>' \
      -d '{"value":false}' \
      http://localhost:8317/v0/management/quota-exceeded/switch-project
    ```
  - 响应：
    ```json
    { "status": "ok" }
    ```
- GET `/quota-exceeded/switch-preview-model`
  - 请求：
    ```bash
    curl -H 'Authorization: Bearer <MANAGEMENT_KEY>' http://localhost:8317/v0/management/quota-exceeded/switch-preview-model
    ```
  - 响应：
    ```json
    { "switch-preview-model": true }
    ```
- PUT/PATCH `/quota-exceeded/switch-preview-model` — 布尔值
  - 请求：
    ```bash
    curl -X PATCH -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer <MANAGEMENT_KEY>' \
      -d '{"value":true}' \
      http://localhost:8317/v0/management/quota-exceeded/switch-preview-model
    ```
  - 响应：
    ```json
    { "status": "ok" }
    ```

### API Keys（代理服务认证）
- GET `/api-keys` — 返回完整列表
  - 请求：
    ```bash
    curl -H 'Authorization: Bearer <MANAGEMENT_KEY>' http://localhost:8317/v0/management/api-keys
    ```
  - 响应：
    ```json
    { "api-keys": ["k1","k2","k3"] }
    ```
- PUT `/api-keys` — 完整改写列表
  - 请求：
    ```bash
    curl -X PUT -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer <MANAGEMENT_KEY>' \
      -d '["k1","k2","k3"]' \
      http://localhost:8317/v0/management/api-keys
    ```
  - 响应：
    ```json
    { "status": "ok" }
    ```
- PATCH `/api-keys` — 修改其中一个（`old/new` 或 `index/value`）
  - 请求（按 old/new）：
    ```bash
    curl -X PATCH -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer <MANAGEMENT_KEY>' \
      -d '{"old":"k2","new":"k2b"}' \
      http://localhost:8317/v0/management/api-keys
    ```
  - 请求（按 index/value）：
    ```bash
    curl -X PATCH -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer <MANAGEMENT_KEY>' \
      -d '{"index":0,"value":"k1b"}' \
      http://localhost:8317/v0/management/api-keys
    ```
  - 响应：
    ```json
    { "status": "ok" }
    ```
- DELETE `/api-keys` — 删除其中一个（`?value=` 或 `?index=`）
  - 请求（按值删除）：
    ```bash
    curl -H 'Authorization: Bearer <MANAGEMENT_KEY>' -X DELETE 'http://localhost:8317/v0/management/api-keys?value=k1'
    ```
  - 请求（按索引删除）：
    ```bash
    curl -H 'Authorization: Bearer <MANAGEMENT_KEY>' -X DELETE 'http://localhost:8317/v0/management/api-keys?index=0'
    ```
  - 响应：
    ```json
    { "status": "ok" }
    ```

### Gemini API Key（生成式语言）
- GET `/generative-language-api-key`
  - 请求：
    ```bash
    curl -H 'Authorization: Bearer <MANAGEMENT_KEY>' http://localhost:8317/v0/management/generative-language-api-key
    ```
  - 响应：
    ```json
    { "generative-language-api-key": ["AIzaSy...01","AIzaSy...02"] }
    ```
- PUT `/generative-language-api-key`
  - 请求：
    ```bash
    curl -X PUT -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer <MANAGEMENT_KEY>' \
      -d '["AIzaSy-1","AIzaSy-2"]' \
      http://localhost:8317/v0/management/generative-language-api-key
    ```
  - 响应：
    ```json
    { "status": "ok" }
    ```
- PATCH `/generative-language-api-key`
  - 请求：
    ```bash
    curl -X PATCH -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer <MANAGEMENT_KEY>' \
      -d '{"old":"AIzaSy-1","new":"AIzaSy-1b"}' \
      http://localhost:8317/v0/management/generative-language-api-key
    ```
  - 响应：
    ```json
    { "status": "ok" }
    ```
- DELETE `/generative-language-api-key`
  - 请求：
    ```bash
    curl -H 'Authorization: Bearer <MANAGEMENT_KEY>' -X DELETE 'http://localhost:8317/v0/management/generative-language-api-key?value=AIzaSy-2'
    ```
  - 响应：
    ```json
    { "status": "ok" }
    ```

### Codex API Key（OpenAI）
- GET `/codex-api-key`
  - 请求：
    ```bash
    curl -H 'Authorization: Bearer <MANAGEMENT_KEY>' http://localhost:8317/v0/management/codex-api-key
    ```
  - 响应：
    ```json
    { "codex-api-key": ["sk-proj-01","sk-proj-02"] }
    ```
- PUT `/codex-api-key`
  - 请求：
    ```bash
    curl -X PUT -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer <MANAGEMENT_KEY>' \
      -d '["sk-proj-1","sk-proj-2"]' \
      http://localhost:8317/v0/management/codex-api-key
    ```
  - 响应：
    ```json
    { "status": "ok" }
    ```
- PATCH `/codex-api-key`
  - 请求：
    ```bash
    curl -X PATCH -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer <MANAGEMENT_KEY>' \
      -d '{"old":"sk-proj-1","new":"sk-proj-1b"}' \
      http://localhost:8317/v0/management/codex-api-key
    ```
  - 响应：
    ```json
    { "status": "ok" }
    ```
- DELETE `/codex-api-key`
  - 请求：
    ```bash
    curl -H 'Authorization: Bearer <MANAGEMENT_KEY>' -X DELETE 'http://localhost:8317/v0/management/codex-api-key?value=sk-proj-2'
    ```
  - 响应：
    ```json
    { "status": "ok" }
    ```

### 开启请求日志
- GET `/request-log` — 获取布尔值
  - 请求：
    ```bash
    curl -H 'Authorization: Bearer <MANAGEMENT_KEY>' http://localhost:8317/v0/management/request-log
    ```
  - 响应：
    ```json
    { "request-log": true }
    ```
- PUT/PATCH `/request-log` — 设置布尔值
  - 请求：
    ```bash
    curl -X PUT -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer <MANAGEMENT_KEY>' \
      -d '{"value":true}' \
      http://localhost:8317/v0/management/request-log
    ```
  - 响应：
    ```json
    { "status": "ok" }
    ```

### 请求重试次数
- GET `/request-retry` — 获取整数
  - 请求：
    ```bash
    curl -H 'Authorization: Bearer <MANAGEMENT_KEY>' http://localhost:8317/v0/management/request-retry
    ```
  - 响应：
    ```json
    { "request-retry": 3 }
    ```
- PUT/PATCH `/request-retry` — 设置整数
  - 请求：
    ```bash
    curl -X PATCH -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer <MANAGEMENT_KEY>' \
      -d '{"value":5}' \
      http://localhost:8317/v0/management/request-retry
    ```
  - 响应：
    ```json
    { "status": "ok" }
    ```

### 允许本地未认证访问
- GET `/allow-localhost-unauthenticated` — 获取布尔值
  - 请求：
    ```bash
    curl -H 'Authorization: Bearer <MANAGEMENT_KEY>' http://localhost:8317/v0/management/allow-localhost-unauthenticated
    ```
  - 响应：
    ```json
    { "allow-localhost-unauthenticated": false }
    ```
- PUT/PATCH `/allow-localhost-unauthenticated` — 设置布尔值
  - 请求：
    ```bash
    curl -X PUT -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer <MANAGEMENT_KEY>' \
      -d '{"value":true}' \
      http://localhost:8317/v0/management/allow-localhost-unauthenticated
    ```
  - 响应：
    ```json
    { "status": "ok" }
    ```

### Claude API KEY（对象数组）
- GET `/claude-api-key` — 列出全部
  - 请求：
    ```bash
    curl -H 'Authorization: Bearer <MANAGEMENT_KEY>' http://localhost:8317/v0/management/claude-api-key
    ```
  - 响应：
    ```json
    { "claude-api-key": [ { "api-key": "sk-a", "base-url": "" } ] }
    ```
- PUT `/claude-api-key` — 完整改写列表
  - 请求：
    ```bash
    curl -X PUT -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer <MANAGEMENT_KEY>' \
      -d '[{"api-key":"sk-a"},{"api-key":"sk-b","base-url":"https://c.example.com"}]' \
      http://localhost:8317/v0/management/claude-api-key
    ```
  - 响应：
    ```json
    { "status": "ok" }
    ```
- PATCH `/claude-api-key` — 修改其中一个（按 `index` 或 `match`）
  - 请求（按索引）：
    ```bash
    curl -X PATCH -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer <MANAGEMENT_KEY>' \
      -d '{"index":1,"value":{"api-key":"sk-b2","base-url":"https://c.example.com"}}' \
      http://localhost:8317/v0/management/claude-api-key
    ```
  - 请求（按匹配）：
    ```bash
    curl -X PATCH -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer <MANAGEMENT_KEY>' \
      -d '{"match":"sk-a","value":{"api-key":"sk-a","base-url":""}}' \
      http://localhost:8317/v0/management/claude-api-key
    ```
  - 响应：
    ```json
    { "status": "ok" }
    ```
- DELETE `/claude-api-key` — 删除其中一个（`?api-key=` 或 `?index=`）
  - 请求（按 api-key）：
    ```bash
    curl -H 'Authorization: Bearer <MANAGEMENT_KEY>' -X DELETE 'http://localhost:8317/v0/management/claude-api-key?api-key=sk-b2'
    ```
  - 请求（按索引）：
    ```bash
    curl -H 'Authorization: Bearer <MANAGEMENT_KEY>' -X DELETE 'http://localhost:8317/v0/management/claude-api-key?index=0'
    ```
  - 响应：
    ```json
    { "status": "ok" }
    ```

### OpenAI 兼容提供商（对象数组）
- GET `/openai-compatibility` — 列出全部
  - 请求：
    ```bash
    curl -H 'Authorization: Bearer <MANAGEMENT_KEY>' http://localhost:8317/v0/management/openai-compatibility
    ```
  - 响应：
    ```json
    { "openai-compatibility": [ { "name": "openrouter", "base-url": "https://openrouter.ai/api/v1", "api-keys": [], "models": [] } ] }
    ```
- PUT `/openai-compatibility` — 完整改写列表
  - 请求：
    ```bash
    curl -X PUT -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer <MANAGEMENT_KEY>' \
      -d '[{"name":"openrouter","base-url":"https://openrouter.ai/api/v1","api-keys":["sk"],"models":[{"name":"m","alias":"a"}]}]' \
      http://localhost:8317/v0/management/openai-compatibility
    ```
  - 响应：
    ```json
    { "status": "ok" }
    ```
- PATCH `/openai-compatibility` — 修改其中一个（按 `index` 或 `name`）
  - 请求（按名称）：
    ```bash
    curl -X PATCH -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer <MANAGEMENT_KEY>' \
      -d '{"name":"openrouter","value":{"name":"openrouter","base-url":"https://openrouter.ai/api/v1","api-keys":[],"models":[]}}' \
      http://localhost:8317/v0/management/openai-compatibility
    ```
  - 请求（按索引）：
    ```bash
    curl -X PATCH -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer <MANAGEMENT_KEY>' \
      -d '{"index":0,"value":{"name":"openrouter","base-url":"https://openrouter.ai/api/v1","api-keys":[],"models":[]}}' \
      http://localhost:8317/v0/management/openai-compatibility
    ```
  - 响应：
    ```json
    { "status": "ok" }
    ```
- DELETE `/openai-compatibility` — 删除（`?name=` 或 `?index=`）
  - 请求（按名称）：
    ```bash
    curl -H 'Authorization: Bearer <MANAGEMENT_KEY>' -X DELETE 'http://localhost:8317/v0/management/openai-compatibility?name=openrouter'
    ```
  - 请求（按索引）：
    ```bash
    curl -H 'Authorization: Bearer <MANAGEMENT_KEY>' -X DELETE 'http://localhost:8317/v0/management/openai-compatibility?index=0'
    ```
  - 响应：
    ```json
    { "status": "ok" }
    ```

### 认证文件管理

管理 `auth-dir` 下的 JSON 令牌文件：列出、下载、上传、删除。

- GET `/auth-files` — 列表
  - 请求：
    ```bash
    curl -H 'Authorization: Bearer <MANAGEMENT_KEY>' http://localhost:8317/v0/management/auth-files
    ```
  - 响应：
    ```json
    { "files": [ { "name": "acc1.json", "size": 1234, "modtime": "2025-08-30T12:34:56Z" } ] }
    ```

- GET `/auth-files/download?name=<file.json>` — 下载单个文件
  - 请求：
    ```bash
    curl -H 'Authorization: Bearer <MANAGEMENT_KEY>' -OJ 'http://localhost:8317/v0/management/auth-files/download?name=acc1.json'
    ```

- POST `/auth-files` — 上传
  - 请求（multipart）：
    ```bash
    curl -X POST -F 'file=@/path/to/acc1.json' \
    -H 'Authorization: Bearer <MANAGEMENT_KEY>' \
      http://localhost:8317/v0/management/auth-files
    ```
  - 请求（原始 JSON）：
    ```bash
    curl -X POST -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer <MANAGEMENT_KEY>' \
      -d @/path/to/acc1.json \
      'http://localhost:8317/v0/management/auth-files?name=acc1.json'
    ```
  - 响应：
    ```json
    { "status": "ok" }
    ```

- DELETE `/auth-files?name=<file.json>` — 删除单个文件
  - 请求：
    ```bash
    curl -H 'Authorization: Bearer <MANAGEMENT_KEY>' -X DELETE 'http://localhost:8317/v0/management/auth-files?name=acc1.json'
    ```
  - 响应：
    ```json
    { "status": "ok" }
    ```

- DELETE `/auth-files?all=true` — 删除 `auth-dir` 下所有 `.json` 文件
  - 请求：
    ```bash
    curl -H 'Authorization: Bearer <MANAGEMENT_KEY>' -X DELETE 'http://localhost:8317/v0/management/auth-files?all=true'
    ```
  - 响应：
    ```json
    { "status": "ok", "deleted": 3 }
    ```

## 错误响应

通用错误格式：
- 400 Bad Request: `{ "error": "invalid body" }`
- 401 Unauthorized: `{ "error": "missing management key" }` 或 `{ "error": "invalid management key" }`
- 403 Forbidden: `{ "error": "remote management disabled" }`
- 404 Not Found: `{ "error": "item not found" }` 或 `{ "error": "file not found" }`
- 500 Internal Server Error: `{ "error": "failed to save config: ..." }`

## 说明

- 变更会写回 YAML 配置文件，并由文件监控器热重载配置与客户端。
- `allow-remote-management` 与 `remote-management-key` 不能通过 API 修改，需在配置文件中设置。

