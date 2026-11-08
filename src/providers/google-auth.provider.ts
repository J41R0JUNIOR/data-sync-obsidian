import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import { OAuth2Client } from 'google-auth-library';
import type { AuthProvider } from './auth-provider.js';

const SCOPES = ['https://www.googleapis.com/auth/drive.metadata.readonly'];
const CREDENTIALS_PATH = '.obsidian/plugins/data-sync-obsidian/credentials.json';
const DATA_PATH = '.obsidian/plugins/data-sync-obsidian/data.json';

export class GoogleAuthProvider implements AuthProvider<OAuth2Client> {
	private readonly redirectHost = '127.0.0.1';
	private readonly defaultRedirectUri = `http://${this.redirectHost}:3000`;
	private readonly port = 3000;

	async getAuth(vaultBasePath: string): Promise<OAuth2Client> {
		const client = this.createClient(vaultBasePath);
		const token = this.loadToken(vaultBasePath);
		if (!token) {
			throw new Error('Google Drive is not authorized yet. Use "Authorize with Google" first.');
		}

		client.setCredentials(token as any);
		return client;
	}

	async authorize(vaultBasePath: string): Promise<OAuth2Client> {
		const redirectUri = this.getRedirectUri(vaultBasePath);
		const client = new OAuth2Client({
			clientId: this.getClientConfig(vaultBasePath).client_id,
			clientSecret: this.getClientConfig(vaultBasePath).client_secret,
			redirectUri,
		});
		const authUrl = client.generateAuthUrl({
			access_type: 'offline',
			scope: SCOPES,
			prompt: 'consent',
			redirect_uri: redirectUri,
			include_granted_scopes: true,
		});

		const code = await this.waitForAuthorizationCode(authUrl);
		const { tokens } = await client.getToken(code);
		client.setCredentials(tokens);
		await this.storeToken(vaultBasePath, tokens);
		return client;
	}

	async buildAuthUrl(vaultBasePath: string): Promise<string> {
		const redirectUri = this.getRedirectUri(vaultBasePath);
		const client = new OAuth2Client({
			clientId: this.getClientConfig(vaultBasePath).client_id,
			clientSecret: this.getClientConfig(vaultBasePath).client_secret,
			redirectUri,
		});
		return client.generateAuthUrl({
			access_type: 'offline',
			scope: SCOPES,
			prompt: 'consent',
			redirect_uri: redirectUri,
			include_granted_scopes: true,
		});
	}

	private createClient(vaultBasePath: string): OAuth2Client {
		const config = this.getClientConfig(vaultBasePath);
		const redirectUri = this.resolveRedirectUri(config.redirect_uris);
		return new OAuth2Client({
			clientId: config.client_id,
			clientSecret: config.client_secret,
			redirectUri,
		});
	}

	private loadToken(vaultBasePath: string): any | undefined {
		const dataFilePath = path.resolve(vaultBasePath, DATA_PATH);
		if (!fs.existsSync(dataFilePath)) {
			return undefined;
		}

		const raw = fs.readFileSync(dataFilePath, 'utf8');
		const data = JSON.parse(raw) as { oauthToken?: Record<string, unknown> };
		return data.oauthToken;
	}

	private async storeToken(vaultBasePath: string, token: any) {
		const dataFilePath = path.resolve(vaultBasePath, DATA_PATH);
		const existing = fs.existsSync(dataFilePath)
			? (JSON.parse(fs.readFileSync(dataFilePath, 'utf8')) as Record<string, unknown>)
			: {};

		const nextData = {
			...existing,
			oauthToken: token,
		};

		fs.writeFileSync(dataFilePath, JSON.stringify(nextData, null, 2));
	}

	private getClientConfig(vaultBasePath: string): {
		client_id: string;
		client_secret: string;
		redirect_uris?: string[];
	} {
		const credentialsPath = path.resolve(vaultBasePath, CREDENTIALS_PATH);
		if (!fs.existsSync(credentialsPath)) {
			throw new Error('Google Drive credentials.json is missing.');
		}

		const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8')) as {
			installed?: { client_id?: string; client_secret?: string; redirect_uris?: string[] };
			web?: { client_id?: string; client_secret?: string; redirect_uris?: string[] };
		};

		const clientConfig = credentials.installed ?? credentials.web;
		if (!clientConfig?.client_id || !clientConfig.client_secret) {
			throw new Error('Google OAuth client is missing client_id or client_secret.');
		}

		return {
			client_id: clientConfig.client_id,
			client_secret: clientConfig.client_secret,
			redirect_uris: clientConfig.redirect_uris,
		};
	}

	private getRedirectUri(vaultBasePath: string): string {
		return this.resolveRedirectUri(this.getClientConfig(vaultBasePath).redirect_uris);
	}

	private resolveRedirectUri(redirectUris?: string[]): string {
		const normalized = (redirectUris ?? []).map((uri) => this.normalizeRedirectUri(uri));
		const preferred = normalized.find((uri) => uri.includes('127.0.0.1'))
			?? normalized.find((uri) => uri.includes('localhost'))
			?? this.defaultRedirectUri;
		return preferred;
	}

	private normalizeRedirectUri(uri: string): string {
		try {
			const parsed = new URL(uri);
			if (!parsed.port) {
				parsed.port = String(this.port);
			}
			return parsed.origin;
		} catch {
			return `${this.defaultRedirectUri}`;
		}
	}

	private waitForAuthorizationCode(authUrl: string): Promise<string> {
		return new Promise((resolve, reject) => {
			const server = http.createServer((req, res) => {
				const requestUrl = new URL(req.url ?? '/', `http://${this.redirectHost}:3000`);
				const code = requestUrl.searchParams.get('code');
				if (code) {
					res.writeHead(200, { 'Content-Type': 'text/html' });
					res.end('<html><body><p>Google authorization successful. You can close this window.</p></body></html>');
					server.close();
					resolve(code);
					return;
				}

				res.writeHead(400, { 'Content-Type': 'text/plain' });
				res.end('Missing authorization code.');
				server.close();
				reject(new Error('Google authorization code was not returned.'));
			});

			server.on('error', (error) => {
				reject(error);
			});

			server.listen(this.port, this.redirectHost, () => {
				const opener = globalThis.open ?? window.open;
				if (typeof opener === 'function') {
					opener(authUrl, '_blank');
				} else {
					console.warn('Automatic browser open is not available in this environment. Open this URL manually:', authUrl);
				}
			});

			setTimeout(() => {
				server.close();
				reject(new Error('Timed out waiting for Google authorization.'));
			}, 120000);
		});
	}
}
