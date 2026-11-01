// File: backend/services/integrations/httpClient.js
//
// The one place integrations reach the network (issue #96).
//
// - HTTPS only, GET only, no redirects followed.
// - The address is checked at connect time, inside the DNS lookup the socket
//   actually uses, so a hostname can't resolve to a public address for a
//   check and then a private one for the connection. Private, loopback,
//   link-local and similar ranges are refused unless the operator sets
//   INTEGRATIONS_ALLOW_PRIVATE=true (for self-hosted services on their LAN).
// - Responses are size- and time-limited, and must be JSON.
const https = require('https');
const dns = require('dns');
const net = require('net');

const MAX_BYTES = 10 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 15000;

function ipv4ToInt(ip) {
  return ip.split('.').reduce((acc, o) => ((acc << 8) + Number(o)) >>> 0, 0);
}

const V4_BLOCKED = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
  ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
].map(([base, bits]) => [ipv4ToInt(base), bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0]);

function isPrivateAddress(ip) {
  const family = net.isIP(ip);
  if (family === 4) {
    const n = ipv4ToInt(ip);
    return V4_BLOCKED.some(([base, mask]) => ((n & mask) >>> 0) === base);
  }
  if (family === 6) {
    const lower = ip.toLowerCase();
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    if (lower === '::' || lower === '::1') return true;
    const first = parseInt(lower.split(':')[0] || '0', 16);
    if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
    if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
    if ((first & 0xff00) === 0xff00) return true; // multicast
    if (lower.startsWith('64:ff9b:') || lower.startsWith('2001:db8:')) return true;
    return false;
  }
  return true;
}

const allowPrivate = () => process.env.INTEGRATIONS_ALLOW_PRIVATE === 'true';

function guardedLookup(hostname, options, callback) {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err);
    const list = Array.isArray(addresses) ? addresses : [{ address: addresses, family: options.family || 4 }];
    if (!allowPrivate()) {
      const blocked = list.find((a) => isPrivateAddress(a.address));
      if (blocked) {
        const e = new Error(`Refusing to connect to a private address (${hostname})`);
        e.code = 'EPRIVATEADDR';
        return callback(e);
      }
    }
    if (options.all) return callback(null, list);
    return callback(null, list[0].address, list[0].family);
  });
}

class IntegrationHttpError extends Error {
  constructor(message, status, kind) {
    super(message);
    this.status = status;
    this.kind = kind;
  }
}

// GET a JSON document. Resolves { status, json } for any 2xx/4xx/5xx status
// (callers decide what a 404 means); rejects on network errors, redirects,
// oversize or non-JSON bodies.
function getJson(urlString, { headers = {}, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  return new Promise((resolve, reject) => {
    let url;
    try { url = new URL(urlString); } catch { return reject(new IntegrationHttpError('Invalid URL', 0, 'invalid')); }
    if (url.protocol !== 'https:') return reject(new IntegrationHttpError('Only HTTPS is allowed', 0, 'invalid'));
    if (net.isIP(url.hostname.replace(/^\[|\]$/g, '')) && !allowPrivate() && isPrivateAddress(url.hostname.replace(/^\[|\]$/g, ''))) {
      return reject(new IntegrationHttpError('Refusing to connect to a private address', 0, 'blocked'));
    }

    const req = https.request(url, { method: 'GET', headers, lookup: guardedLookup, timeout: timeoutMs }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400) {
        res.resume();
        return reject(new IntegrationHttpError(`The service redirected the request (HTTP ${res.statusCode}); redirects are not followed`, res.statusCode, 'redirect'));
      }
      const chunks = [];
      let size = 0;
      res.on('data', (chunk) => {
        size += chunk.length;
        if (size > MAX_BYTES) {
          req.destroy();
          reject(new IntegrationHttpError('The response was too large', res.statusCode, 'too_large'));
          return;
        }
        chunks.push(chunk);
      });
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json = null;
        if (text.trim()) {
          try { json = JSON.parse(text); } catch {
            if (res.statusCode >= 400) return resolve({ status: res.statusCode, json: null, text: text.slice(0, 300) });
            return reject(new IntegrationHttpError('The service did not return JSON', res.statusCode, 'not_json'));
          }
        }
        resolve({ status: res.statusCode, json, text: null });
      });
      res.on('error', (e) => reject(new IntegrationHttpError(e.message, 0, 'network')));
    });
    req.on('timeout', () => req.destroy(new IntegrationHttpError('The service took too long to answer', 0, 'timeout')));
    req.on('error', (e) => {
      if (e instanceof IntegrationHttpError) return reject(e);
      if (e.code === 'EPRIVATEADDR') return reject(new IntegrationHttpError(e.message, 0, 'blocked'));
      reject(new IntegrationHttpError(`Could not reach the service (${e.code || e.message})`, 0, 'network'));
    });
    req.end();
  });
}

module.exports = { getJson, isPrivateAddress, guardedLookup, IntegrationHttpError, MAX_BYTES };
