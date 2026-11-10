import { TFolder, Vault } from 'obsidian';
import type { RemoteFolder } from '../domain/remote-folder.js';
import type { SyncSummary } from '../domain/sync-summary.js';
import type { FileProvider } from '../providers/file-provider.js';

export class FileSyncService {
	constructor(private readonly fileProvider: FileProvider) {}

	async listRemoteFolders(vaultBasePath: string, parentFolderId?: string): Promise<RemoteFolder[]> {
		return this.fileProvider.listFolders(vaultBasePath, parentFolderId);
	}

	async syncVault(vault: Vault, vaultBasePath: string, remoteFolderId: string): Promise<SyncSummary> {
		const localFiles = new Set(
			vault.getFiles().map((file) => file.path.toLowerCase()),
		);

		const remoteFiles = await this.fileProvider.pullFiles(vaultBasePath, remoteFolderId);
		const imported: string[] = [];
		const skipped: string[] = [];

		for (const remoteFile of remoteFiles) {
			const safePath = this.toSafeVaultPath(remoteFile.path);
			const normalizedPath = safePath.toLowerCase();

			if (localFiles.has(normalizedPath)) {
				skipped.push(safePath);
				continue;
			}

			const pathSegments = safePath.split('/');
			const fileName = pathSegments.pop();
			if (!fileName) {
				throw new Error(`Remote file has an invalid path: ${remoteFile.path}`);
			}

			let parentPath = '';
			for (const segment of pathSegments) {
				parentPath = parentPath ? `${parentPath}/${segment}` : segment;
				const existingFolder = vault.getAbstractFileByPath(parentPath);
				if (!existingFolder) {
					await vault.adapter.mkdir(parentPath);
				} else if (!(existingFolder instanceof TFolder)) {
					throw new Error(`Cannot create remote file because "${parentPath}" is not a folder.`);
				}
			}

			await vault.createBinary(safePath, remoteFile.content);
			imported.push(safePath);
			localFiles.add(normalizedPath);
		}

		return {
			totalRemoteFiles: remoteFiles.length,
			totalSynced: imported.length,
			imported,
			skipped,
		};
	}

	private toSafeVaultPath(remotePath: string): string {
		const segments = remotePath
			.split('/')
			.map((segment) =>
				Array.from(segment, (character) =>
					/[<>:"/\\|?*]/.test(character) || character.charCodeAt(0) < 32 ? '_' : character,
				)
					.join('')
					.trim(),
			)
			.filter(Boolean);

		if (segments.length === 0 || segments.some((segment) => segment === '.' || segment === '..')) {
			throw new Error(`Remote file has an invalid path: ${remotePath}`);
		}

		return segments.join('/');
	}
}
