export interface RemoteFile {
	id: string;
	name: string;
	path: string;
	mimeType: string;
}

export interface RemoteFileContent extends RemoteFile {
	content: ArrayBuffer;
}
