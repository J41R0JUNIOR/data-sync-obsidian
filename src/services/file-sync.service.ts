import { Vault } from 'obsidian';
import type { SyncSummary } from '../domain/sync-summary.js';
import type { FileProvider } from '../providers/file-provider.js';

export class FileSyncService {
	constructor(private readonly fileProvider: FileProvider) {}

	async syncVault(vault: Vault, vaultBasePath: string): Promise<SyncSummary> {
		const localFiles = new Set(
			vault.getFiles().map((file) => file.path.toLowerCase()),
		);

		const remoteFiles = await (this.fileProvider.pullFiles?.(vaultBasePath) ?? this.fileProvider.listFiles(vaultBasePath));
		const imported: string[] = [];
		const skipped: string[] = [];

		for (const remoteFile of remoteFiles) {
			const safeFileName = this.toSafeMarkdownName(remoteFile.name);
			const normalizedName = safeFileName.toLowerCase();

			if (localFiles.has(normalizedName)) {
				skipped.push(remoteFile.name);
				continue;
			}

			await vault.create(safeFileName, `# ${remoteFile.name}\n\nImported from remote sync on ${new Date().toISOString()}.\n`);
			imported.push(safeFileName);
			localFiles.add(normalizedName);
		}

		return {
			totalRemoteFiles: remoteFiles.length,
			totalSynced: imported.length,
			imported,
			skipped,
		};
	}

	private toSafeMarkdownName(fileName: string): string {
		const sanitized = fileName
			.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
			.trim();

		if (!sanitized) {
			return 'remote-file.md';
		}

		if (!sanitized.toLowerCase().endsWith('.md')) {
			return `${sanitized}.md`;
		}

		return sanitized;
	}
}
