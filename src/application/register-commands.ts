import { Plugin } from 'obsidian';
import type { GoogleAuthProvider } from '../providers/google-auth.provider.js';
import type DataSyncPlugin from '../main.js';
import type { FileSyncService } from '../services/file-sync.service.js';
import { SyncModal } from '../ui/sync-modal.js';

export function registerPluginCommands(
	plugin: DataSyncPlugin & Plugin,
	fileSyncService: FileSyncService,
	authProvider: GoogleAuthProvider,
) {
	plugin.addRibbonIcon('cloud', 'Sync remote files', async () => {
		new SyncModal(plugin.app, plugin, fileSyncService, authProvider).open();
	});

	plugin.addCommand({
		id: 'sync-remote-files',
		name: 'Sync remote files to vault',
		callback: () => {
			new SyncModal(plugin.app, plugin, fileSyncService, authProvider).open();
		},
	});
}
