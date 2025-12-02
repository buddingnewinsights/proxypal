use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, State,
};
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::ShellExt;

// Proxy status structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProxyStatus {
    pub running: bool,
    pub port: u16,
    pub endpoint: String,
}

// Request log entry for live monitoring
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RequestLog {
    pub id: String,
    pub timestamp: u64,
    pub provider: String,
    pub model: String,
    pub method: String,
    pub path: String,
    pub status: u16,
    pub duration_ms: u64,
    pub tokens_in: Option<u32>,
    pub tokens_out: Option<u32>,
}

impl Default for ProxyStatus {
    fn default() -> Self {
        Self {
            running: false,
            port: 8317,
            endpoint: "http://localhost:8317/v1".to_string(),
        }
    }
}

// Auth status for different providers
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthStatus {
    pub claude: bool,
    pub openai: bool,
    pub gemini: bool,
    pub qwen: bool,
    pub iflow: bool,
    pub vertex: bool,
    pub antigravity: bool,
}

impl Default for AuthStatus {
    fn default() -> Self {
        Self {
            claude: false,
            openai: false,
            gemini: false,
            qwen: false,
            iflow: false,
            vertex: false,
            antigravity: false,
        }
    }
}

// App configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub port: u16,
    #[serde(rename = "autoStart")]
    pub auto_start: bool,
    #[serde(rename = "launchAtLogin")]
    pub launch_at_login: bool,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            port: 8317,
            auto_start: true,
            launch_at_login: false,
        }
    }
}

// OAuth state for tracking pending auth flows
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthState {
    pub provider: String,
    pub state: String,
}

// Usage statistics from Management API
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct UsageStats {
    pub total_requests: u64,
    pub success_count: u64,
    pub failure_count: u64,
    pub total_tokens: u64,
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub requests_today: u64,
    pub tokens_today: u64,
    #[serde(default)]
    pub models: Vec<ModelUsage>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelUsage {
    pub model: String,
    pub requests: u64,
    pub tokens: u64,
}

// App state
pub struct AppState {
    pub proxy_status: Mutex<ProxyStatus>,
    pub auth_status: Mutex<AuthStatus>,
    pub config: Mutex<AppConfig>,
    pub pending_oauth: Mutex<Option<OAuthState>>,
    pub proxy_process: Mutex<Option<CommandChild>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            proxy_status: Mutex::new(ProxyStatus::default()),
            auth_status: Mutex::new(AuthStatus::default()),
            config: Mutex::new(AppConfig::default()),
            pending_oauth: Mutex::new(None),
            proxy_process: Mutex::new(None),
        }
    }
}

// Config file path
fn get_config_path() -> std::path::PathBuf {
    let config_dir = dirs::config_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("proxypal");
    std::fs::create_dir_all(&config_dir).ok();
    config_dir.join("config.json")
}

fn get_auth_path() -> std::path::PathBuf {
    let config_dir = dirs::config_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("proxypal");
    std::fs::create_dir_all(&config_dir).ok();
    config_dir.join("auth.json")
}

fn get_history_path() -> std::path::PathBuf {
    let config_dir = dirs::config_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("proxypal");
    std::fs::create_dir_all(&config_dir).ok();
    config_dir.join("history.json")
}

// Request history with metadata
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct RequestHistory {
    pub requests: Vec<RequestLog>,
    pub total_tokens_in: u64,
    pub total_tokens_out: u64,
    pub total_cost_usd: f64,
}

// Load request history from file
fn load_request_history() -> RequestHistory {
    let path = get_history_path();
    if path.exists() {
        if let Ok(data) = std::fs::read_to_string(&path) {
            if let Ok(history) = serde_json::from_str(&data) {
                return history;
            }
        }
    }
    RequestHistory::default()
}

// Save request history to file (keep last 100 requests)
fn save_request_history(history: &RequestHistory) -> Result<(), String> {
    let path = get_history_path();
    let mut trimmed = history.clone();
    // Keep only last 100 requests
    if trimmed.requests.len() > 100 {
        trimmed.requests = trimmed.requests.split_off(trimmed.requests.len() - 100);
    }
    let data = serde_json::to_string_pretty(&trimmed).map_err(|e| e.to_string())?;
    std::fs::write(path, data).map_err(|e| e.to_string())
}

// Estimate cost based on model and tokens
fn estimate_request_cost(model: &str, tokens_in: u32, tokens_out: u32) -> f64 {
    // Pricing per 1M tokens (input, output) - approximate as of 2024
    let (input_rate, output_rate) = match model.to_lowercase().as_str() {
        m if m.contains("claude-3-opus") => (15.0, 75.0),
        m if m.contains("claude-3-sonnet") || m.contains("claude-3.5-sonnet") => (3.0, 15.0),
        m if m.contains("claude-3-haiku") || m.contains("claude-3.5-haiku") => (0.25, 1.25),
        m if m.contains("gpt-4o") => (2.5, 10.0),
        m if m.contains("gpt-4-turbo") || m.contains("gpt-4") => (10.0, 30.0),
        m if m.contains("gpt-3.5") => (0.5, 1.5),
        m if m.contains("gemini-1.5-pro") => (1.25, 5.0),
        m if m.contains("gemini-1.5-flash") => (0.075, 0.30),
        m if m.contains("gemini-2") => (0.10, 0.40),
        m if m.contains("qwen") => (0.50, 2.0),
        _ => (1.0, 3.0), // Default conservative estimate
    };
    
    let input_cost = (tokens_in as f64 / 1_000_000.0) * input_rate;
    let output_cost = (tokens_out as f64 / 1_000_000.0) * output_rate;
    input_cost + output_cost
}

// Load config from file
fn load_config() -> AppConfig {
    let path = get_config_path();
    if path.exists() {
        if let Ok(data) = std::fs::read_to_string(&path) {
            if let Ok(config) = serde_json::from_str(&data) {
                return config;
            }
        }
    }
    AppConfig::default()
}

// Save config to file
fn save_config_to_file(config: &AppConfig) -> Result<(), String> {
    let path = get_config_path();
    let data = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    std::fs::write(path, data).map_err(|e| e.to_string())
}

// Load auth status from file
fn load_auth_status() -> AuthStatus {
    let path = get_auth_path();
    if path.exists() {
        if let Ok(data) = std::fs::read_to_string(&path) {
            if let Ok(auth) = serde_json::from_str(&data) {
                return auth;
            }
        }
    }
    AuthStatus::default()
}

// Save auth status to file
fn save_auth_to_file(auth: &AuthStatus) -> Result<(), String> {
    let path = get_auth_path();
    let data = serde_json::to_string_pretty(auth).map_err(|e| e.to_string())?;
    std::fs::write(path, data).map_err(|e| e.to_string())
}

// Parse CLIProxyAPI log output to extract request information
// CLIProxyAPI uses GIN framework log format:
// [GIN] 2025/12/02 - 14:30:57 | 200 | 1.5s | ::1 | POST "/v1/chat/completions"
// With debug mode, additional lines show model info:
// [info] [router.go:XX] Routing to gemini model=gemini-2.5-flash
// [info] [router.go:XX] Response model=gemini-2.5-flash tokens=1234
fn parse_request_log(line: &str, counter: &mut u64, last_model: &mut Option<String>, last_provider: &mut Option<String>) -> Option<RequestLog> {
    let line_trimmed = line.trim();
    
    // Check for model/provider info in debug logs (capture for next GIN log)
    // Patterns: "model=xxx", "Routing to xxx", "provider=xxx"
    if line_trimmed.contains("model=") {
        if let Some(model) = extract_key_value(line_trimmed, "model") {
            *last_model = Some(model.clone());
            // Detect provider from model name
            *last_provider = Some(detect_provider_from_model(&model));
        }
    }
    if line_trimmed.contains("Routing to") {
        // Format: "Routing to gemini" or "Routing to openai"
        let providers = ["gemini", "openai", "anthropic", "claude", "qwen", "deepseek", "vertex", "iflow"];
        for p in providers {
            if line_trimmed.to_lowercase().contains(&format!("routing to {}", p)) {
                *last_provider = Some(p.to_string());
                break;
            }
        }
    }
    
    // Must be a GIN log line with an API path we care about
    if !line_trimmed.contains("[GIN]") {
        return None;
    }
    
    // Only track actual AI API calls, not health checks or management endpoints
    let is_chat = line_trimmed.contains("/v1/chat/completions");
    let is_messages = line_trimmed.contains("/v1/messages");
    let is_completions = line_trimmed.contains("/v1/completions") && !is_chat;
    
    if !is_chat && !is_messages && !is_completions {
        return None;
    }
    
    // Extract HTTP method from the log
    let method = if line_trimmed.contains(" POST ") || line_trimmed.contains("POST \"") {
        "POST"
    } else if line_trimmed.contains(" GET ") || line_trimmed.contains("GET \"") {
        "GET"
    } else {
        "POST" // Default for chat completions
    };
    
    // Extract path
    let path = if is_chat {
        "/v1/chat/completions"
    } else if is_messages {
        "/v1/messages"
    } else {
        "/v1/completions"
    };
    
    // Extract status code from GIN format: "| 200 |"
    let status = extract_status_code(line_trimmed).unwrap_or(200);
    
    // Extract duration from GIN format: "| 1.5s |" or "| 150ms |"
    let duration_ms = extract_duration(line_trimmed).unwrap_or(0);
    
    // Use captured model/provider from previous debug lines, then reset
    let model = last_model.take().unwrap_or_else(|| "unknown".to_string());
    let provider = last_provider.take().unwrap_or_else(|| detect_provider_from_model(&model));
    
    *counter += 1;
    
    Some(RequestLog {
        id: format!("req_{}", counter),
        timestamp: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64,
        provider,
        model,
        method: method.to_string(),
        path: path.to_string(),
        status,
        duration_ms,
        tokens_in: None,
        tokens_out: None,
    })
}

// Extract value from "key=value" pattern
fn extract_key_value(line: &str, key: &str) -> Option<String> {
    let pattern = format!("{}=", key);
    if let Some(start) = line.find(&pattern) {
        let value_start = start + pattern.len();
        let rest = &line[value_start..];
        // Value ends at whitespace, comma, or end of line
        let value_end = rest.find(|c: char| c.is_whitespace() || c == ',' || c == '}' || c == ']')
            .unwrap_or(rest.len());
        let value = rest[..value_end].trim_matches('"').to_string();
        if !value.is_empty() {
            return Some(value);
        }
    }
    None
}

// Detect provider from model name
fn detect_provider_from_model(model: &str) -> String {
    let model_lower = model.to_lowercase();
    
    if model_lower.contains("claude") || model_lower.contains("sonnet") || 
       model_lower.contains("opus") || model_lower.contains("haiku") {
        return "claude".to_string();
    }
    if model_lower.contains("gpt") || model_lower.contains("codex") || 
       model_lower.starts_with("o3") || model_lower.starts_with("o1") {
        return "openai".to_string();
    }
    if model_lower.contains("gemini") {
        return "gemini".to_string();
    }
    if model_lower.contains("qwen") {
        return "qwen".to_string();
    }
    if model_lower.contains("deepseek") {
        return "deepseek".to_string();
    }
    
    "unknown".to_string()
}

// Helper to extract HTTP status code from GIN log line
// Format: "| 200 |"
fn extract_status_code(line: &str) -> Option<u16> {
    // GIN format uses pipes: "| 200 |"
    for part in line.split('|') {
        let trimmed = part.trim();
        if let Ok(code) = trimmed.parse::<u16>() {
            if (100..600).contains(&code) {
                return Some(code);
            }
        }
    }
    None
}

// Helper to extract duration from GIN log line
// Format: "| 1.5s |" or "| 150ms |" or "| 0s |"
fn extract_duration(line: &str) -> Option<u64> {
    for part in line.split('|') {
        let trimmed = part.trim();
        // Check for milliseconds first
        if trimmed.ends_with("ms") {
            if let Ok(ms) = trimmed.trim_end_matches("ms").parse::<u64>() {
                return Some(ms);
            }
        }
        // Check for seconds (including "0s")
        if trimmed.ends_with('s') && !trimmed.ends_with("ms") {
            if let Ok(secs) = trimmed.trim_end_matches('s').parse::<f64>() {
                return Some((secs * 1000.0) as u64);
            }
        }
    }
    None
}

// Tauri commands
#[tauri::command]
fn get_proxy_status(state: State<AppState>) -> ProxyStatus {
    state.proxy_status.lock().unwrap().clone()
}

#[tauri::command]
async fn start_proxy(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<ProxyStatus, String> {
    let config = state.config.lock().unwrap().clone();
    
    // Check if already running
    {
        let status = state.proxy_status.lock().unwrap();
        if status.running {
            return Ok(status.clone());
        }
    }

    // Create config directory and config file for CLIProxyAPI
    let config_dir = dirs::config_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("proxypal");
    std::fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
    
    let proxy_config_path = config_dir.join("proxy-config.yaml");
    
    // Generate a simple config for CLIProxyAPI with Management API enabled
    let proxy_config = format!(
        r#"# ProxyPal generated config
port: {}
auth-dir: "~/.cli-proxy-api"
api-keys:
  - "proxypal-local"
debug: true

# Enable Management API for OAuth flows
remote-management:
  allow-remote: false
  secret-key: "proxypal-mgmt-key"
  disable-control-panel: true
"#,
        config.port
    );
    
    std::fs::write(&proxy_config_path, proxy_config).map_err(|e| e.to_string())?;

    // Spawn the sidecar process
    let sidecar = app
        .shell()
        .sidecar("cliproxyapi")
        .map_err(|e| format!("Failed to create sidecar command: {}", e))?
        .args(["--config", proxy_config_path.to_str().unwrap()]);

    let (mut rx, child) = sidecar.spawn().map_err(|e| format!("Failed to spawn sidecar: {}", e))?;

    // Store the child process
    {
        let mut process = state.proxy_process.lock().unwrap();
        *process = Some(child);
    }

    // Listen for stdout/stderr in a separate task
    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        use tauri_plugin_shell::process::CommandEvent;
        let mut request_counter: u64 = 0;
        // Track model/provider from debug lines for next GIN log
        let mut last_model: Option<String> = None;
        let mut last_provider: Option<String> = None;
        
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    let text = String::from_utf8_lossy(&line);
                    println!("[CLIProxyAPI] {}", text);
                    
                    // Try to parse request logs from CLIProxyAPI output
                    if let Some(log) = parse_request_log(&text, &mut request_counter, &mut last_model, &mut last_provider) {
                        let _ = app_handle.emit("request-log", log);
                    }
                }
                CommandEvent::Stderr(line) => {
                    let text = String::from_utf8_lossy(&line);
                    eprintln!("[CLIProxyAPI ERROR] {}", text);
                }
                CommandEvent::Terminated(payload) => {
                    println!("[CLIProxyAPI] Process terminated: {:?}", payload);
                    // Update status when process dies unexpectedly
                    if let Some(state) = app_handle.try_state::<AppState>() {
                        let mut status = state.proxy_status.lock().unwrap();
                        status.running = false;
                        let _ = app_handle.emit("proxy-status-changed", status.clone());
                    }
                    break;
                }
                _ => {}
            }
        }
    });

    // Give it a moment to start
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

    // Update status
    let new_status = {
        let mut status = state.proxy_status.lock().unwrap();
        status.running = true;
        status.port = config.port;
        status.endpoint = format!("http://localhost:{}/v1", config.port);
        status.clone()
    };

    // Emit status update
    let _ = app.emit("proxy-status-changed", new_status.clone());

    Ok(new_status)
}

#[tauri::command]
async fn stop_proxy(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<ProxyStatus, String> {
    // Check if running
    {
        let status = state.proxy_status.lock().unwrap();
        if !status.running {
            return Ok(status.clone());
        }
    }

    // Kill the child process
    {
        let mut process = state.proxy_process.lock().unwrap();
        if let Some(child) = process.take() {
            child.kill().map_err(|e| format!("Failed to kill process: {}", e))?;
        }
    }

    // Update status
    let new_status = {
        let mut status = state.proxy_status.lock().unwrap();
        status.running = false;
        status.clone()
    };

    // Emit status update
    let _ = app.emit("proxy-status-changed", new_status.clone());

    Ok(new_status)
}

#[tauri::command]
fn get_auth_status(state: State<AppState>) -> AuthStatus {
    state.auth_status.lock().unwrap().clone()
}

// Fetch usage statistics from CLIProxyAPI Management API
#[tauri::command]
async fn get_usage_stats(state: State<'_, AppState>) -> Result<UsageStats, String> {
    // Check if proxy is running
    let port = {
        let status = state.proxy_status.lock().unwrap();
        if !status.running {
            return Ok(UsageStats::default());
        }
        state.config.lock().unwrap().port
    };
    
    // Fetch from Management API with auth header
    let url = format!("http://127.0.0.1:{}/v0/management/usage", port);
    
    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .header("X-Management-Key", "proxypal-mgmt-key")
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await
        .map_err(|e| format!("Failed to fetch usage: {}", e))?;
    
    if !response.status().is_success() {
        return Ok(UsageStats::default());
    }
    
    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse usage response: {}", e))?;
    
    // Parse the response according to Management API format
    let usage = json.get("usage").unwrap_or(&json);
    
    let total_requests = usage.get("total_requests").and_then(|v| v.as_u64()).unwrap_or(0);
    let success_count = usage.get("success_count").and_then(|v| v.as_u64()).unwrap_or(0);
    let failure_count = usage.get("failure_count").and_then(|v| v.as_u64()).unwrap_or(0);
    let total_tokens = usage.get("total_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
    
    // Get today's date for filtering
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    
    let requests_today = usage
        .get("requests_by_day")
        .and_then(|v| v.as_object())
        .and_then(|m| m.get(&today))
        .and_then(|v| v.as_u64())
        .unwrap_or(0);
    
    let tokens_today = usage
        .get("tokens_by_day")
        .and_then(|v| v.as_object())
        .and_then(|m| m.get(&today))
        .and_then(|v| v.as_u64())
        .unwrap_or(0);
    
    // Parse model usage from apis section
    let mut models: Vec<ModelUsage> = Vec::new();
    let mut input_tokens: u64 = 0;
    let mut output_tokens: u64 = 0;
    
    if let Some(apis) = usage.get("apis").and_then(|v| v.as_object()) {
        for (_endpoint, endpoint_data) in apis {
            if let Some(models_obj) = endpoint_data.get("models").and_then(|v| v.as_object()) {
                for (model_name, model_data) in models_obj {
                    let requests = model_data.get("total_requests").and_then(|v| v.as_u64()).unwrap_or(0);
                    let tokens = model_data.get("total_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
                    
                    // Sum up input/output tokens from details
                    if let Some(details) = model_data.get("details").and_then(|v| v.as_array()) {
                        for detail in details {
                            if let Some(token_info) = detail.get("tokens") {
                                input_tokens += token_info.get("input_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
                                output_tokens += token_info.get("output_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
                            }
                        }
                    }
                    
                    // Check if model already exists in our list
                    if let Some(existing) = models.iter_mut().find(|m| m.model == *model_name) {
                        existing.requests += requests;
                        existing.tokens += tokens;
                    } else {
                        models.push(ModelUsage {
                            model: model_name.clone(),
                            requests,
                            tokens,
                        });
                    }
                }
            }
        }
    }
    
    // Sort models by requests (descending)
    models.sort_by(|a, b| b.requests.cmp(&a.requests));
    
    Ok(UsageStats {
        total_requests,
        success_count,
        failure_count,
        total_tokens,
        input_tokens,
        output_tokens,
        requests_today,
        tokens_today,
        models,
    })
}

// Get request history
#[tauri::command]
fn get_request_history() -> RequestHistory {
    load_request_history()
}

// Add a request to history (called when request-log event is emitted)
#[tauri::command]
fn add_request_to_history(request: RequestLog) -> Result<RequestHistory, String> {
    let mut history = load_request_history();
    
    // Calculate cost for this request
    let tokens_in = request.tokens_in.unwrap_or(0);
    let tokens_out = request.tokens_out.unwrap_or(0);
    let cost = estimate_request_cost(&request.model, tokens_in, tokens_out);
    
    // Update totals
    history.total_tokens_in += tokens_in as u64;
    history.total_tokens_out += tokens_out as u64;
    history.total_cost_usd += cost;
    
    // Add request
    history.requests.push(request);
    
    // Save
    save_request_history(&history)?;
    
    Ok(history)
}

// Clear request history
#[tauri::command]
fn clear_request_history() -> Result<(), String> {
    let history = RequestHistory::default();
    save_request_history(&history)
}

#[tauri::command]
async fn open_oauth(app: tauri::AppHandle, state: State<'_, AppState>, provider: String) -> Result<String, String> {
    // Get proxy port from config
    let port = {
        let config = state.config.lock().unwrap();
        config.port
    };

    // Get the OAuth URL from CLIProxyAPI's Management API
    // Add is_webui=true to use the embedded callback forwarder
    let endpoint = match provider.as_str() {
        "claude" => format!("http://localhost:{}/v0/management/anthropic-auth-url?is_webui=true", port),
        "openai" => format!("http://localhost:{}/v0/management/codex-auth-url?is_webui=true", port),
        "gemini" => format!("http://localhost:{}/v0/management/gemini-cli-auth-url?is_webui=true", port),
        "qwen" => format!("http://localhost:{}/v0/management/qwen-auth-url?is_webui=true", port),
        "iflow" => format!("http://localhost:{}/v0/management/iflow-auth-url?is_webui=true", port),
        "antigravity" => format!("http://localhost:{}/v0/management/antigravity-auth-url?is_webui=true", port),
        "vertex" => return Err("Vertex uses service account import, not OAuth. Use import_vertex_credential instead.".to_string()),
        _ => return Err(format!("Unknown provider: {}", provider)),
    };

    // Make HTTP request to get OAuth URL
    let client = reqwest::Client::new();
    let response = client
        .get(&endpoint)
        .header("X-Management-Key", "proxypal-mgmt-key")
        .send()
        .await
        .map_err(|e| format!("Failed to get OAuth URL: {}. Is the proxy running?", e))?;

    if !response.status().is_success() {
        return Err(format!("Management API returned error: {}", response.status()));
    }

    // Parse response to get URL and state
    let body: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let oauth_url = body["url"]
        .as_str()
        .ok_or("No URL in response")?
        .to_string();
    
    let oauth_state = body["state"]
        .as_str()
        .unwrap_or("")
        .to_string();

    // Store pending OAuth state
    {
        let mut pending = state.pending_oauth.lock().unwrap();
        *pending = Some(OAuthState {
            provider: provider.clone(),
            state: oauth_state.clone(),
        });
    }

    // Open the OAuth URL in the default browser
    app.opener()
        .open_url(&oauth_url, None::<&str>)
        .map_err(|e| e.to_string())?;

    // Return the state so frontend can poll for completion
    Ok(oauth_state)
}

#[tauri::command]
async fn poll_oauth_status(state: State<'_, AppState>, oauth_state: String) -> Result<bool, String> {
    let port = {
        let config = state.config.lock().unwrap();
        config.port
    };

    let endpoint = format!(
        "http://localhost:{}/v0/management/get-auth-status?state={}",
        port, oauth_state
    );

    let client = reqwest::Client::new();
    let response = client
        .get(&endpoint)
        .header("X-Management-Key", "proxypal-mgmt-key")
        .send()
        .await
        .map_err(|e| format!("Failed to poll OAuth status: {}", e))?;

    if !response.status().is_success() {
        return Ok(false); // Not ready yet
    }

    let body: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    // Check if auth is complete - CLIProxyAPI returns { "status": "ok" } when done
    let status = body["status"].as_str().unwrap_or("wait");
    Ok(status == "ok")
}

#[tauri::command]
async fn refresh_auth_status(app: tauri::AppHandle, state: State<'_, AppState>) -> Result<AuthStatus, String> {
    // Check CLIProxyAPI's auth directory for credentials
    let auth_dir = dirs::home_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join(".cli-proxy-api");

    let mut new_auth = AuthStatus::default();

    // Scan auth directory for credential files
    if let Ok(entries) = std::fs::read_dir(&auth_dir) {
        for entry in entries.flatten() {
            let filename = entry.file_name().to_string_lossy().to_lowercase();
            
            // CLIProxyAPI naming patterns:
            // - claude-{email}.json or anthropic-*.json
            // - codex-{email}.json
            // - gemini-{email}-{project}.json
            // - qwen-{email}.json
            // - iflow-{email}.json
            // - vertex-{project_id}.json
            // - antigravity-{email}.json
            
            if filename.ends_with(".json") {
                if filename.starts_with("claude-") || filename.starts_with("anthropic-") {
                    new_auth.claude = true;
                } else if filename.starts_with("codex-") {
                    new_auth.openai = true;
                } else if filename.starts_with("gemini-") {
                    new_auth.gemini = true;
                } else if filename.starts_with("qwen-") {
                    new_auth.qwen = true;
                } else if filename.starts_with("iflow-") {
                    new_auth.iflow = true;
                } else if filename.starts_with("vertex-") {
                    new_auth.vertex = true;
                } else if filename.starts_with("antigravity-") {
                    new_auth.antigravity = true;
                }
            }
        }
    }

    // Update state
    {
        let mut auth = state.auth_status.lock().unwrap();
        *auth = new_auth.clone();
    }

    // Save to our config
    save_auth_to_file(&new_auth)?;

    // Emit auth status update
    let _ = app.emit("auth-status-changed", new_auth.clone());

    Ok(new_auth)
}

#[tauri::command]
async fn complete_oauth(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    provider: String,
    code: String,
) -> Result<AuthStatus, String> {
    // In a real implementation, we would:
    // 1. Exchange the code for tokens
    // 2. Store the tokens securely (keychain/credential manager)
    // 3. Update the auth status
    let _ = code; // Mark as used

    // For now, just mark as authenticated
    {
        let mut auth = state.auth_status.lock().unwrap();
        match provider.as_str() {
            "claude" => auth.claude = true,
            "openai" => auth.openai = true,
            "gemini" => auth.gemini = true,
            "qwen" => auth.qwen = true,
            "iflow" => auth.iflow = true,
            "vertex" => auth.vertex = true,
            "antigravity" => auth.antigravity = true,
            _ => return Err(format!("Unknown provider: {}", provider)),
        }

        // Save to file
        save_auth_to_file(&auth)?;

        // Clear pending OAuth
        let mut pending = state.pending_oauth.lock().unwrap();
        *pending = None;

        // Emit auth status update
        let _ = app.emit("auth-status-changed", auth.clone());

        Ok(auth.clone())
    }
}

#[tauri::command]
async fn disconnect_provider(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    provider: String,
) -> Result<AuthStatus, String> {
    let mut auth = state.auth_status.lock().unwrap();

    match provider.as_str() {
        "claude" => auth.claude = false,
        "openai" => auth.openai = false,
        "gemini" => auth.gemini = false,
        "qwen" => auth.qwen = false,
        "iflow" => auth.iflow = false,
        "vertex" => auth.vertex = false,
        "antigravity" => auth.antigravity = false,
        _ => return Err(format!("Unknown provider: {}", provider)),
    }

    // Save to file
    save_auth_to_file(&auth)?;

    // Emit auth status update
    let _ = app.emit("auth-status-changed", auth.clone());

    Ok(auth.clone())
}

// Import Vertex service account credential (JSON file)
#[tauri::command]
async fn import_vertex_credential(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    file_path: String,
) -> Result<AuthStatus, String> {
    // Read the service account JSON file
    let content = std::fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read file: {}", e))?;
    
    // Parse to validate it's valid JSON with required fields
    let json: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("Invalid JSON: {}", e))?;
    
    // Check for required service account fields
    let project_id = json["project_id"]
        .as_str()
        .ok_or("Missing 'project_id' field in service account JSON")?;
    
    if json["type"].as_str() != Some("service_account") {
        return Err("Invalid service account: 'type' must be 'service_account'".to_string());
    }
    
    // Copy to CLIProxyAPI auth directory
    let auth_dir = dirs::home_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join(".cli-proxy-api");
    
    std::fs::create_dir_all(&auth_dir).map_err(|e| e.to_string())?;
    
    let dest_path = auth_dir.join(format!("vertex-{}.json", project_id));
    std::fs::write(&dest_path, &content)
        .map_err(|e| format!("Failed to save credential: {}", e))?;
    
    // Update auth status
    let mut auth = state.auth_status.lock().unwrap();
    auth.vertex = true;
    
    // Save to file
    save_auth_to_file(&auth)?;
    
    // Emit auth status update
    let _ = app.emit("auth-status-changed", auth.clone());
    
    Ok(auth.clone())
}

#[tauri::command]
fn get_config(state: State<AppState>) -> AppConfig {
    state.config.lock().unwrap().clone()
}

#[tauri::command]
fn save_config(state: State<AppState>, config: AppConfig) -> Result<(), String> {
    let mut current_config = state.config.lock().unwrap();
    *current_config = config.clone();
    save_config_to_file(&config)
}

// Provider health status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderHealth {
    pub claude: HealthStatus,
    pub openai: HealthStatus,
    pub gemini: HealthStatus,
    pub qwen: HealthStatus,
    pub iflow: HealthStatus,
    pub vertex: HealthStatus,
    pub antigravity: HealthStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthStatus {
    pub status: String,  // "healthy", "degraded", "offline", "unconfigured"
    pub latency_ms: Option<u64>,
    pub last_checked: u64,
}

impl Default for HealthStatus {
    fn default() -> Self {
        Self {
            status: "unconfigured".to_string(),
            latency_ms: None,
            last_checked: 0,
        }
    }
}

#[tauri::command]
async fn check_provider_health(state: State<'_, AppState>) -> Result<ProviderHealth, String> {
    let config = state.config.lock().unwrap().clone();
    let auth = state.auth_status.lock().unwrap().clone();
    let proxy_running = state.proxy_status.lock().unwrap().running;
    
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    
    // If proxy isn't running, all providers are offline
    if !proxy_running {
        return Ok(ProviderHealth {
            claude: HealthStatus { status: "offline".to_string(), latency_ms: None, last_checked: timestamp },
            openai: HealthStatus { status: "offline".to_string(), latency_ms: None, last_checked: timestamp },
            gemini: HealthStatus { status: "offline".to_string(), latency_ms: None, last_checked: timestamp },
            qwen: HealthStatus { status: "offline".to_string(), latency_ms: None, last_checked: timestamp },
            iflow: HealthStatus { status: "offline".to_string(), latency_ms: None, last_checked: timestamp },
            vertex: HealthStatus { status: "offline".to_string(), latency_ms: None, last_checked: timestamp },
            antigravity: HealthStatus { status: "offline".to_string(), latency_ms: None, last_checked: timestamp },
        });
    }
    
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;
    
    let endpoint = format!("http://localhost:{}/v1/models", config.port);
    
    // Check proxy health by requesting models endpoint
    let start = std::time::Instant::now();
    let response = client.get(&endpoint)
        .header("Authorization", "Bearer proxypal-local")
        .send()
        .await;
    let latency = start.elapsed().as_millis() as u64;
    
    let proxy_healthy = response.map(|r| r.status().is_success()).unwrap_or(false);
    
    Ok(ProviderHealth {
        claude: if auth.claude && proxy_healthy {
            HealthStatus { status: "healthy".to_string(), latency_ms: Some(latency), last_checked: timestamp }
        } else if auth.claude {
            HealthStatus { status: "degraded".to_string(), latency_ms: None, last_checked: timestamp }
        } else {
            HealthStatus { status: "unconfigured".to_string(), latency_ms: None, last_checked: timestamp }
        },
        openai: if auth.openai && proxy_healthy {
            HealthStatus { status: "healthy".to_string(), latency_ms: Some(latency), last_checked: timestamp }
        } else if auth.openai {
            HealthStatus { status: "degraded".to_string(), latency_ms: None, last_checked: timestamp }
        } else {
            HealthStatus { status: "unconfigured".to_string(), latency_ms: None, last_checked: timestamp }
        },
        gemini: if auth.gemini && proxy_healthy {
            HealthStatus { status: "healthy".to_string(), latency_ms: Some(latency), last_checked: timestamp }
        } else if auth.gemini {
            HealthStatus { status: "degraded".to_string(), latency_ms: None, last_checked: timestamp }
        } else {
            HealthStatus { status: "unconfigured".to_string(), latency_ms: None, last_checked: timestamp }
        },
        qwen: if auth.qwen && proxy_healthy {
            HealthStatus { status: "healthy".to_string(), latency_ms: Some(latency), last_checked: timestamp }
        } else if auth.qwen {
            HealthStatus { status: "degraded".to_string(), latency_ms: None, last_checked: timestamp }
        } else {
            HealthStatus { status: "unconfigured".to_string(), latency_ms: None, last_checked: timestamp }
        },
        iflow: if auth.iflow && proxy_healthy {
            HealthStatus { status: "healthy".to_string(), latency_ms: Some(latency), last_checked: timestamp }
        } else if auth.iflow {
            HealthStatus { status: "degraded".to_string(), latency_ms: None, last_checked: timestamp }
        } else {
            HealthStatus { status: "unconfigured".to_string(), latency_ms: None, last_checked: timestamp }
        },
        vertex: if auth.vertex && proxy_healthy {
            HealthStatus { status: "healthy".to_string(), latency_ms: Some(latency), last_checked: timestamp }
        } else if auth.vertex {
            HealthStatus { status: "degraded".to_string(), latency_ms: None, last_checked: timestamp }
        } else {
            HealthStatus { status: "unconfigured".to_string(), latency_ms: None, last_checked: timestamp }
        },
        antigravity: if auth.antigravity && proxy_healthy {
            HealthStatus { status: "healthy".to_string(), latency_ms: Some(latency), last_checked: timestamp }
        } else if auth.antigravity {
            HealthStatus { status: "degraded".to_string(), latency_ms: None, last_checked: timestamp }
        } else {
            HealthStatus { status: "unconfigured".to_string(), latency_ms: None, last_checked: timestamp }
        },
    })
}

// Test agent connection by making a simple API call through the proxy
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentTestResult {
    pub success: bool,
    pub message: String,
    pub latency_ms: Option<u64>,
}

#[tauri::command]
async fn test_agent_connection(state: State<'_, AppState>, agent_id: String) -> Result<AgentTestResult, String> {
    let config = state.config.lock().unwrap().clone();
    let proxy_running = state.proxy_status.lock().unwrap().running;
    
    if !proxy_running {
        return Ok(AgentTestResult {
            success: false,
            message: "Proxy is not running".to_string(),
            latency_ms: None,
        });
    }
    
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;
    
    // Use /v1/models endpoint for testing - lightweight and doesn't consume tokens
    let endpoint = format!("http://localhost:{}/v1/models", config.port);
    
    let start = std::time::Instant::now();
    let response = client.get(&endpoint)
        .header("Authorization", "Bearer proxypal-local")
        .send()
        .await;
    let latency = start.elapsed().as_millis() as u64;
    
    match response {
        Ok(resp) => {
            if resp.status().is_success() {
                Ok(AgentTestResult {
                    success: true,
                    message: format!("Connection successful! {} is ready to use.", agent_id),
                    latency_ms: Some(latency),
                })
            } else {
                Ok(AgentTestResult {
                    success: false,
                    message: format!("Proxy returned status {}", resp.status()),
                    latency_ms: Some(latency),
                })
            }
        }
        Err(e) => {
            Ok(AgentTestResult {
                success: false,
                message: format!("Connection failed: {}", e),
                latency_ms: None,
            })
        }
    }
}

// Handle deep link OAuth callback
fn handle_deep_link(app: &tauri::AppHandle, urls: Vec<url::Url>) {
    for url in urls {
        if url.scheme() == "proxypal" && url.path() == "/oauth/callback" {
            // Parse query parameters
            let params: std::collections::HashMap<_, _> = url.query_pairs().collect();

            if let (Some(code), Some(state)) = (params.get("code"), params.get("state")) {
                // Verify state and get provider from pending OAuth
                let app_state = app.state::<AppState>();
                let pending = app_state.pending_oauth.lock().unwrap().clone();

                if let Some(oauth) = pending {
                    if oauth.state == state.as_ref() {
                        // Emit event to frontend
                        let _ = app.emit(
                            "oauth-callback",
                            serde_json::json!({
                                "provider": oauth.provider,
                                "code": code.as_ref()
                            }),
                        );
                    }
                }
            }

            // Bring window to front
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }
    }
}

// Setup system tray
fn setup_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let toggle_item = MenuItem::with_id(app, "toggle", "Toggle Proxy", true, None::<&str>)?;
    let dashboard_item = MenuItem::with_id(app, "dashboard", "Open Dashboard", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit ProxyPal", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&toggle_item, &dashboard_item, &quit_item])?;

    let _tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip("ProxyPal - Proxy stopped")
        .on_menu_event(move |app, event| match event.id.as_ref() {
            "toggle" => {
                let app_state = app.state::<AppState>();
                let is_running = app_state.proxy_status.lock().unwrap().running;

                // Emit toggle event to frontend
                let _ = app.emit("tray-toggle-proxy", !is_running);
            }
            "dashboard" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.unminimize();
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.unminimize();
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}

// Detected AI coding tool
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectedTool {
    pub id: String,
    pub name: String,
    pub installed: bool,
    pub config_path: Option<String>,
    pub can_auto_configure: bool,
}

// CLI Agent configuration status
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentStatus {
    pub id: String,
    pub name: String,
    pub description: String,
    pub installed: bool,
    pub configured: bool,
    pub config_type: String,  // "env", "file", "both"
    pub config_path: Option<String>,
    pub logo: String,
    pub docs_url: String,
}

// Detect installed CLI agents
#[tauri::command]
fn detect_cli_agents(state: State<AppState>) -> Vec<AgentStatus> {
    let home = dirs::home_dir().unwrap_or_default();
    let config = state.config.lock().unwrap();
    let endpoint = format!("http://127.0.0.1:{}", config.port);
    let mut agents = Vec::new();
    
    // 1. Claude Code - uses environment variables
    // Check if claude/claude-code binary exists
    let claude_installed = which_exists("claude");
    let claude_configured = check_env_configured("ANTHROPIC_BASE_URL", &endpoint);
    
    agents.push(AgentStatus {
        id: "claude-code".to_string(),
        name: "Claude Code".to_string(),
        description: "Anthropic's official CLI for Claude models".to_string(),
        installed: claude_installed,
        configured: claude_configured,
        config_type: "env".to_string(),
        config_path: None,
        logo: "/logos/claude.svg".to_string(),
        docs_url: "https://help.router-for.me/agent-client/claude-code.html".to_string(),
    });
    
    // 2. Codex - uses ~/.codex/config.toml and ~/.codex/auth.json
    let codex_installed = which_exists("codex");
    let codex_config = home.join(".codex/config.toml");
    let codex_configured = if codex_config.exists() {
        std::fs::read_to_string(&codex_config)
            .map(|c| c.contains("cliproxyapi") || c.contains(&endpoint))
            .unwrap_or(false)
    } else {
        false
    };
    
    agents.push(AgentStatus {
        id: "codex".to_string(),
        name: "Codex CLI".to_string(),
        description: "OpenAI's Codex CLI for GPT-5 models".to_string(),
        installed: codex_installed,
        configured: codex_configured,
        config_type: "file".to_string(),
        config_path: Some(codex_config.to_string_lossy().to_string()),
        logo: "/logos/openai.svg".to_string(),
        docs_url: "https://help.router-for.me/agent-client/codex.html".to_string(),
    });
    
    // 3. Gemini CLI - uses environment variables
    let gemini_installed = which_exists("gemini");
    let gemini_configured = check_env_configured("CODE_ASSIST_ENDPOINT", &endpoint) 
        || check_env_configured("GOOGLE_GEMINI_BASE_URL", &endpoint);
    
    agents.push(AgentStatus {
        id: "gemini-cli".to_string(),
        name: "Gemini CLI".to_string(),
        description: "Google's Gemini CLI for Gemini models".to_string(),
        installed: gemini_installed,
        configured: gemini_configured,
        config_type: "env".to_string(),
        config_path: None,
        logo: "/logos/gemini.svg".to_string(),
        docs_url: "https://help.router-for.me/agent-client/gemini-cli.html".to_string(),
    });
    
    // 4. Factory Droid - uses ~/.factory/config.json
    let droid_installed = which_exists("droid") || which_exists("factory");
    let droid_config = home.join(".factory/config.json");
    let droid_configured = if droid_config.exists() {
        std::fs::read_to_string(&droid_config)
            .map(|c| c.contains(&endpoint) || c.contains("127.0.0.1:8317"))
            .unwrap_or(false)
    } else {
        false
    };
    
    agents.push(AgentStatus {
        id: "factory-droid".to_string(),
        name: "Factory Droid".to_string(),
        description: "Factory's AI coding agent".to_string(),
        installed: droid_installed,
        configured: droid_configured,
        config_type: "file".to_string(),
        config_path: Some(droid_config.to_string_lossy().to_string()),
        logo: "/logos/droid.svg".to_string(),
        docs_url: "https://help.router-for.me/agent-client/droid.html".to_string(),
    });
    
    // 5. Amp CLI - uses ~/.config/amp/settings.json or AMP_URL env
    let amp_installed = which_exists("amp");
    let amp_config = home.join(".config/amp/settings.json");
    let amp_configured = check_env_configured("AMP_URL", &endpoint) || {
        if amp_config.exists() {
            std::fs::read_to_string(&amp_config)
                .map(|c| c.contains(&endpoint) || c.contains("localhost:8317"))
                .unwrap_or(false)
        } else {
            false
        }
    };
    
    agents.push(AgentStatus {
        id: "amp-cli".to_string(),
        name: "Amp CLI".to_string(),
        description: "Sourcegraph's Amp coding assistant".to_string(),
        installed: amp_installed,
        configured: amp_configured,
        config_type: "both".to_string(),
        config_path: Some(amp_config.to_string_lossy().to_string()),
        logo: "/logos/amp.svg".to_string(),
        docs_url: "https://help.router-for.me/agent-client/amp-cli.html".to_string(),
    });
    
    // 6. OpenCode - uses opencode.json config file with custom provider
    let opencode_installed = which_exists("opencode");
    // Check for global opencode.json in ~/.config/opencode/opencode.json
    let opencode_global_config = home.join(".config/opencode/opencode.json");
    let opencode_configured = if opencode_global_config.exists() {
        // Check if our proxypal provider is configured
        std::fs::read_to_string(&opencode_global_config)
            .map(|content| content.contains("proxypal") && content.contains(&endpoint))
            .unwrap_or(false)
    } else {
        false
    };
    
    agents.push(AgentStatus {
        id: "opencode".to_string(),
        name: "OpenCode".to_string(),
        description: "Terminal-based AI coding assistant".to_string(),
        installed: opencode_installed,
        configured: opencode_configured,
        config_type: "config".to_string(),
        config_path: Some(opencode_global_config.to_string_lossy().to_string()),
        logo: "/logos/opencode.svg".to_string(),
        docs_url: "https://opencode.ai/docs/providers/".to_string(),
    });
    
    agents
}

// Helper to check if a command exists in PATH
fn which_exists(cmd: &str) -> bool {
    std::process::Command::new("which")
        .arg(cmd)
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

// Helper to check if env var is set to expected value
fn check_env_configured(var: &str, expected_prefix: &str) -> bool {
    std::env::var(var)
        .map(|v| v.starts_with(expected_prefix))
        .unwrap_or(false)
}

// Configure a CLI agent with ProxyPal
#[tauri::command]
fn configure_cli_agent(state: State<AppState>, agent_id: String) -> Result<serde_json::Value, String> {
    let config = state.config.lock().unwrap();
    let port = config.port;
    let endpoint = format!("http://127.0.0.1:{}", port);
    let endpoint_v1 = format!("{}/v1", endpoint);
    let home = dirs::home_dir().ok_or("Could not find home directory")?;
    
    match agent_id.as_str() {
        "claude-code" => {
            // Generate shell config for Claude Code
            let shell_config = format!(r#"# ProxyPal - Claude Code Configuration
export ANTHROPIC_BASE_URL="{}"
export ANTHROPIC_AUTH_TOKEN="proxypal-local"
# For Claude Code 2.x
export ANTHROPIC_DEFAULT_OPUS_MODEL="claude-opus-4-1-20250805"
export ANTHROPIC_DEFAULT_SONNET_MODEL="claude-sonnet-4-5-20250929"
export ANTHROPIC_DEFAULT_HAIKU_MODEL="claude-3-5-haiku-20241022"
# For Claude Code 1.x
export ANTHROPIC_MODEL="claude-sonnet-4-5-20250929"
export ANTHROPIC_SMALL_FAST_MODEL="claude-3-5-haiku-20241022"
"#, endpoint);
            
            Ok(serde_json::json!({
                "success": true,
                "configType": "env",
                "shellConfig": shell_config,
                "instructions": "Add the above to your ~/.bashrc, ~/.zshrc, or shell config file, then restart your terminal."
            }))
        },
        
        "codex" => {
            // Create ~/.codex directory
            let codex_dir = home.join(".codex");
            std::fs::create_dir_all(&codex_dir).map_err(|e| e.to_string())?;
            
            // Write config.toml
            let config_content = format!(r#"# ProxyPal - Codex Configuration
model_provider = "cliproxyapi"
model = "gpt-5-codex"
model_reasoning_effort = "high"

[model_providers.cliproxyapi]
name = "cliproxyapi"
base_url = "{}/v1"
wire_api = "responses"
"#, endpoint);
            
            let config_path = codex_dir.join("config.toml");
            std::fs::write(&config_path, &config_content).map_err(|e| e.to_string())?;
            
            // Write auth.json
            let auth_content = r#"{
  "OPENAI_API_KEY": "proxypal-local"
}"#;
            let auth_path = codex_dir.join("auth.json");
            std::fs::write(&auth_path, auth_content).map_err(|e| e.to_string())?;
            
            Ok(serde_json::json!({
                "success": true,
                "configType": "file",
                "configPath": config_path.to_string_lossy(),
                "authPath": auth_path.to_string_lossy(),
                "instructions": "Codex has been configured. Run 'codex' to start using it."
            }))
        },
        
        "gemini-cli" => {
            // Generate shell config for Gemini CLI
            let shell_config = format!(r#"# ProxyPal - Gemini CLI Configuration
# Option 1: OAuth mode (local only)
export CODE_ASSIST_ENDPOINT="{}"

# Option 2: API Key mode (works with any IP/domain)
# export GOOGLE_GEMINI_BASE_URL="{}"
# export GEMINI_API_KEY="proxypal-local"
"#, endpoint, endpoint);
            
            Ok(serde_json::json!({
                "success": true,
                "configType": "env",
                "shellConfig": shell_config,
                "instructions": "Add the above to your ~/.bashrc, ~/.zshrc, or shell config file, then restart your terminal."
            }))
        },
        
        "factory-droid" => {
            // Create ~/.factory directory
            let factory_dir = home.join(".factory");
            std::fs::create_dir_all(&factory_dir).map_err(|e| e.to_string())?;
            
            // Write config.json with all CLIProxyAPI-supported models
            // See: https://help.router-for.me/agent-client/droid.html
            let config_content = format!(r#"{{
  "custom_models": [
    {{
      "model": "claude-sonnet-4-5-20250929",
      "base_url": "{}",
      "api_key": "proxypal-local",
      "provider": "anthropic"
    }},
    {{
      "model": "claude-opus-4-1-20250805",
      "base_url": "{}",
      "api_key": "proxypal-local",
      "provider": "anthropic"
    }},
    {{
      "model": "claude-3-5-haiku-20241022",
      "base_url": "{}",
      "api_key": "proxypal-local",
      "provider": "anthropic"
    }},
    {{
      "model": "gpt-5",
      "base_url": "{}/v1",
      "api_key": "proxypal-local",
      "provider": "openai"
    }},
    {{
      "model": "gpt-5-codex",
      "base_url": "{}/v1",
      "api_key": "proxypal-local",
      "provider": "openai"
    }},
    {{
      "model": "o3",
      "base_url": "{}/v1",
      "api_key": "proxypal-local",
      "provider": "openai"
    }},
    {{
      "model": "gemini-2.5-pro",
      "base_url": "{}/v1",
      "api_key": "proxypal-local",
      "provider": "openai"
    }},
    {{
      "model": "gemini-2.5-flash",
      "base_url": "{}/v1",
      "api_key": "proxypal-local",
      "provider": "openai"
    }},
    {{
      "model": "qwen3-coder-plus",
      "base_url": "{}/v1",
      "api_key": "proxypal-local",
      "provider": "openai"
    }},
    {{
      "model": "qwen-coder-plus",
      "base_url": "{}/v1",
      "api_key": "proxypal-local",
      "provider": "openai"
    }},
    {{
      "model": "deepseek-r1",
      "base_url": "{}/v1",
      "api_key": "proxypal-local",
      "provider": "openai"
    }},
    {{
      "model": "deepseek-v3",
      "base_url": "{}/v1",
      "api_key": "proxypal-local",
      "provider": "openai"
    }}
  ]
}}"#, endpoint, endpoint, endpoint, endpoint, endpoint, endpoint, endpoint, endpoint, endpoint, endpoint, endpoint, endpoint);
            
            let config_path = factory_dir.join("config.json");
            std::fs::write(&config_path, &config_content).map_err(|e| e.to_string())?;
            
            Ok(serde_json::json!({
                "success": true,
                "configType": "file",
                "configPath": config_path.to_string_lossy(),
                "instructions": "Factory Droid has been configured. Run 'droid' or 'factory' to start using it."
            }))
        },
        
        "amp-cli" => {
            // Create ~/.config/amp directory
            let amp_dir = home.join(".config/amp");
            std::fs::create_dir_all(&amp_dir).map_err(|e| e.to_string())?;
            
            // Write settings.json
            let settings_content = format!(r#"{{
  "amp.url": "{}"
}}"#, endpoint);
            
            let config_path = amp_dir.join("settings.json");
            std::fs::write(&config_path, &settings_content).map_err(|e| e.to_string())?;
            
            // Also provide env var option
            let shell_config = format!(r#"# ProxyPal - Amp CLI Configuration (alternative to settings.json)
export AMP_URL="{}"
"#, endpoint);
            
            Ok(serde_json::json!({
                "success": true,
                "configType": "both",
                "configPath": config_path.to_string_lossy(),
                "shellConfig": shell_config,
                "instructions": "Amp CLI has been configured. Run 'amp login' to authenticate, then 'amp' to start using it."
            }))
        },
        
        "opencode" => {
            // OpenCode uses opencode.json config file with custom provider
            // See: https://opencode.ai/docs/providers/#custom-provider
            let config_dir = home.join(".config/opencode");
            std::fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
            let config_path = config_dir.join("opencode.json");
            
            // Create or update opencode.json with proxypal provider
            // Use CLIProxyAPI-compatible model names
            let opencode_config = serde_json::json!({
                "$schema": "https://opencode.ai/config.json",
                "provider": {
                    "proxypal": {
                        "npm": "@ai-sdk/openai-compatible",
                        "name": "ProxyPal (Local Proxy)",
                        "options": {
                            "baseURL": endpoint_v1,
                            "apiKey": "proxypal-local"
                        },
                        "models": {
                            // Claude models (via CLIProxyAPI)
                            "claude-sonnet-4-5-20250929": {
                                "name": "Claude Sonnet 4.5",
                                "limit": { "context": 200000, "output": 16384 }
                            },
                            "claude-opus-4-1-20250805": {
                                "name": "Claude Opus 4.1",
                                "limit": { "context": 200000, "output": 16384 }
                            },
                            "claude-3-5-haiku-20241022": {
                                "name": "Claude 3.5 Haiku",
                                "limit": { "context": 200000, "output": 8192 }
                            },
                            // GPT models (via CLIProxyAPI)
                            "gpt-5": {
                                "name": "GPT-5",
                                "limit": { "context": 128000, "output": 32768 }
                            },
                            "gpt-5-codex": {
                                "name": "GPT-5 Codex",
                                "limit": { "context": 128000, "output": 32768 }
                            },
                            "o3": {
                                "name": "OpenAI o3",
                                "limit": { "context": 200000, "output": 100000 }
                            },
                            // Gemini models (via CLIProxyAPI)
                            "gemini-2.5-pro": {
                                "name": "Gemini 2.5 Pro",
                                "limit": { "context": 1000000, "output": 65536 }
                            },
                            "gemini-2.5-flash": {
                                "name": "Gemini 2.5 Flash",
                                "limit": { "context": 1000000, "output": 65536 }
                            },
                            // Qwen models (via CLIProxyAPI)
                            "qwen3-coder-plus": {
                                "name": "Qwen3 Coder Plus",
                                "limit": { "context": 131072, "output": 16384 }
                            },
                            // DeepSeek models (via CLIProxyAPI)
                            "deepseek-r1": {
                                "name": "DeepSeek R1",
                                "limit": { "context": 64000, "output": 8192 }
                            },
                            "deepseek-v3": {
                                "name": "DeepSeek V3",
                                "limit": { "context": 64000, "output": 8192 }
                            }
                        }
                    }
                }
            });
            
            // If config exists, merge with existing
            let final_config = if config_path.exists() {
                if let Ok(existing) = std::fs::read_to_string(&config_path) {
                    if let Ok(mut existing_json) = serde_json::from_str::<serde_json::Value>(&existing) {
                        // Merge provider into existing config
                        if let Some(providers) = existing_json.get_mut("provider") {
                            if let Some(obj) = providers.as_object_mut() {
                                obj.insert("proxypal".to_string(), opencode_config["provider"]["proxypal"].clone());
                            }
                        } else {
                            existing_json["provider"] = opencode_config["provider"].clone();
                        }
                        existing_json
                    } else {
                        opencode_config
                    }
                } else {
                    opencode_config
                }
            } else {
                opencode_config
            };
            
            let config_str = serde_json::to_string_pretty(&final_config).map_err(|e| e.to_string())?;
            std::fs::write(&config_path, &config_str).map_err(|e| e.to_string())?;
            
            Ok(serde_json::json!({
                "success": true,
                "configType": "config",
                "configPath": config_path.to_string_lossy(),
                "instructions": "ProxyPal provider added to OpenCode. Run 'opencode' and use /models to select a model (e.g., proxypal/claude-sonnet-4-5-20250929). OpenCode uses AI SDK (ai-sdk.dev) and models.dev registry."
            }))
        },
        
        _ => Err(format!("Unknown agent: {}", agent_id)),
    }
}

// Get shell profile path
#[tauri::command]
fn get_shell_profile_path() -> Result<String, String> {
    let home = dirs::home_dir().ok_or("Could not find home directory")?;
    
    // Check for common shell config files
    let shell = std::env::var("SHELL").unwrap_or_default();
    
    let profile_path = if shell.contains("zsh") {
        home.join(".zshrc")
    } else if shell.contains("bash") {
        // Prefer .bashrc on Linux, .bash_profile on macOS
        #[cfg(target_os = "macos")]
        let path = home.join(".bash_profile");
        #[cfg(not(target_os = "macos"))]
        let path = home.join(".bashrc");
        path
    } else if shell.contains("fish") {
        home.join(".config/fish/config.fish")
    } else {
        // Default to .profile
        home.join(".profile")
    };
    
    Ok(profile_path.to_string_lossy().to_string())
}

// Append environment config to shell profile
#[tauri::command]
fn append_to_shell_profile(content: String) -> Result<String, String> {
    let profile_path = get_shell_profile_path()?;
    let path = std::path::Path::new(&profile_path);
    
    // Read existing content
    let existing = std::fs::read_to_string(path).unwrap_or_default();
    
    // Check if ProxyPal config already exists
    if existing.contains("# ProxyPal") {
        return Err("ProxyPal configuration already exists in shell profile. Please remove it first or update manually.".to_string());
    }
    
    // Append new config
    let new_content = format!("{}\n\n{}", existing.trim_end(), content);
    std::fs::write(path, new_content).map_err(|e| e.to_string())?;
    
    Ok(profile_path)
}

// Detect installed AI coding tools
#[tauri::command]
fn detect_ai_tools() -> Vec<DetectedTool> {
    let home = dirs::home_dir().unwrap_or_default();
    let mut tools = Vec::new();
    
    // Check for Cursor
    #[cfg(target_os = "macos")]
    let cursor_app = std::path::Path::new("/Applications/Cursor.app").exists();
    #[cfg(target_os = "windows")]
    let cursor_app = dirs::data_local_dir()
        .map(|p| p.join("Programs/cursor/Cursor.exe").exists())
        .unwrap_or(false);
    #[cfg(target_os = "linux")]
    let cursor_app = home.join(".local/share/applications/cursor.desktop").exists() 
        || std::path::Path::new("/usr/share/applications/cursor.desktop").exists();
    
    tools.push(DetectedTool {
        id: "cursor".to_string(),
        name: "Cursor".to_string(),
        installed: cursor_app,
        config_path: None, // Cursor doesn't support custom API base URL
        can_auto_configure: false,
    });
    
    // Check for VS Code (needed for Continue/Cline)
    #[cfg(target_os = "macos")]
    let vscode_installed = std::path::Path::new("/Applications/Visual Studio Code.app").exists();
    #[cfg(target_os = "windows")]
    let vscode_installed = dirs::data_local_dir()
        .map(|p| p.join("Programs/Microsoft VS Code/Code.exe").exists())
        .unwrap_or(false);
    #[cfg(target_os = "linux")]
    let vscode_installed = std::path::Path::new("/usr/bin/code").exists();
    
    // Check for Continue extension (config file)
    let continue_config = home.join(".continue");
    let continue_yaml = continue_config.join("config.yaml");
    let continue_json = continue_config.join("config.json");
    let continue_installed = continue_yaml.exists() || continue_json.exists() || continue_config.exists();
    
    tools.push(DetectedTool {
        id: "continue".to_string(),
        name: "Continue".to_string(),
        installed: continue_installed || vscode_installed,
        config_path: if continue_yaml.exists() {
            Some(continue_yaml.to_string_lossy().to_string())
        } else if continue_json.exists() {
            Some(continue_json.to_string_lossy().to_string())
        } else {
            Some(continue_yaml.to_string_lossy().to_string()) // Default to yaml
        },
        can_auto_configure: true, // Continue has editable config
    });
    
    // Check for Cline extension
    #[cfg(target_os = "macos")]
    let cline_storage = home.join("Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev");
    #[cfg(target_os = "windows")]
    let cline_storage = dirs::data_dir()
        .map(|p| p.join("Code/User/globalStorage/saoudrizwan.claude-dev"))
        .unwrap_or_default();
    #[cfg(target_os = "linux")]
    let cline_storage = home.join(".config/Code/User/globalStorage/saoudrizwan.claude-dev");
    
    tools.push(DetectedTool {
        id: "cline".to_string(),
        name: "Cline".to_string(),
        installed: cline_storage.exists() || vscode_installed,
        config_path: None, // Cline uses VS Code settings UI
        can_auto_configure: false,
    });
    
    // Check for Windsurf
    #[cfg(target_os = "macos")]
    let windsurf_app = std::path::Path::new("/Applications/Windsurf.app").exists();
    #[cfg(target_os = "windows")]
    let windsurf_app = dirs::data_local_dir()
        .map(|p| p.join("Programs/Windsurf/Windsurf.exe").exists())
        .unwrap_or(false);
    #[cfg(target_os = "linux")]
    let windsurf_app = std::path::Path::new("/usr/bin/windsurf").exists();
    
    tools.push(DetectedTool {
        id: "windsurf".to_string(),
        name: "Windsurf".to_string(),
        installed: windsurf_app,
        config_path: None,
        can_auto_configure: false,
    });
    
    tools
}

// Configure Continue extension with ProxyPal endpoint
#[tauri::command]
fn configure_continue(state: State<AppState>) -> Result<String, String> {
    let config = state.config.lock().unwrap();
    let endpoint = format!("http://localhost:{}/v1", config.port);
    
    let home = dirs::home_dir().ok_or("Could not find home directory")?;
    let continue_dir = home.join(".continue");
    
    // Create directory if it doesn't exist
    std::fs::create_dir_all(&continue_dir).map_err(|e| e.to_string())?;
    
    let config_path = continue_dir.join("config.yaml");
    
    // Check if config already exists
    let existing_content = std::fs::read_to_string(&config_path).unwrap_or_default();
    
    // If config exists and already has ProxyPal, update it
    if existing_content.contains("ProxyPal") || existing_content.contains(&endpoint) {
        return Ok("Continue is already configured with ProxyPal".to_string());
    }
    
    // Create new config or append to existing
    let new_config = if existing_content.is_empty() {
        format!(r#"# Continue configuration - Auto-configured by ProxyPal
name: ProxyPal Config
version: 0.0.1
schema: v1

models:
  - name: ProxyPal (Auto-routed)
    provider: openai
    model: gpt-4
    apiKey: proxypal-local
    apiBase: {}
    roles:
      - chat
      - edit
      - apply
"#, endpoint)
    } else {
        // Append ProxyPal model to existing config
        format!(r#"{}
  # Added by ProxyPal
  - name: ProxyPal (Auto-routed)
    provider: openai
    model: gpt-4
    apiKey: proxypal-local
    apiBase: {}
    roles:
      - chat
      - edit
      - apply
"#, existing_content.trim_end(), endpoint)
    };
    
    std::fs::write(&config_path, new_config).map_err(|e| e.to_string())?;
    
    Ok(config_path.to_string_lossy().to_string())
}

// Get setup instructions for a specific tool
#[tauri::command]
fn get_tool_setup_info(tool_id: String, state: State<AppState>) -> Result<serde_json::Value, String> {
    let config = state.config.lock().unwrap();
    let endpoint = format!("http://localhost:{}/v1", config.port);
    
    let info = match tool_id.as_str() {
        "cursor" => serde_json::json!({
            "name": "Cursor",
            "logo": "/logos/cursor.svg",
            "canAutoConfigure": false,
            "note": "Cursor doesn't support custom API base URLs. Use your connected providers' API keys directly in Cursor settings.",
            "steps": [
                {
                    "title": "Open Cursor Settings",
                    "description": "Press Cmd+, (Mac) or Ctrl+, (Windows) and go to 'Models'"
                },
                {
                    "title": "Add API Keys",
                    "description": "Enter your API keys for Claude, OpenAI, or other providers directly"
                }
            ]
        }),
        "continue" => serde_json::json!({
            "name": "Continue",
            "logo": "/logos/continue.svg",
            "canAutoConfigure": true,
            "steps": [
                {
                    "title": "Auto-Configure",
                    "description": "Click the button below to automatically configure Continue"
                },
                {
                    "title": "Or Manual Setup",
                    "description": "Open ~/.continue/config.yaml and add:"
                }
            ],
            "manualConfig": format!(r#"models:
  - name: ProxyPal
    provider: openai
    model: gpt-4
    apiKey: proxypal-local
    apiBase: {}"#, endpoint),
            "endpoint": endpoint
        }),
        "cline" => serde_json::json!({
            "name": "Cline",
            "logo": "/logos/cline.svg",
            "canAutoConfigure": false,
            "steps": [
                {
                    "title": "Open Cline Settings",
                    "description": "Click the Cline icon in VS Code sidebar, then click the gear icon"
                },
                {
                    "title": "Select API Provider",
                    "description": "Choose 'OpenAI Compatible' from the provider dropdown"
                },
                {
                    "title": "Set Base URL",
                    "description": "Enter the ProxyPal endpoint:",
                    "copyable": endpoint.clone()
                },
                {
                    "title": "Set API Key",
                    "description": "Enter: proxypal-local",
                    "copyable": "proxypal-local".to_string()
                },
                {
                    "title": "Select Model",
                    "description": "Enter any model name (e.g., gpt-4, claude-3-sonnet)"
                }
            ],
            "endpoint": endpoint
        }),
        "windsurf" => serde_json::json!({
            "name": "Windsurf",
            "logo": "/logos/windsurf.svg",
            "canAutoConfigure": false,
            "note": "Windsurf doesn't support custom API endpoints. It only supports direct API keys for Claude models.",
            "steps": [
                {
                    "title": "Not Supported",
                    "description": "Windsurf routes all requests through Codeium servers and doesn't allow custom endpoints."
                }
            ]
        }),
        _ => return Err(format!("Unknown tool: {}", tool_id)),
    };
    
    Ok(info)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Load persisted config and auth
    let config = load_config();
    let auth = load_auth_status();

    let app_state = AppState {
        proxy_status: Mutex::new(ProxyStatus::default()),
        auth_status: Mutex::new(auth),
        config: Mutex::new(config),
        pending_oauth: Mutex::new(None),
        proxy_process: Mutex::new(None),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            // Handle deep links when app is already running
            let urls: Vec<url::Url> = args
                .iter()
                .filter_map(|arg| url::Url::parse(arg).ok())
                .collect();
            if !urls.is_empty() {
                handle_deep_link(app, urls);
            }

            // Show existing window
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .manage(app_state)
        .setup(|app| {
            // Setup system tray
            #[cfg(desktop)]
            setup_tray(app)?;

            // Register deep link handler for when app is already running
            #[cfg(desktop)]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                let handle = app.handle().clone();
                app.deep_link().on_open_url(move |event| {
                    let urls: Vec<url::Url> = event.urls().to_vec();
                    if !urls.is_empty() {
                        handle_deep_link(&handle, urls);
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_proxy_status,
            start_proxy,
            stop_proxy,
            get_auth_status,
            refresh_auth_status,
            open_oauth,
            poll_oauth_status,
            complete_oauth,
            disconnect_provider,
            import_vertex_credential,
            get_config,
            save_config,
            check_provider_health,
            detect_ai_tools,
            configure_continue,
            get_tool_setup_info,
            detect_cli_agents,
            configure_cli_agent,
            get_shell_profile_path,
            append_to_shell_profile,
            get_usage_stats,
            get_request_history,
            add_request_to_history,
            clear_request_history,
            test_agent_connection,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
