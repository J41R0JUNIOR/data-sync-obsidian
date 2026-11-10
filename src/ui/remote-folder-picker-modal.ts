import { App, Modal, Notice, Setting } from 'obsidian';
import type { RemoteFolder } from '../domain/remote-folder.js';
import type { FileSyncService } from '../services/file-sync.service.js';

export class RemoteFolderPickerModal extends Modal {
	private readonly breadcrumb: RemoteFolder[] = [];

	constructor(
		app: App,
		private readonly fileSyncService: FileSyncService,
		private readonly vaultBasePath: string,
		private readonly onSelect: (folder: RemoteFolder) => Promise<void>,
	) {
		super(app);
	}

	onOpen() {
		void this.render();
	}

	private async render() {
		const { contentEl } = this;
		contentEl.empty();
		const pathEl = contentEl.createDiv({ cls: 'remote-folder-picker-path' });
		pathEl.createSpan({ text: 'Path: ' });
		pathEl.createEl('span', {
			text: `${this.breadcrumb.map((folder) => `/${folder.name}`).join('')}`,
		});

		const currentFolder = this.breadcrumb[this.breadcrumb.length - 1] ?? {
			id: 'root',
			name: 'My Drive',
		};
		const currentFolderSetting = new Setting(contentEl);
		if (this.breadcrumb.length > 0) {
			currentFolderSetting.addButton((button) =>
				button.setButtonText('<-').onClick(() => {
					this.breadcrumb.pop();
					void this.render();
				}),
			);
		}
		currentFolderSetting.addButton((button) =>
			button.setButtonText('This place').onClick(async () => {
				try {
					await this.onSelect(currentFolder);
					this.close();
				} catch (error) {
					console.error('Saving selected Google Drive folder failed', error);
					new Notice('Failed to save the selected Google Drive folder.');
				}
			}),
		);

		const folderListEl = contentEl.createDiv();

		try {
			const parentFolderId = this.breadcrumb[this.breadcrumb.length - 1]?.id;
			const folders = await this.fileSyncService.listRemoteFolders(this.vaultBasePath, parentFolderId);
			folderListEl.empty();

			if (folders.length === 0) {
				folderListEl.setText('No folders found in this location.');
				return;
			}

			for (const folder of folders) {
				const folderSetting = new Setting(folderListEl).setName(folder.name);
				folderSetting.nameEl.setAttribute('role', 'button');
				folderSetting.nameEl.setAttribute('tabindex', '0');
				folderSetting.nameEl.addEventListener('click', () => {
					this.breadcrumb.push(folder);
					void this.render();
				});
				folderSetting.nameEl.addEventListener('keydown', (event) => {
					if (event.key === 'Enter' || event.key === ' ') {
						event.preventDefault();
						this.breadcrumb.push(folder);
						void this.render();
					}
				});
			}
		} catch (error) {
			console.error('Loading Google Drive folders failed', error);
			folderListEl.setText('Failed to load Google Drive folders.');
			new Notice('Failed to load Google Drive folders.');
		}
	}

	onClose() {
		this.contentEl.empty();
	}
}
