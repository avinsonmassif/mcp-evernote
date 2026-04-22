import fs from 'fs/promises';

export interface EvertokenSeed {
  nrt: string; // JWT refresh token  ("Refresh Token (JWT)" from evertoken.exe new)
  nci: string; // Evernote desktop client_id ("Client ID" from evertoken.exe new)
}

// ── Environment variable seed (Docker / any containerised deployment) ─────────

/**
 * Load the seed from EVERNOTE_SEED_NRT and EVERNOTE_SEED_NCI env vars.
 * This is the primary path for Docker deployments.
 */
export function loadSeedFromEnv(): EvertokenSeed {
  const nrt = process.env.EVERNOTE_SEED_NRT;
  const nci = process.env.EVERNOTE_SEED_NCI;
  if (!nrt || !nci) {
    throw new Error(
      'EVERNOTE_SEED_NRT and EVERNOTE_SEED_NCI are both required.\n' +
      'Run "evertoken.exe new" on your Windows machine and copy the values:\n' +
      '  EVERNOTE_SEED_NRT  ←  "Refresh Token (JWT)" line\n' +
      '  EVERNOTE_SEED_NCI  ←  "Client ID" line',
    );
  }
  return { nrt, nci };
}

// ── File-based seed (local / non-Docker development) ─────────────────────────

/**
 * Load the seed from a JSON file containing { "nrt": "...", "nci": "..." }.
 * Fallback path used when the env vars are not set.
 */
export async function loadSeedFromJson(filePath: string): Promise<EvertokenSeed> {
  let data: string;
  try {
    data = await fs.readFile(filePath, 'utf-8');
  } catch (err: any) {
    throw new Error(
      `Cannot read seed file at ${filePath}: ${err.message}\n\n` +
      'Either set EVERNOTE_SEED_NRT + EVERNOTE_SEED_NCI env vars,\n' +
      'or create a seed.json file with those values.',
    );
  }
  const parsed = JSON.parse(data) as EvertokenSeed;
  if (!parsed.nrt || !parsed.nci) {
    throw new Error(`seed.json at ${filePath} must contain "nrt" and "nci" fields`);
  }
  return parsed;
}

// ── evertoken.exe new output parser (for manual seed file creation) ───────────

function extractField(output: string, label: string): string | undefined {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Require 2+ whitespace chars after the label so "Refresh Token (JWT)"
  // doesn't accidentally match the adjacent "Refresh Token (JWT) EXP" line.
  const re = new RegExp('^' + escaped + '[ \\t]{2,}([^\\r\\n]+)', 'm');
  const match = output.match(re);
  return match?.[1]?.trim();
}

/**
 * Parse the human-readable table output produced by `evertoken.exe new`
 * and return the fields needed for seed.json / env vars.
 *
 * Example usage:
 *   const seed = parseEvertokenNewOutput(stdout);
 *   // seed.nrt → set as EVERNOTE_SEED_NRT
 *   // seed.nci → set as EVERNOTE_SEED_NCI
 */
export function parseEvertokenNewOutput(output: string): EvertokenSeed {
  const nrt = extractField(output, 'Refresh Token (JWT)');
  const nci = extractField(output, 'Client ID');
  if (!nrt) throw new Error('Could not find "Refresh Token (JWT)" in evertoken output');
  if (!nci) throw new Error('Could not find "Client ID" in evertoken output');
  return { nrt, nci };
}
