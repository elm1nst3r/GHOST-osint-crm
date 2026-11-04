// File: backend/services/passkeys.js
//
// Passkeys as a second sign-in step (issue #90), on @simplewebauthn/server.
//
// A passkey belongs to one domain name. Which addresses qualify comes from
// FRONTEND_URL / PASSKEY_ORIGINS (utils/twoFactor.js passkeyOrigins), and the
// browser's Origin header picks one per request. Each stored passkey records
// its domain, so sign-in only offers passkeys made at the address in use.
//
// The WebAuthn challenge lives in the session for CHALLENGE_TTL_MS and is
// removed on first use, whatever the outcome.
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');
const { resolvePasskeyOrigin } = require('../utils/twoFactor');
const { passkeysFor } = require('./accountSecurity');

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

class PasskeyError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

function originFor(req) {
  const origin = resolvePasskeyOrigin(req.headers.origin);
  if (!origin) {
    throw new PasskeyError(
      'Passkeys are not available at this address. They need HTTPS with a domain name (or localhost), set in FRONTEND_URL or PASSKEY_ORIGINS.',
      'passkey_origin'
    );
  }
  return origin;
}

function rememberChallenge(req, purpose, options, origin) {
  req.session.webauthn = { purpose, challenge: options.challenge, origin: origin.origin, rpID: origin.rpID, at: Date.now() };
}

// One use only, and only for the purpose and address it was made for.
function takeChallenge(req, purpose) {
  const pending = req.session.webauthn;
  delete req.session.webauthn;
  if (!pending || pending.purpose !== purpose || Date.now() - pending.at > CHALLENGE_TTL_MS) {
    throw new PasskeyError('The passkey request expired. Try again.', 'passkey_expired');
  }
  if (pending.origin !== originFor(req).origin) {
    throw new PasskeyError('The passkey request came from a different address.', 'passkey_origin');
  }
  return pending;
}

const descriptor = (p) => ({ id: p.credential_id, transports: p.transports?.length ? p.transports : undefined });

async function registrationOptions(req, db, user, rpName) {
  const origin = originFor(req);
  const existing = (await passkeysFor(db, user.id)).filter((p) => p.rp_id === origin.rpID);
  const options = await generateRegistrationOptions({
    rpName,
    rpID: origin.rpID,
    userName: user.username,
    userDisplayName: [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username,
    userID: Buffer.from(`ghost-user-${user.id}`),
    attestationType: 'none',
    excludeCredentials: existing.map(descriptor),
    authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
  });
  rememberChallenge(req, 'register', options, origin);
  return options;
}

async function verifyRegistration(req, response) {
  const pending = takeChallenge(req, 'register');
  let result;
  try {
    result = await verifyRegistrationResponse({
      response,
      expectedChallenge: pending.challenge,
      expectedOrigin: pending.origin,
      expectedRPID: pending.rpID,
      requireUserVerification: false,
    });
  } catch (err) {
    throw new PasskeyError(`The passkey could not be verified: ${err.message}`, 'passkey_invalid');
  }
  if (!result.verified || !result.registrationInfo) throw new PasskeyError('The passkey could not be verified.', 'passkey_invalid');
  const { credential, credentialDeviceType, credentialBackedUp } = result.registrationInfo;
  return {
    credential_id: credential.id,
    public_key: Buffer.from(credential.publicKey),
    counter: credential.counter || 0,
    transports: credential.transports || response.response?.transports || [],
    rp_id: pending.rpID,
    device_type: credentialDeviceType || null,
    backed_up: Boolean(credentialBackedUp),
  };
}

// Passkeys the user can sign in with from this address.
async function usablePasskeys(req, db, userId) {
  const origin = resolvePasskeyOrigin(req.headers.origin);
  if (!origin) return [];
  return (await passkeysFor(db, userId)).filter((p) => p.rp_id === origin.rpID);
}

async function authenticationOptions(req, db, userId) {
  const origin = originFor(req);
  const passkeys = (await passkeysFor(db, userId)).filter((p) => p.rp_id === origin.rpID);
  if (!passkeys.length) throw new PasskeyError('No passkey for this account works at this address.', 'passkey_none');
  const options = await generateAuthenticationOptions({
    rpID: origin.rpID,
    allowCredentials: passkeys.map(descriptor),
    userVerification: 'preferred',
  });
  rememberChallenge(req, 'login', options, origin);
  return options;
}

// Returns the passkey row that signed, after updating its counter.
async function verifyAuthentication(req, db, userId, response) {
  const pending = takeChallenge(req, 'login');
  const passkey = (await passkeysFor(db, userId)).find((p) => p.credential_id === response.id && p.rp_id === pending.rpID);
  if (!passkey) throw new PasskeyError('That passkey is not registered for this account.', 'passkey_invalid');
  let result;
  try {
    result = await verifyAuthenticationResponse({
      response,
      expectedChallenge: pending.challenge,
      expectedOrigin: pending.origin,
      expectedRPID: pending.rpID,
      credential: {
        id: passkey.credential_id,
        publicKey: new Uint8Array(passkey.public_key),
        counter: Number(passkey.counter),
        transports: passkey.transports,
      },
      requireUserVerification: false,
    });
  } catch (err) {
    throw new PasskeyError(`The passkey could not be verified: ${err.message}`, 'passkey_invalid');
  }
  if (!result.verified) throw new PasskeyError('The passkey could not be verified.', 'passkey_invalid');
  await db.query(
    'UPDATE user_passkeys SET counter = $1, last_used_at = NOW() WHERE id = $2',
    [result.authenticationInfo.newCounter, passkey.id]
  );
  return passkey;
}

module.exports = {
  PasskeyError,
  registrationOptions,
  verifyRegistration,
  usablePasskeys,
  authenticationOptions,
  verifyAuthentication,
};
