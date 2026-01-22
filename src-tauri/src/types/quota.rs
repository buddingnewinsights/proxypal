use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Response from Antigravity's fetchAvailableModels API
/// Format: { "models": { "model_name": { "quotaInfo": { ... } } } }
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AntigravityModelsResponse {
    pub models: Option<HashMap<String, AntigravityModelInfo>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AntigravityModelInfo {
    pub quota_info: Option<QuotaInfo>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuotaInfo {
    pub remaining_fraction: Option<f64>,
    pub reset_time: Option<String>,
}

/// Simplified quota data for frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelQuota {
    pub model: String,
    pub display_name: String,
    pub remaining_percent: f64,
    pub reset_time: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AntigravityQuotaResult {
    pub account_email: String,
    pub quotas: Vec<ModelQuota>,
    pub fetched_at: String,
    pub error: Option<String>,
}

/// Codex/ChatGPT Usage API Types (from chatgpt.com/backend-api/wham/usage)
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct CodexQuotaResult {
    pub account_email: String,
    /// Plan type: "free", "plus", "pro", "team", etc.
    pub plan_type: String,
    /// Primary rate limit window (usually 3-hour window)
    pub primary_used_percent: f64,
    pub primary_reset_at: Option<i64>,
    /// Secondary rate limit window (usually weekly)
    pub secondary_used_percent: f64,
    pub secondary_reset_at: Option<i64>,
    /// Credits balance (for Pro plans)
    pub has_credits: bool,
    pub credits_balance: Option<f64>,
    pub credits_unlimited: bool,
    pub fetched_at: String,
    pub error: Option<String>,
}

/// Copilot/GitHub Usage API Types (from api.github.com/copilot_internal/user)
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct CopilotQuotaResult {
    pub account_login: String,
    /// Plan type: "free", "pro", "business", "enterprise"
    pub plan: String,
    /// Premium interactions quota (primary) - percent remaining
    pub premium_interactions_percent: f64,
    /// Chat quota (secondary) - percent remaining
    pub chat_percent: f64,
    pub fetched_at: String,
    pub error: Option<String>,
}

/// Claude/Anthropic Usage API Types (from api.anthropic.com/api/oauth/usage)
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeQuotaResult {
    pub account_email: String,
    /// Plan type: "free", "pro", "max"
    pub plan: String,
    /// 5-hour session limit - percent used
    pub five_hour_percent: f64,
    pub five_hour_reset_at: Option<i64>,
    /// 7-day weekly limit - percent used
    pub seven_day_percent: f64,
    pub seven_day_reset_at: Option<i64>,
    /// Extra usage (spend tracking for paid plans)
    pub extra_usage_spend: Option<f64>,
    pub extra_usage_limit: Option<f64>,
    pub fetched_at: String,
    pub error: Option<String>,
}
