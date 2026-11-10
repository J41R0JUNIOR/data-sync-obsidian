import { App, PluginSettingTab, Setting } from 'obsidian';
import type DataSyncPlugin from '../main.js';

export class SyncSettingsTab extends PluginSettingTab {
	plugin: DataSyncPlugin;

	constructor(app: App, plugin: DataSyncPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Cloud provider')
			.setDesc('Remote storage provider used for sync.')
			.addDropdown((dropdown) =>
				dropdown
					.addOption('Google Drive', 'Google Drive')
					.setValue(this.plugin.settings.providerName)
					.onChange(async (value) => {
						this.plugin.settings.providerName = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
