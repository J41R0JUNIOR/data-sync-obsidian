import type { RemoteFile } from '../domain/remote-file.js';
import type { FileProvider } from '../providers/file-provider.js';

export class SyncFilesUseCase {
	constructor(private readonly fileProvider: FileProvider) {}

	async execute(vaultBasePath: string): Promise<RemoteFile[]> {
		return this.fileProvider.pullFiles
			? this.fileProvider.pullFiles(vaultBasePath)
			: this.fileProvider.listFiles(vaultBasePath);
	}
}
