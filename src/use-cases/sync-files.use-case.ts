import type { RemoteFileContent } from '../domain/remote-file.js';
import type { FileProvider } from '../providers/file-provider.js';

export class SyncFilesUseCase {
	constructor(private readonly fileProvider: FileProvider) {}

	async execute(vaultBasePath: string, remoteFolderId: string): Promise<RemoteFileContent[]> {
		return this.fileProvider.pullFiles(vaultBasePath, remoteFolderId);
	}
}
