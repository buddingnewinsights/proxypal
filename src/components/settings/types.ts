import type { AppConfig } from "../../lib/tauri";

export interface SettingsBaseProps {
	config: () => AppConfig;
	setConfig: (config: AppConfig) => void;
	saving: () => boolean;
	setSaving: (saving: boolean) => void;
	handleConfigChange: (
		key: keyof AppConfig,
		value: boolean | number | string,
	) => Promise<void>;
}
