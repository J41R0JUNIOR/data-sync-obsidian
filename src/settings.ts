export interface DataSyncPluginSettings {
	providerName: string;
	oauthToken?: Record<string, unknown>;
	remoteFolderId?: string;
	remoteFolderName?: string;
}

export const DEFAULT_SETTINGS: DataSyncPluginSettings = {
	providerName: 'Google Drive',
	oauthToken: undefined,
};
