# CLI Proxy API

A proxy server that provides an OpenAI-compatible API interface for CLI. This allows you to use CLI models with tools and libraries designed for the OpenAI API.

## Features

- OpenAI-compatible API endpoints for CLI models
- Support for both streaming and non-streaming responses
- Function calling/tools support
- Multimodal input support (text and images)
- Multiple account support with load balancing
- Simple CLI authentication flow
- Support for Generative Language API Key

## Installation

### Prerequisites

- Go 1.24 or higher
- A Google account with access to CLI models

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

Before using the API, you need to authenticate with your Google account:

```bash
./cli-proxy-api --login
```

If you are an old gemini code user, you may need to specify a project ID:

```bash
./cli-proxy-api --login --project_id <your_project_id>
```

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

### Using with OpenAI Libraries

You can use this proxy with any OpenAI-compatible library by setting the base URL to your local server:

#### Python (with OpenAI library)

```python
from openai import OpenAI

client = OpenAI(
    api_key="dummy",  # Not used but required
    base_url="http://localhost:8317/v1"
)

response = client.chat.completions.create(
    model="gemini-2.5-pro",
    messages=[
        {"role": "user", "content": "Hello, how are you?"}
    ]
)

print(response.choices[0].message.content)
```

#### JavaScript/TypeScript

```javascript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: 'dummy', // Not used but required
  baseURL: 'http://localhost:8317/v1',
});

const response = await openai.chat.completions.create({
  model: 'gemini-2.5-pro',
  messages: [
    { role: 'user', content: 'Hello, how are you?' }
  ],
});

console.log(response.choices[0].message.content);
```

## Supported Models

- gemini-2.5-pro
- gemini-2.5-flash
- And various preview versions

## Configuration

The server uses a YAML configuration file (`config.yaml`) located in the project root directory by default. You can specify a different configuration file path using the `--config` flag:

```bash
./cli-proxy --config /path/to/your/config.yaml
```

### Configuration Options

| Parameter                     | Type     | Default            | Description                                                                                  |
|-------------------------------|----------|--------------------|----------------------------------------------------------------------------------------------|
| `port`                        | integer  | 8317               | The port number on which the server will listen                                              |
| `auth-dir`                    | string   | "~/.cli-proxy-api" | Directory where authentication tokens are stored. Supports using `~` for home directory      |
| `proxy-url`                   | string   | ""                 | Proxy url, support socks5/http/https protocol, example: socks5://user:pass@192.168.1.1:1080/ |
| `debug`                       | boolean  | false              | Enable debug mode for verbose logging                                                        |
| `api-keys`                    | string[] | []                 | List of API keys that can be used to authenticate requests                                   |
| `generative-language-api-key` | string[] | []                 | List of Generative Language API keys                                                         |

### Example Configuration File

```yaml
# Server port
port: 8317

# Authentication directory (supports ~ for home directory)
auth-dir: "~/.cli-proxy-api"

# Enable debug logging
debug: false

# API keys for authentication
api-keys:
  - "your-api-key-1"
  - "your-api-key-2"
```

### Authentication Directory

The `auth-dir` parameter specifies where authentication tokens are stored. When you run the login command, the application will create JSON files in this directory containing the authentication tokens for your Google accounts. Multiple accounts can be used for load balancing.

### API Keys

The `api-keys` parameter allows you to define a list of API keys that can be used to authenticate requests to your proxy server. When making requests to the API, you can include one of these keys in the `Authorization` header:

```
Authorization: Bearer your-api-key-1
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
