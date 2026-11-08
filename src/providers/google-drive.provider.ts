import { google } from 'googleapis';
import type { RemoteFile } from '../domain/remote-file.js';
import type { AuthProvider } from './auth-provider.js';
import type { FileProvider } from './file-provider.js';
import { GoogleAuthProvider } from './google-auth.provider.js';

export class GoogleDriveFileProvider implements FileProvider {
	constructor(private readonly authProvider: AuthProvider = new GoogleAuthProvider()) {}

	async listFiles(vaultBasePath: string): Promise<RemoteFile[]> {
		const auth = await this.authProvider.getAuth(vaultBasePath);
		const drive = google.drive({ version: 'v3', auth });
		const result = await drive.files.list({
			pageSize: 10,
			fields: 'nextPageToken, files(id, name)',
		});

		const files: Array<{ id?: string | null; name?: string | null }> = result.data.files ?? [];
		return files
			.filter((file): file is RemoteFile => Boolean(file.id && file.name))
			.map((file) => ({ id: file.id, name: file.name }));
	}

	async pullFiles(vaultBasePath: string): Promise<RemoteFile[]> {
		return this.listFiles(vaultBasePath);
	}
}
