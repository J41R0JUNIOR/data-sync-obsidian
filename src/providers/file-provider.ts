import type { RemoteFileContent } from '../domain/remote-file.js';
import type { RemoteFolder } from '../domain/remote-folder.js';

export interface FileProvider {
	listFolders(vaultBasePath: string, parentFolderId?: string): Promise<RemoteFolder[]>;
	pullFiles(vaultBasePath: string, remoteFolderId: string): AsyncIterable<RemoteFileContent>;
}
