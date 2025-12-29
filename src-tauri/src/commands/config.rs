//! Configuration commands for Tauri IPC.
 
use std::fs;
use tauri::State;
use crate::config::{AppConfig, save_config_to_file};
use crate::state::AppState;

#[tauri::command]
pub fn get_config(state: State<AppState>) -> AppConfig {
    let config = state.config.lock().unwrap().clone();
    eprintln!("[ProxyPal Debug] Loading {} custom providers", config.amp_openai_providers.len());
    for (i, provider) in config.amp_openai_providers.iter().enumerate() {
        eprintln!("[ProxyPal Debug] Provider {}: {} with {} models", i, provider.name, provider.models.len());
        for (j, model) in provider.models.iter().enumerate() {
            eprintln!("[ProxyPal Debug]   Model {}: {}", j, model.name);
        }
    }
    config
}

#[tauri::command]
pub fn save_config(state: State<AppState>, config: AppConfig) -> Result<(), String> {
    // Debug: Log provider models before save
    eprintln!("[ProxyPal Debug] Saving {} custom providers", config.amp_openai_providers.len());
    for (i, provider) in config.amp_openai_providers.iter().enumerate() {
        eprintln!("[ProxyPal Debug] Provider {}: {} with {} models", i, provider.name, provider.models.len());
        for (j, model) in provider.models.iter().enumerate() {
            eprintln!("[ProxyPal Debug]   Model {}: {}", j, model.name);
        }
    }

    let mut current_config = state.config.lock().unwrap();
    *current_config = config.clone();
    save_config_to_file(&config)?;

    eprintln!("[ProxyPal Debug] Config saved successfully");
    Ok(())
}

#[allow(dead_code)]
fn update_proxy_config_yaml(app_config: &AppConfig) -> Result<(), String> {
    let config_dir = dirs::config_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("proxypal");
    
    std::fs::create_dir_all(&config_dir).map_err(|e| format!("Failed to create config dir: {}", e))?;
    
    let proxy_config_path = config_dir.join("proxy-config.yaml");
    
    // Read existing config or start with default
    let mut existing_yaml = if proxy_config_path.exists() {
        std::fs::read_to_string(&proxy_config_path)
            .map_err(|e| format!("Failed to read proxy config: {}", e))?
    } else {
        String::new()
    };
    
    // Update routing strategy
    let routing_line = format!("  strategy: \"{}\"", app_config.routing_strategy);
    
    if existing_yaml.contains("routing:") {
        // Replace existing routing strategy
        existing_yaml = regex::Regex::new(r#"  strategy: "[^"]*""#)
            .map_err(|e| format!("Failed to compile regex: {}", e))?
            .replace(&existing_yaml, &routing_line)
            .to_string();
    } else if !existing_yaml.is_empty() {
        // Append routing section if config exists but no routing
        existing_yaml.push_str(&format!("\nrouting:\n  strategy: \"{}\"\n", app_config.routing_strategy));
    }
    
    std::fs::write(&proxy_config_path, existing_yaml)
        .map_err(|e| format!("Failed to write proxy config: {}", e))
    
}

#[tauri::command]
pub fn get_config_yaml() -> Result<String, String> {
    let config_dir = dirs::config_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("proxypal");
    
    // Read from custom config file (user edits)
    let custom_config_path = config_dir.join("proxy-config-custom.yaml");
    
    if !custom_config_path.exists() {
        // Return empty string if no custom config exists yet
        return Ok(String::new());
    }
    
    fs::read_to_string(&custom_config_path)
        .map_err(|e| format!("Failed to read custom config YAML: {}", e))
}

#[tauri::command]
pub fn save_config_yaml(yaml: String) -> Result<(), String> {
    let config_dir = dirs::config_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("proxypal");
    fs::create_dir_all(&config_dir).map_err(|e| format!("Failed to create config dir: {}", e))?;
    
    // Save to custom config file (preserved across restarts)
    let custom_config_path = config_dir.join("proxy-config-custom.yaml");
    fs::write(&custom_config_path, yaml)
        .map_err(|e| format!("Failed to save custom config YAML: {}", e))
}

#[tauri::command]
pub fn reload_config(state: State<AppState>) -> Result<AppConfig, String> {
    // Reload config from disk
    let fresh_config = crate::config::load_config();
    
    // Update the in-memory state
    let mut current_config = state.config.lock().unwrap();
    *current_config = fresh_config.clone();
    
    eprintln!("[ProxyPal Debug] Config reloaded from disk");
    Ok(fresh_config)
}
