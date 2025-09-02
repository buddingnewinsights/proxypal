# CLI Proxy API

English | [中文](README_CN.md)

A proxy server that provides OpenAI/Gemini/Claude/Codex compatible API interfaces for CLI.

It now also supports OpenAI Codex (GPT models) and Claude Code via OAuth.

So you can use local or multi-account CLI access with OpenAI(include Responses)/Gemini/Claude-compatible clients and SDKs.

The first Chinese provider has now been added: [Qwen Code](https://github.com/QwenLM/qwen-code).

## Features

- OpenAI/Gemini/Claude compatible API endpoints for CLI models
- OpenAI Codex support (GPT models) via OAuth login
- Claude Code support via OAuth login
- Qwen Code support via OAuth login
- Streaming and non-streaming responses
- Function calling/tools support
- Multimodal input support (text and images)
- Multiple accounts with round-robin load balancing (Gemini, OpenAI, Claude and Qwen)
- Simple CLI authentication flows (Gemini, OpenAI, Claude and Qwen)
- Generative Language API Key support
- Gemini CLI multi-account load balancing
- Claude Code multi-account load balancing
- Qwen Code multi-account load balancing
- OpenAI Codex multi-account load balancing
- OpenAI-compatible upstream providers via config (e.g., OpenRouter)

## Installation

### Prerequisites

- Go 1.24 or higher
- A Google account with access to Gemini CLI models (optional)
- An OpenAI account for Codex/GPT access (optional)
- An Anthropic account for Claude Code access (optional)
- A Qwen Chat account for Qwen Code access (optional)

### Building from Source

1. Clone the repository:
   ```bash
   git clone https://github.com/luispater/CLIProxyAPI.git
   cd CLIProxyAPI
   ```

2. Build the application:
   ```bash
   go build -o cli-proxy-api ./cmd/server
   ```

## Usage

### Authentication

You can authenticate for Gemini, OpenAI, and/or Claude. All can coexist in the same `auth-dir` and will be load balanced.

- Gemini (Google):
  ```bash
  ./cli-proxy-api --login
  ```
  If you are an existing Gemini Code user, you may need to specify a project ID:
  ```bash
  ./cli-proxy-api --login --project_id <your_project_id>
  ```
  The local OAuth callback uses port `8085`.

  Options: add `--no-browser` to print the login URL instead of opening a browser. The local OAuth callback uses port `8085`.

- OpenAI (Codex/GPT via OAuth):
  ```bash
  ./cli-proxy-api --codex-login
  ```
  Options: add `--no-browser` to print the login URL instead of opening a browser. The local OAuth callback uses port `1455`.

- Claude (Anthropic via OAuth):
  ```bash
  ./cli-proxy-api --claude-login
  ```
  Options: add `--no-browser` to print the login URL instead of opening a browser. The local OAuth callback uses port `54545`.

- Qwen (Qwen Chat via OAuth):
  ```bash
  ./cli-proxy-api --qwen-login
  ```
  Options: add `--no-browser` to print the login URL instead of opening a browser. Use the Qwen Chat's OAuth device flow.


### Starting the Server

Once authenticated, start the server:

```bash
./cli-proxy-api
```

By default, the server runs on port 8317.

### API Endpoints

#### List Models

```
GET http://localhost:8317/v1/models
```

#### Chat Completions

```
POST http://localhost:8317/v1/chat/completions
```

Request body example:

```json
{
  "model": "gemini-2.5-pro",
  "messages": [
    {
      "role": "user",
      "content": "Hello, how are you?"
    }
  ],
  "stream": true
}
```

Notes:
- Use a `gemini-*` model for Gemini (e.g., "gemini-2.5-pro"), a `gpt-*` model for OpenAI (e.g., "gpt-5"), a `claude-*` model for Claude (e.g., "claude-3-5-sonnet-20241022"), or a `qwen-*` model for Qwen (e.g., "qwen3-coder-plus"). The proxy will route to the correct provider automatically.

#### Claude Messages (SSE-compatible)

```
POST http://localhost:8317/v1/messages
```

### Using with OpenAI Libraries

You can use this proxy with any OpenAI-compatible library by setting the base URL to your local server:

#### Python (with OpenAI library)

```python
from openai import OpenAI

client = OpenAI(
    api_key="dummy",  # Not used but required
    base_url="http://localhost:8317/v1"
)

# Gemini example
gemini = client.chat.completions.create(
    model="gemini-2.5-pro",
    messages=[{"role": "user", "content": "Hello, how are you?"}]
)

# Codex/GPT example
gpt = client.chat.completions.create(
    model="gpt-5",
    messages=[{"role": "user", "content": "Summarize this project in one sentence."}]
)

# Claude example (using messages endpoint)
import requests
claude_response = requests.post(
    "http://localhost:8317/v1/messages",
    json={
        "model": "claude-3-5-sonnet-20241022",
        "messages": [{"role": "user", "content": "Summarize this project in one sentence."}],
        "max_tokens": 1000
    }
)

print(gemini.choices[0].message.content)
print(gpt.choices[0].message.content)
print(claude_response.json())
```

#### JavaScript/TypeScript

```javascript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: 'dummy', // Not used but required
  baseURL: 'http://localhost:8317/v1',
});

// Gemini
const gemini = await openai.chat.completions.create({
  model: 'gemini-2.5-pro',
  messages: [{ role: 'user', content: 'Hello, how are you?' }],
});

// Codex/GPT
const gpt = await openai.chat.completions.create({
  model: 'gpt-5',
  messages: [{ role: 'user', content: 'Summarize this project in one sentence.' }],
});

// Claude example (using messages endpoint)
const claudeResponse = await fetch('http://localhost:8317/v1/messages', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'claude-3-5-sonnet-20241022',
    messages: [{ role: 'user', content: 'Summarize this project in one sentence.' }],
    max_tokens: 1000
  })
});

console.log(gemini.choices[0].message.content);
console.log(gpt.choices[0].message.content);
console.log(await claudeResponse.json());
```

## Supported Models

- gemini-2.5-pro
- gemini-2.5-flash
- gpt-5
- claude-opus-4-1-20250805
- claude-opus-4-20250514
- claude-sonnet-4-20250514
- claude-3-7-sonnet-20250219
- claude-3-5-haiku-20241022
- qwen3-coder-plus
- qwen3-coder-flash
- Gemini models auto-switch to preview variants when needed

## Configuration

The server uses a YAML configuration file (`config.yaml`) located in the project root directory by default. You can specify a different configuration file path using the `--config` flag:

```bash
./cli-proxy-api --config /path/to/your/config.yaml
```

### Configuration Options

| Parameter                               | Type     | Default            | Description                                                                                                                                                                               |
|-----------------------------------------|----------|--------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `port`                                  | integer  | 8317               | The port number on which the server will listen.                                                                                                                                          |
| `auth-dir`                              | string   | "~/.cli-proxy-api" | Directory where authentication tokens are stored. Supports using `~` for the home directory. If you use Windows, please set the directory like this: `C:/cli-proxy-api/`                  |
| `proxy-url`                             | string   | ""                 | Proxy URL. Supports socks5/http/https protocols. Example: socks5://user:pass@192.168.1.1:1080/                                                                                            |
| `request-retry`                         | integer  | 0                  | Number of times to retry a request. Retries will occur if the HTTP response code is 403, 408, 500, 502, 503, or 504.                                                                      |
| `remote-management.allow-remote`        | boolean  | false              | Whether to allow remote (non-localhost) access to the management API. If false, only localhost can access. A management key is still required for localhost.                              |
| `remote-management.secret-key`          | string   | ""                 | Management key. If a plaintext value is provided, it will be hashed on startup using bcrypt and persisted back to the config file. If empty, the entire management API is disabled (404). |
| `quota-exceeded`                        | object   | {}                 | Configuration for handling quota exceeded.                                                                                                                                                |
| `quota-exceeded.switch-project`         | boolean  | true               | Whether to automatically switch to another project when a quota is exceeded.                                                                                                              |
| `quota-exceeded.switch-preview-model`   | boolean  | true               | Whether to automatically switch to a preview model when a quota is exceeded.                                                                                                              |
| `debug`                                 | boolean  | false              | Enable debug mode for verbose logging.                                                                                                                                                    |
| `api-keys`                              | string[] | []                 | List of API keys that can be used to authenticate requests.                                                                                                                               |
| `generative-language-api-key`           | string[] | []                 | List of Generative Language API keys.                                                                                                                                                     |
| `claude-api-key`                        | object   | {}                 | List of Claude API keys.                                                                                                                                                                  |
| `claude-api-key.api-key`                | string   | ""                 | Claude API key.                                                                                                                                                                           |
| `claude-api-key.base-url`               | string   | ""                 | Custom Claude API endpoint, if you use a third-party API endpoint.                                                                                                                        |
| `openai-compatibility`                  | object[] | []                 | Upstream OpenAI-compatible providers configuration (name, base-url, api-keys, models).                                                                                                    |
| `openai-compatibility.*.name`           | string   | ""                 | The name of the provider. It will be used in the user agent and other places.                                                                                                             |
| `openai-compatibility.*.base-url`       | string   | ""                 | The base URL of the provider.                                                                                                                                                             |
| `openai-compatibility.*.api-keys`       | string[] | []                 | The API keys for the provider. Add multiple keys if needed. Omit if unauthenticated access is allowed.                                                                                    |
| `openai-compatibility.*.models`         | object[] | []                 | The actual model name.                                                                                                                                                                    |
| `openai-compatibility.*.models.*.name`  | string   | ""                 | The models supported by the provider.                                                                                                                                                     |
| `openai-compatibility.*.models.*.alias` | string   | ""                 | The alias used in the API.                                                                                                                                                                |

### Example Configuration File

```yaml
# Server port
port: 8317

# Management API settings
remote-management:
  # Whether to allow remote (non-localhost) management access.
  # When false, only localhost can access management endpoints (a key is still required).
  allow-remote: false

  # Management key. If a plaintext value is provided here, it will be hashed on startup.
  # All management requests (even from localhost) require this key.
  # Leave empty to disable the Management API entirely (404 for all /v0/management routes).
  secret-key: ""

# Authentication directory (supports ~ for home directory). If you use Windows, please set the directory like this: `C:/cli-proxy-api/`
auth-dir: "~/.cli-proxy-api"

# Enable debug logging
debug: false

# Proxy URL. Supports socks5/http/https protocols. Example: socks5://user:pass@192.168.1.1:1080/
proxy-url: ""

# Number of times to retry a request. Retries will occur if the HTTP response code is 403, 408, 500, 502, 503, or 504.
request-retry: 3

# Quota exceeded behavior
quota-exceeded:
   switch-project: true # Whether to automatically switch to another project when a quota is exceeded
   switch-preview-model: true # Whether to automatically switch to a preview model when a quota is exceeded

# API keys for authentication
api-keys:
  - "your-api-key-1"
  - "your-api-key-2"

# API keys for official Generative Language API
generative-language-api-key:
  - "AIzaSy...01"
  - "AIzaSy...02"
  - "AIzaSy...03"
  - "AIzaSy...04"
  
# Claude API keys
claude-api-key:
  - api-key: "sk-atSM..." # use the official claude API key, no need to set the base url
  - api-key: "sk-atSM..."
    base-url: "https://www.example.com" # use the custom claude API endpoint

# OpenAI compatibility providers
openai-compatibility:
  - name: "openrouter" # The name of the provider; it will be used in the user agent and other places.
    base-url: "https://openrouter.ai/api/v1" # The base URL of the provider.
    api-keys: # The API keys for the provider. Add multiple keys if needed. Omit if unauthenticated access is allowed.
      - "sk-or-v1-...b780"
      - "sk-or-v1-...b781"
    models: # The models supported by the provider.
      - name: "moonshotai/kimi-k2:free" # The actual model name.
        alias: "kimi-k2" # The alias used in the API.
```

### OpenAI Compatibility Providers

Configure upstream OpenAI-compatible providers (e.g., OpenRouter) via `openai-compatibility`.

- name: provider identifier used internally
- base-url: provider base URL
- api-keys: optional list of API keys (omit if provider allows unauthenticated requests)
- models: list of mappings from upstream model `name` to local `alias`

Example:

```yaml
openai-compatibility:
  - name: "openrouter"
    base-url: "https://openrouter.ai/api/v1"
    api-keys:
      - "sk-or-v1-...b780"
      - "sk-or-v1-...b781"
    models:
      - name: "moonshotai/kimi-k2:free"
        alias: "kimi-k2"
```

Usage: 

Call OpenAI's endpoint `/v1/chat/completions` with `model` set to the alias (e.g., `kimi-k2`). The proxy routes to the configured provider/model automatically.

Also, you may call Claude's endpoint `/v1/messages`, Gemini's `/v1beta/models/model-name:streamGenerateContent` or `/v1beta/models/model-name:generateContent`.

And you can always use Gemini CLI with `CODE_ASSIST_ENDPOINT` set to `http://127.0.0.1:8317` for these OpenAI-compatible provider's models.


### Authentication Directory

The `auth-dir` parameter specifies where authentication tokens are stored. When you run the login command, the application will create JSON files in this directory containing the authentication tokens for your Google accounts. Multiple accounts can be used for load balancing.

### API Keys

The `api-keys` parameter allows you to define a list of API keys that can be used to authenticate requests to your proxy server. When making requests to the API, you can include one of these keys in the `Authorization` header:

```
Authorization: Bearer your-api-key-1
```

### Official Generative Language API

The `generative-language-api-key` parameter allows you to define a list of API keys that can be used to authenticate requests to the official Generative Language API.

## Hot Reloading

The server watches the config file and the `auth-dir` for changes and reloads clients and settings automatically. You can add or remove Gemini/OpenAI token JSON files while the server is running; no restart is required.

## Gemini CLI with multiple account load balancing

Start CLI Proxy API server, and then set the `CODE_ASSIST_ENDPOINT` environment variable to the URL of the CLI Proxy API server.

```bash
export CODE_ASSIST_ENDPOINT="http://127.0.0.1:8317"
```

The server will relay the `loadCodeAssist`, `onboardUser`, and `countTokens` requests. And automatically load balance the text generation requests between the multiple accounts.

> [!NOTE]  
> This feature only allows local access because there is currently no way to authenticate the requests.   
> 127.0.0.1 is hardcoded for load balancing.

## Claude Code with multiple account load balancing

Start CLI Proxy API server, and then set the `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_MODEL`, `ANTHROPIC_SMALL_FAST_MODEL` environment variables.

Using Gemini models:
```bash
export ANTHROPIC_BASE_URL=http://127.0.0.1:8317
export ANTHROPIC_AUTH_TOKEN=sk-dummy
export ANTHROPIC_MODEL=gemini-2.5-pro
export ANTHROPIC_SMALL_FAST_MODEL=gemini-2.5-flash
```

Using OpenAI models:
```bash
export ANTHROPIC_BASE_URL=http://127.0.0.1:8317
export ANTHROPIC_AUTH_TOKEN=sk-dummy
export ANTHROPIC_MODEL=gpt-5
export ANTHROPIC_SMALL_FAST_MODEL=gpt-5-minimal
```

Using Claude models:
```bash
export ANTHROPIC_BASE_URL=http://127.0.0.1:8317
export ANTHROPIC_AUTH_TOKEN=sk-dummy
export ANTHROPIC_MODEL=claude-sonnet-4-20250514
export ANTHROPIC_SMALL_FAST_MODEL=claude-3-5-haiku-20241022
```

Using Qwen models:
```bash
export ANTHROPIC_BASE_URL=http://127.0.0.1:8317
export ANTHROPIC_AUTH_TOKEN=sk-dummy
export ANTHROPIC_MODEL=qwen3-coder-plus
export ANTHROPIC_SMALL_FAST_MODEL=qwen3-coder-flash
```

## Codex with multiple account load balancing

Start CLI Proxy API server, and then edit the `~/.codex/config.toml` and `~/.codex/auth.json` files.

config.toml:
```toml
model_provider = "cliproxyapi"
model = "gpt-5" # You can use any of the models that we support.
model_reasoning_effort = "high"

[model_providers.cliproxyapi]
name = "cliproxyapi"
base_url = "http://127.0.0.1:8317/v1"
wire_api = "responses"
```

auth.json:
```json
{
  "OPENAI_API_KEY": "sk-dummy"
}
```

## Run with Docker

Run the following command to login (Gemini OAuth on port 8085): 

```bash
docker run --rm -p 8085:8085 -v /path/to/your/config.yaml:/CLIProxyAPI/config.yaml -v /path/to/your/auth-dir:/root/.cli-proxy-api eceasy/cli-proxy-api:latest /CLIProxyAPI/CLIProxyAPI --login
```

Run the following command to login (OpenAI OAuth on port 1455):

```bash
docker run --rm -p 1455:1455 -v /path/to/your/config.yaml:/CLIProxyAPI/config.yaml -v /path/to/your/auth-dir:/root/.cli-proxy-api eceasy/cli-proxy-api:latest /CLIProxyAPI/CLIProxyAPI --codex-login
```

Run the following command to logi (Claude OAuth on port 54545):

```bash
docker run -rm -p 54545:54545 -v /path/to/your/config.yaml:/CLIProxyAPI/config.yaml -v /path/to/your/auth-dir:/root/.cli-proxy-api eceasy/cli-proxy-api:latest /CLIProxyAPI/CLIProxyAPI --claude-login
```

Run the following command to login (Qwen OAuth):

```bash
docker run -it -rm -v /path/to/your/config.yaml:/CLIProxyAPI/config.yaml -v /path/to/your/auth-dir:/root/.cli-proxy-api eceasy/cli-proxy-api:latest /CLIProxyAPI/CLIProxyAPI --qwen-login
```

Run the following command to start the server:

```bash
docker run --rm -p 8317:8317 -v /path/to/your/config.yaml:/CLIProxyAPI/config.yaml -v /path/to/your/auth-dir:/root/.cli-proxy-api eceasy/cli-proxy-api:latest
```

## Management API

see [MANAGEMENT_API.md](MANAGEMENT_API.md)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
