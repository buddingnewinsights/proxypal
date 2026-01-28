use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthStatus {
    pub claude: u32,
    pub openai: u32,
    pub gemini: u32,
    pub qwen: u32,
    pub iflow: u32,
    pub vertex: u32,
    pub kiro: u32,
    pub antigravity: u32,
}

impl Default for AuthStatus {
    fn default() -> Self {
        Self {
            claude: 0,
            openai: 0,
            gemini: 0,
            qwen: 0,
            iflow: 0,
            vertex: 0,
            kiro: 0,
            antigravity: 0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthState {
    pub provider: String,
    pub state: String,
}

// Detailed auth status from CLIProxyAPI's /api/auth/status endpoint (v6.6.72+)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxyAuthStatus {
    pub status: String, // "ok" or "error"
    pub providers: ProxyAuthProviders,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxyAuthProviders {
    #[serde(default)]
    pub gemini: Option<ProxyAuthProviderStatus>,
    #[serde(default)]
    pub claude: Option<ProxyAuthProviderStatus>,
    #[serde(default)]
    pub openai: Option<ProxyAuthProviderStatus>,
    #[serde(default)]
    pub qwen: Option<ProxyAuthProviderStatus>,
    #[serde(default)]
    pub iflow: Option<ProxyAuthProviderStatus>,
    #[serde(default)]
    pub vertex: Option<ProxyAuthProviderStatus>,
    #[serde(default)]
    pub antigravity: Option<ProxyAuthProviderStatus>,
    #[serde(default)]
    pub kiro: Option<ProxyAuthProviderStatus>,
    #[serde(default)]
    pub copilot: Option<ProxyAuthProviderStatus>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxyAuthProviderStatus {
    pub authenticated: bool,
    #[serde(default)]
    pub accounts: Option<u32>,
    #[serde(default)]
    pub account: Option<String>,
    #[serde(default)]
    pub error: Option<String>,
}

impl Default for ProxyAuthProviders {
    fn default() -> Self {
        Self {
            gemini: None,
            claude: None,
            openai: None,
            qwen: None,
            iflow: None,
            vertex: None,
            antigravity: None,
            kiro: None,
            copilot: None,
        }
    }
}

impl Default for ProxyAuthStatus {
    fn default() -> Self {
        Self {
            status: "unknown".to_string(),
            providers: ProxyAuthProviders::default(),
        }
    }
}
