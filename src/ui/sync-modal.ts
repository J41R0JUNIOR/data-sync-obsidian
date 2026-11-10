import { App, ButtonComponent, Modal, Notice, Setting } from 'obsidian';
import type { GoogleAuthProvider } from '../providers/google-auth.provider.js';
import type DataSyncPlugin from '../main.js';
import type { FileSyncService } from '../services/file-sync.service.js';
import { RemoteFolderPickerModal } from './remote-folder-picker-modal.js';

export class SyncModal extends Modal {
	constructor(
		app: App,
		private readonly plugin: DataSyncPlugin,
		private readonly fileSyncService: FileSyncService,
		private readonly authProvider: GoogleAuthProvider,
	) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl('h2', { text: 'Remote sync' });

		new Setting(contentEl)
			.setName('Cloud provider')
			.setDesc('Provider used for synchronization.')
			.addDropdown((dropdown) =>
				dropdown
					.addOption('Google Drive', 'Google Drive')
					.setValue(this.plugin.settings.providerName)
					.onChange(async (value) => {
						this.plugin.settings.providerName = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(contentEl)
			.setName('Vault folder on Google Drive')
			.setDesc(this.plugin.settings.remoteFolderName ?? 'No folder selected.')
			.addButton((button) => {
				button.setButtonText('Choose folder').onClick(() => {
					const vaultBasePath = this.getVaultBasePath();
					if (!vaultBasePath) {
						new Notice('Vault path not available.');
						return;
					}

					new RemoteFolderPickerModal(
						this.app,
						this.fileSyncService,
						vaultBasePath,
						async (folder) => {
							this.plugin.settings.remoteFolderId = folder.id;
							this.plugin.settings.remoteFolderName = folder.name;
							await this.plugin.saveSettings();
							new Notice(`Google Drive folder selected: ${folder.name}`);
							this.onOpen();
						},
					).open();
				});
			});

		new Setting(contentEl)
			.addButton((button: ButtonComponent) => {
				button.setButtonText('Authorize with Google').onClick(async () => {
					await this.authorizeGoogle();
				});
			})
			.addButton((button: ButtonComponent) => {
				button
					.setButtonText('Sync now')
					.onClick(async () => {
						await this.syncNow();
					});
			})
	}

	async authorizeGoogle() {
		const vaultBasePath = this.getVaultBasePath();
		if (!vaultBasePath) {
			new Notice('Vault path not available.');
			return;
		}

		try {
			const client = await this.authProvider.authorize?.(vaultBasePath);
			if (!client) {
				throw new Error('Google auth provider does not support authorization.');
			}
			this.plugin.settings.oauthToken = client.credentials as Record<string, unknown>;
			await this.plugin.saveSettings();
			new Notice('Google Drive authorization completed.');
		} catch (error) {
			console.error('Google authorization failed', error);
			new Notice('Google authorization failed.');
		}
	}

	async syncNow() {
		const vaultBasePath = this.getVaultBasePath();
		if (!vaultBasePath) {
			new Notice('Vault path not available.');
			return;
		}

		const remoteFolderId = this.plugin.settings.remoteFolderId;
		if (!remoteFolderId) {
			new Notice('Choose your Google Drive vault folder before syncing.');
			return;
		}

		try {
			const result = await this.fileSyncService.syncVault(this.app.vault, vaultBasePath, remoteFolderId);
			if (result.imported.length === 0) {
				new Notice(`No new remote files to import. ${result.skipped.length} already present.`);
				return;
			}

			new Notice(`Imported ${result.imported.length} file(s): ${result.imported.join(', ')}`);
		} catch (error) {
			console.error('Remote sync failed', error);
			const reason = error instanceof Error ? error.message : String(error);
			new Notice(`Failed to sync remote files: ${reason}`);
		}
	}

	private getVaultBasePath(): string | undefined {
		const adapter = this.app.vault.adapter;
		if (!('getBasePath' in adapter) || typeof adapter.getBasePath !== 'function') {
			return undefined;
		}

		const basePath = (adapter.getBasePath as () => unknown).call(adapter);
		return typeof basePath === 'string' && basePath.length > 0 ? basePath : undefined;
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
