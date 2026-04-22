import { DeviceFingerprint } from './evernoteTokenManager.js';

/**
 * Load the Evernote desktop device fingerprint entirely from environment variables.
 * No OS detection, no file I/O — safe for Docker containers.
 *
 * Required:
 *   EVERNOTE_DEVICE_ID          — stable UUID per deployment, generate once:
 *                                  node -e "console.log(require('crypto').randomUUID())"
 *
 * Optional (defaults mimic a Windows desktop client, which matches where
 * evertoken.exe extracts tokens from):
 *   EVERNOTE_DEVICE_DESCRIPTION — default: "Computer"
 *   EVERNOTE_APP_VERSION        — default: "11.12.2"
 *   EVERNOTE_OS_PLATFORM        — default: "win32"
 *   EVERNOTE_OS_RELEASE         — default: "10.0"
 */
export function loadDeviceFromEnv(): DeviceFingerprint {
  const deviceId = process.env.EVERNOTE_DEVICE_ID;
  if (!deviceId) {
    throw new Error(
      'EVERNOTE_DEVICE_ID is required when EVERNOTE_AUTH_MODE=evertoken.\n' +
      'Generate a stable UUID once and add it to your env config:\n' +
      "  node -e \"console.log(require('crypto').randomUUID())\"",
    );
  }
  return {
    device_identifier: deviceId,
    device_description: process.env.EVERNOTE_DEVICE_DESCRIPTION ?? 'Computer',
    app_version:        process.env.EVERNOTE_APP_VERSION        ?? '11.12.2',
    os_platform:        process.env.EVERNOTE_OS_PLATFORM        ?? 'win32',
    os_release:         process.env.EVERNOTE_OS_RELEASE         ?? '10.0',
  };
}
