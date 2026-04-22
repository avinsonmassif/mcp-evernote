import os from 'os';
import path from 'path';
import * as Evernote from 'evernote';
import { EvernoteAPI } from './evernote-api.js';
import { EvernoteTokenManager } from './evernoteTokenManager.js';
import { loadSeedFromEnv, loadSeedFromJson } from './evertokenConfig.js';
import { loadDeviceFromEnv } from './deviceConfig.js';
import { OAuthTokens } from './types.js';

// Default state path for non-Docker local development.
// In Docker, always set MCP_EVERNOTE_STATE_PATH to a path on a named volume.
const DEFAULT_STATE_PATH = path.join(
  os.homedir(), '.config', 'mcp-evernote-evertoken', 'state.json',
);

let tokenManager: EvernoteTokenManager | null = null;

export async function initEvertokenAuth(): Promise<void> {
  // ── Seed resolution ──────────────────────────────────────────────────────────
  // Priority 1: EVERNOTE_SEED_NRT + EVERNOTE_SEED_NCI env vars  (Docker)
  // Priority 2: seed.json file at MCP_EVERNOTE_SEED_PATH        (local dev)
  let seed;
  if (process.env.EVERNOTE_SEED_NRT && process.env.EVERNOTE_SEED_NCI) {
    seed = loadSeedFromEnv();
  } else {
    const seedPath = process.env.MCP_EVERNOTE_SEED_PATH
      ?? path.join(os.homedir(), '.config', 'mcp-evernote-evertoken', 'seed.json');
    seed = await loadSeedFromJson(seedPath);
  }

  // ── Device fingerprint ───────────────────────────────────────────────────────
  // All five fields come from env vars — no OS detection, no file writes.
  const device = loadDeviceFromEnv();

  // ── State path ───────────────────────────────────────────────────────────────
  // Must point to a Docker volume path in containerised deployments so the
  // rotating JWT refresh token survives container restarts.
  const statePath = process.env.MCP_EVERNOTE_STATE_PATH ?? DEFAULT_STATE_PATH;

  tokenManager = new EvernoteTokenManager(seed, device, statePath);
  await tokenManager.init();
  console.error(
    `Evertoken auth initialized — device: ${device.device_identifier.slice(0, 8)}… ` +
    `app_version: ${device.app_version} state: ${statePath}`,
  );
}

export async function createEvertokenAPI(): Promise<EvernoteAPI> {
  if (!tokenManager) {
    throw new Error('Evertoken auth not initialized; call initEvertokenAuth() first');
  }
  const token = await tokenManager.getMonolithToken();
  const noteStoreUrl = tokenManager.getNotestoreUrl();
  const EvernoteModule = (Evernote as any).default || Evernote;
  const client = new EvernoteModule.Client({ token, sandbox: false, china: false });
  const tokens: OAuthTokens = { token, noteStoreUrl };
  return new EvernoteAPI(client, tokens);
}
