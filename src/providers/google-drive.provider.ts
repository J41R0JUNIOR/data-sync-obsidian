import { google } from 'googleapis';
import type { drive_v3 } from 'googleapis';
import type { RemoteFile, RemoteFileContent } from '../domain/remote-file.js';
import type { RemoteFolder } from '../domain/remote-folder.js';
import type { AuthProvider } from './auth-provider.js';
import type { FileProvider } from './file-provider.js';
import { GoogleAuthProvider } from './google-auth.provider.js';

export class GoogleDriveFileProvider implements FileProvider {
	private static readonly DOWNLOAD_CONCURRENCY = 5;

	constructor(private readonly authProvider: AuthProvider = new GoogleAuthProvider()) {}

	async listFiles(vaultBasePath: string, remoteFolderId: string): Promise<RemoteFile[]> {
		const auth = await this.authProvider.getAuth(vaultBasePath);
		const drive = google.drive({ version: 'v3', auth });
		return this.listFilesInDrive(drive, remoteFolderId);
	}

	async listFolders(vaultBasePath: string, parentFolderId?: string): Promise<RemoteFolder[]> {
		const auth = await this.authProvider.getAuth(vaultBasePath);
		const drive = google.drive({ version: 'v3', auth });
		const folders: RemoteFolder[] = [];
		let pageToken: string | undefined;

		do {
			const result = await drive.files.list({
				pageSize: 1000,
				pageToken,
				q: `mimeType = 'application/vnd.google-apps.folder' and trashed = false and '${parentFolderId ?? 'root'}' in parents`,
				orderBy: 'name',
				fields: 'nextPageToken, files(id, name)',
			});

			const pageFolders: drive_v3.Schema$File[] = result.data.files ?? [];
			folders.push(
				...pageFolders
					.flatMap((folder): RemoteFolder[] =>
						folder.id && folder.name ? [{ id: folder.id, name: folder.name }] : [],
					),
			);
			pageToken = result.data.nextPageToken ?? undefined;
		} while (pageToken);

		return folders;
	}

	async *pullFiles(vaultBasePath: string, remoteFolderId: string): AsyncGenerator<RemoteFileContent> {
		const auth = await this.authProvider.getAuth(vaultBasePath);
		const drive = google.drive({ version: 'v3', auth });
		const remoteFiles = await this.listFilesInDrive(drive, remoteFolderId);

		for (let index = 0; index < remoteFiles.length; index += GoogleDriveFileProvider.DOWNLOAD_CONCURRENCY) {
			const batch = remoteFiles.slice(index, index + GoogleDriveFileProvider.DOWNLOAD_CONCURRENCY);
			const downloadedFiles = await Promise.all(batch.map((file) => this.downloadFile(drive, file)));
			for (const file of downloadedFiles) {
				yield file;
			}
		}
	}

	private async listFilesInDrive(drive: drive_v3.Drive, rootFolderId: string): Promise<RemoteFile[]> {
		const files: RemoteFile[] = [];
		const folders = [{ id: rootFolderId, path: '' }];

		for (let index = 0; index < folders.length; index++) {
			const folder = folders[index];
			if (!folder) {
				continue;
			}

			let pageToken: string | undefined;

			do {
				const result = await drive.files.list({
					pageSize: 1000,
					pageToken,
					q: `'${folder.id}' in parents and trashed = false`,
					orderBy: 'name',
					fields: 'nextPageToken, files(id, name, mimeType)',
				});
				const children = result.data.files ?? [];

				for (const child of children) {
					if (!child.id || !child.name || !child.mimeType) {
						continue;
					}

					const childPath = folder.path ? `${folder.path}/${child.name}` : child.name;
					if (child.mimeType === 'application/vnd.google-apps.folder') {
						folders.push({ id: child.id, path: childPath });
					} else {
						files.push({
							id: child.id,
							name: child.name,
							path: childPath,
							mimeType: child.mimeType,
						});
					}
				}

				pageToken = result.data.nextPageToken ?? undefined;
			} while (pageToken);
		}

		return files;
	}

	private async downloadFile(drive: drive_v3.Drive, file: RemoteFile): Promise<RemoteFileContent> {
		if (file.mimeType.startsWith('application/vnd.google-apps.')) {
			throw new Error(`Google Workspace file "${file.path}" cannot be downloaded as a vault file.`);
		}

		const response = await drive.files.get(
			{ fileId: file.id, alt: 'media' },
			{ responseType: 'stream' },
		);
		const chunks: Uint8Array[] = [];
		let totalLength = 0;

		for await (const chunk of response.data as AsyncIterable<unknown>) {
			let bytes: Uint8Array;
			if (typeof chunk === 'string') {
				bytes = new TextEncoder().encode(chunk);
			} else if (chunk instanceof Uint8Array) {
				bytes = chunk;
			} else {
				throw new Error(`Google Drive returned invalid content for "${file.path}".`);
			}

			chunks.push(bytes);
			totalLength += bytes.byteLength;
		}

		const content = new Uint8Array(totalLength);
		let offset = 0;
		for (const chunk of chunks) {
			content.set(chunk, offset);
			offset += chunk.byteLength;
		}

		return { ...file, content: content.buffer };
	}
}
