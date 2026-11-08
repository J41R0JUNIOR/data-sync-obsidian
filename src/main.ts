import { Plugin } from 'obsidian';
import { registerPluginCommands } from './application/register-commands.js';
import { GoogleAuthProvider } from './providers/google-auth.provider.js';
import { GoogleDriveFileProvider } from './providers/google-drive.provider.js';
import { DEFAULT_SETTINGS, DataSyncPluginSettings } from './settings.js';
import { FileSyncService } from './services/file-sync.service.js';
import { SyncSettingsTab } from './ui/sync-settings-tab.js';

export default class DataSyncPlugin extends Plugin {
	settings!: DataSyncPluginSettings;

	async onload() {
		await this.loadSettings();

		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Cloud sync ready');

		const authProvider = new GoogleAuthProvider();
		const fileSyncService = new FileSyncService(
			new GoogleDriveFileProvider(authProvider),
		);
		registerPluginCommands(this, fileSyncService, authProvider);
		this.addSettingTab(new SyncSettingsTab(this.app, this));
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<DataSyncPluginSettings>,
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
