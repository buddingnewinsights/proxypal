use serde::{Deserialize, Serialize};

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
    #[serde(default)]
    pub providers: Vec<ProviderUsage>,
    #[serde(default)]
    pub requests_by_day: Vec<TimeSeriesPoint>,
    #[serde(default)]
    pub tokens_by_day: Vec<TimeSeriesPoint>,
    #[serde(default)]
    pub requests_by_hour: Vec<TimeSeriesPoint>,
    #[serde(default)]
    pub tokens_by_hour: Vec<TimeSeriesPoint>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimeSeriesPoint {
    pub label: String,
    pub value: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelUsage {
    pub model: String,
    pub requests: u64,
    pub tokens: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderUsage {
    pub provider: String,
    pub requests: u64,
    pub tokens: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ModelStats {
    pub requests: u64,
    pub success_count: u64,
    pub tokens: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Aggregate {
    pub created_at: u64,
    pub total_requests: u64,
    pub total_success_count: u64,
    pub total_failure_count: u64,
    pub total_tokens_in: u64,
    pub total_tokens_out: u64,
    pub total_cost_usd: f64,
    #[serde(default)]
    pub requests_by_day: Vec<TimeSeriesPoint>,
    #[serde(default)]
    pub tokens_by_day: Vec<TimeSeriesPoint>,
    #[serde(default)]
    pub model_stats: std::collections::HashMap<String, ModelStats>,
    #[serde(default)]
    pub provider_stats: std::collections::HashMap<String, ModelStats>,
}

impl Default for Aggregate {
    fn default() -> Self {
        Self {
            created_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64,
            total_requests: 0,
            total_success_count: 0,
            total_failure_count: 0,
            total_tokens_in: 0,
            total_tokens_out: 0,
            total_cost_usd: 0.0,
            requests_by_day: vec![],
            tokens_by_day: vec![],
            model_stats: std::collections::HashMap::new(),
            provider_stats: std::collections::HashMap::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct RequestHistory {
    pub requests: Vec<RequestLog>,
    pub total_tokens_in: u64,
    pub total_tokens_out: u64,
    pub total_cost_usd: f64,
    #[serde(default)]
    pub tokens_by_day: Vec<TimeSeriesPoint>,
    #[serde(default)]
    pub tokens_by_hour: Vec<TimeSeriesPoint>,
    #[serde(default)]
    pub total_request_count: u64,  // Actual total requests (not capped at 500)
    #[serde(default)]
    pub total_success_count: u64,  // Successful requests (status < 400) across all history
}
