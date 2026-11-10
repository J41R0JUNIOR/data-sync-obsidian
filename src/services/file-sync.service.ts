import { Vault } from 'obsidian';
import type { RemoteFolder } from '../domain/remote-folder.js';
import type { SyncSummary } from '../domain/sync-summary.js';
import type { FileProvider } from '../providers/file-provider.js';

const IMPORT_BATCH_SIZE = 10;
const MAX_PENDING_IMPORT_BATCHES = 2;

export class FileSyncService {
	constructor(private readonly fileProvider: FileProvider) {}

	async listRemoteFolders(vaultBasePath: string, parentFolderId?: string): Promise<RemoteFolder[]> {
		return this.fileProvider.listFolders(vaultBasePath, parentFolderId);
	}

	async syncVault(vault: Vault, vaultBasePath: string, remoteFolderId: string): Promise<SyncSummary> {
		const localFiles = new Set(
			vault.getFiles().map((file) => file.path.toLowerCase()),
		);

		const imported: string[] = [];
		const skipped: string[] = [];
		const failed: string[] = [];
		const pendingBatches: Promise<void>[] = [];
		let totalRemoteFiles = 0;
		let filesToImport: Array<{ path: string; content: ArrayBuffer }> = [];

		const scheduleImportBatch = () => {
			if (filesToImport.length === 0) {
				return;
			}
			const batch = filesToImport;
			filesToImport = [];
			pendingBatches.push(this.importBatch(vault, batch, imported, skipped, failed));
		};

		try {
			for await (const remoteFile of this.fileProvider.pullFiles(vaultBasePath, remoteFolderId)) {
				totalRemoteFiles++;
				try {
					const safePath = this.toSafeVaultPath(remoteFile.path);
					const normalizedPath = safePath.toLowerCase();
					if (localFiles.has(normalizedPath) || await vault.adapter.stat(safePath)) {
						skipped.push(safePath);
						localFiles.add(normalizedPath);
						continue;
					}

					if (!await this.ensureParentFolders(vault, safePath)) {
						skipped.push(safePath);
						localFiles.add(normalizedPath);
						continue;
					}

					filesToImport.push({ path: safePath, content: remoteFile.content });
					localFiles.add(normalizedPath);
					if (filesToImport.length >= IMPORT_BATCH_SIZE) {
						scheduleImportBatch();
						if (pendingBatches.length >= MAX_PENDING_IMPORT_BATCHES) {
							await pendingBatches.shift();
						}
					}
				} catch (error) {
					console.error(`Preparing remote file "${remoteFile.path}" failed`, error);
					failed.push(remoteFile.path);
				}
			}
		} catch (error) {
			await Promise.all(pendingBatches);
			throw error;
		}

		scheduleImportBatch();
		await Promise.all(pendingBatches);

		return {
			totalRemoteFiles,
			totalSynced: imported.length,
			imported,
			skipped,
			failed,
		};
	}

	private async importBatch(
		vault: Vault,
		batch: Array<{ path: string; content: ArrayBuffer }>,
		imported: string[],
		skipped: string[],
		failed: string[],
	): Promise<void> {
		const results = await Promise.allSettled(
			batch.map((file) => vault.createBinary(file.path, file.content)),
		);

		for (const [batchIndex, result] of results.entries()) {
			const file = batch[batchIndex];
			if (!file) {
				continue;
			}

			if (result.status === 'fulfilled') {
				imported.push(file.path);
				continue;
			}

			if (await vault.adapter.stat(file.path)) {
				skipped.push(file.path);
				continue;
			}

			console.error(`Importing remote file "${file.path}" failed`, result.reason);
			failed.push(file.path);
		}
	}

	private async ensureParentFolders(vault: Vault, filePath: string): Promise<boolean> {
		const pathSegments = filePath.split('/');
		pathSegments.pop();
		let parentPath = '';

		for (const segment of pathSegments) {
			parentPath = parentPath ? `${parentPath}/${segment}` : segment;
			const existingFolder = await vault.adapter.stat(parentPath);
			if (existingFolder?.type === 'folder') {
				continue;
			}
			if (existingFolder?.type === 'file') {
				return false;
			}

			try {
				await vault.adapter.mkdir(parentPath);
			} catch (error) {
				const folderAfterCreate = await vault.adapter.stat(parentPath);
				if (folderAfterCreate?.type === 'folder') {
					continue;
				}
				if (folderAfterCreate?.type === 'file') {
					return false;
				}
				throw error;
			}
		}

		return true;
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
