// File: frontend/src/utils/passkeys.js
//
// Browser side of passkeys and the error messages shared by the sign-in and
// security screens (issue #90).
import { startRegistration, startAuthentication, browserSupportsWebAuthn } from '@simplewebauthn/browser';

// Passkeys work here when the browser supports them and the server lists
// this page's address as one they may be used at.
export function passkeysUsableHere(origins = []) {
  return browserSupportsWebAuthn() && origins.includes(window.location.origin);
}

export function passkeysSupportedByBrowser() {
  return browserSupportsWebAuthn();
}

// The browser's own errors when the user closes the prompt or the device
// refuses. Shown as "cancelled" rather than as a failure.
const isCancel = (err) => err?.name === 'NotAllowedError' || err?.name === 'AbortError'
  || err?.code === 'ERROR_CEREMONY_ABORTED';

export class PasskeyCancelled extends Error {}

async function run(fn) {
  try {
    return await fn();
  } catch (err) {
    if (isCancel(err)) throw new PasskeyCancelled(err.message);
    if (err?.code === 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED') {
      const e = new Error(err.message);
      e.code = 'passkey_exists';
      throw e;
    }
    throw err;
  }
}

export const createPasskey = (optionsJSON) => run(() => startRegistration({ optionsJSON }));
export const signInWithPasskey = (optionsJSON) => run(() => startAuthentication({ optionsJSON }));

// Translated text for an error from the security endpoints, falling back to
// the server's English message for anything unexpected.
const CODE_KEYS = {
  mfa_invalid: 'security.errors.codeInvalid',
  mfa_expired: 'security.errors.signInExpired',
  password_invalid: 'security.errors.passwordInvalid',
  mfa_required_by_policy: 'security.errors.requiredByPolicy',
  mfa_not_enabled: 'security.errors.enableOwnFirst',
  passkey_origin: 'security.errors.passkeyOrigin',
  passkey_expired: 'security.errors.passkeyExpired',
  passkey_invalid: 'security.errors.passkeyInvalid',
  passkey_exists: 'security.errors.passkeyExists',
  passkey_none: 'security.errors.passkeyNone',
  totp_setup_expired: 'security.errors.setupExpired',
};

export function securityErrorMessage(t, err) {
  if (err instanceof PasskeyCancelled) return t('security.errors.passkeyCancelled');
  if (err?.status === 429) return t('security.errors.tooManyAttempts');
  const key = CODE_KEYS[err?.code];
  return key ? t(key) : (err?.message || t('security.errors.generic'));
}
