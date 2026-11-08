export interface DataSyncPluginSettings {
	providerName: string;
	autoSync: boolean;
	oauthToken?: Record<string, unknown>;
}

export const DEFAULT_SETTINGS: DataSyncPluginSettings = {
	providerName: 'Google Drive',
	autoSync: true,
	oauthToken: undefined,
};
