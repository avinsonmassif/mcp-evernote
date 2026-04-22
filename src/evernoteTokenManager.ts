import fs from 'fs/promises';
import path from 'path';
import { EvertokenSeed } from './evertokenConfig.js';

export interface DeviceFingerprint {
  device_identifier: string;
  device_description: string;
  app_version: string;
  os_platform: string;
  os_release: string;
}

interface TokenState {
  access_token: string;    // S= monolith token
  refresh_token: string;   // rotates on each refresh
  notestore_url: string;
  expires_at: number;      // ms since epoch
}

const REFRESH_URL = 'https://accounts.evernote.com/auth/token';
const EXPIRY_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

function decodeJwtPayload(jwt: string): Record<string, unknown> {
  const parts = jwt.split('.');
  if (parts.length < 2) throw new Error('Invalid JWT: fewer than 2 segments');
  const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const json = Buffer.from(b64, 'base64').toString('utf-8');
  return JSON.parse(json);
}

export class EvernoteTokenManager {
  private state: TokenState | null = null;
  private inflight: Promise<void> | null = null;

  constructor(
    private seed: EvertokenSeed,
    private device: DeviceFingerprint,
    private statePath: string,
  ) {}

  async init(): Promise<void> {
    try {
      const raw = await fs.readFile(this.statePath, 'utf-8');
      const loaded = JSON.parse(raw) as TokenState;
      if (loaded.access_token && loaded.refresh_token && loaded.notestore_url && loaded.expires_at) {
        this.state = loaded;
        return;
      }
    } catch {
      // No persisted state; perform initial refresh below.
    }
    await this.refresh();
  }

  async getMonolithToken(): Promise<string> {
    if (!this.isValid()) {
      await this.ensureRefresh();
    }
    return this.state!.access_token;
  }

  getNotestoreUrl(): string {
    if (!this.state) throw new Error('Token manager not initialised; call init() first');
    return this.state.notestore_url;
  }

  async getAccessToken(): Promise<string> {
    return this.getMonolithToken();
  }

  private isValid(): boolean {
    if (!this.state) return false;
    return Date.now() + EXPIRY_BUFFER_MS < this.state.expires_at;
  }

  private async ensureRefresh(): Promise<void> {
    if (!this.inflight) {
      this.inflight = this.refresh().finally(() => {
        this.inflight = null;
      });
    }
    return this.inflight;
  }

  private async refresh(): Promise<void> {
    const currentRefreshToken = this.state?.refresh_token ?? this.seed.nrt;

    const body = {
      grant_type: 'refresh_token',
      refresh_token: currentRefreshToken,
      client_id: this.seed.nci,
      redirect_uri: 'evernote://www.evernote.com/auth/redirect',
      app_version: this.device.app_version,
      build_type: 'desktop',
      device_identifier: this.device.device_identifier,
      device_description: this.device.device_description,
      os_platform: this.device.os_platform,
      os_release: this.device.os_release,
    };

    const response = await fetch(REFRESH_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'accept': 'application/json',
        'user-agent': `evernote electron/${this.device.app_version}; ${this.device.os_platform}/${this.device.os_release};`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Token refresh failed: HTTP ${response.status} ${text}`);
    }

    const json = (await response.json()) as {
      access_token: string;
      id_token: string;
      refresh_token: string;
      expires_in: number;
    };

    const accessPayload = decodeJwtPayload(json.access_token);
    const monolithToken = (accessPayload['mono_authn_token'] as string | undefined);
    if (!monolithToken) {
      throw new Error('access_token JWT missing mono_authn_token claim');
    }

    const idPayload = decodeJwtPayload(json.id_token);
    const notestoreUrl = (idPayload['notestore_url'] as string | undefined);
    if (!notestoreUrl) {
      throw new Error('id_token JWT missing notestore_url claim');
    }

    this.state = {
      access_token: monolithToken,
      refresh_token: json.refresh_token,
      notestore_url: notestoreUrl,
      expires_at: Date.now() + json.expires_in * 1000,
    };

    await this.persist();
  }

  private async persist(): Promise<void> {
    const dir = path.dirname(this.statePath);
    await fs.mkdir(dir, { recursive: true });

    const tmp = `${this.statePath}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(this.state, null, 2), { mode: 0o600 });
    await fs.rename(tmp, this.statePath);
  }
}
