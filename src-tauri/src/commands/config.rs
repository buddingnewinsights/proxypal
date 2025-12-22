//! Configuration commands for Tauri IPC.

use std::fs;
use tauri::State;
use crate::config::{AppConfig, save_config_to_file};
use crate::state::AppState;

#[tauri::command]
pub fn get_config(state: State<AppState>) -> AppConfig {
    state.config.lock().unwrap().clone()
}

#[tauri::command]
pub fn save_config(state: State<AppState>, config: AppConfig) -> Result<(), String> {
    let mut current_config = state.config.lock().unwrap();
    *current_config = config.clone();
    save_config_to_file(&config)
}

#[tauri::command]
pub fn get_config_yaml() -> Result<String, String> {
    let config_dir = dirs::config_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("proxypal");
    let proxy_config_path = config_dir.join("proxy-config.yaml");
    
    if !proxy_config_path.exists() {
        return Ok(String::new());
    }
    
    fs::read_to_string(&proxy_config_path)
        .map_err(|e| format!("Failed to read config YAML: {}", e))
}

#[tauri::command]
pub fn save_config_yaml(yaml: String) -> Result<(), String> {
    let config_dir = dirs::config_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("proxypal");
    fs::create_dir_all(&config_dir).map_err(|e| format!("Failed to create config dir: {}", e))?;
    
    let proxy_config_path = config_dir.join("proxy-config.yaml");
    fs::write(&proxy_config_path, yaml)
        .map_err(|e| format!("Failed to save config YAML: {}", e))
}
