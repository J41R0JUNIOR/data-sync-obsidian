export interface AuthProvider<TAuth = unknown> {
	getAuth(vaultBasePath: string): Promise<TAuth>;
	authorize?(vaultBasePath: string): Promise<TAuth>;
	buildAuthUrl?(vaultBasePath: string): Promise<string>;
}
