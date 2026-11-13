// Which proxies in front of the backend may name the client's address
// (req.ip, which the rate limits count by). Read from TRUST_PROXY (#115):
//
//   (unset) or 1   GHOST's own nginx only, the default Docker setup
//   2              nginx plus one reverse proxy in front of it (Caddy,
//                  Traefik, a load balancer); 3 for two, and so on
//   0              no proxy: the backend is reached directly
//   a list         addresses or subnets of the proxies, as Express accepts
//                  them: "loopback, 172.16.0.0/12, 10.0.0.5"
//
// "true" (trust everything) is refused: any client could then pick its own
// address in X-Forwarded-For and get fresh login attempts per request.
const net = require('net');

const NAMES = new Set(['loopback', 'linklocal', 'uniquelocal']);

const validEntry = (entry) => {
  if (NAMES.has(entry)) return true;
  const [addr, bits, extra] = entry.split('/');
  const kind = net.isIP(addr);
  if (!kind || extra !== undefined) return false;
  if (bits === undefined) return true;
  const n = Number(bits);
  return /^\d+$/.test(bits) && n <= (kind === 4 ? 32 : 128);
};

// → { value } for app.set('trust proxy', value), plus a warning when the
// setting was not understood (the default is used then).
function readTrustProxy(raw) {
  const text = String(raw ?? '').trim();
  if (text === '') return { value: 1 };
  if (/^\d+$/.test(text)) {
    const n = Number(text);
    if (n <= 10) return { value: n === 0 ? false : n };
  } else if (!/^(true|yes|on|\*)$/i.test(text)) {
    const entries = text.split(',').map((s) => s.trim()).filter(Boolean);
    if (entries.length && entries.every(validEntry)) return { value: entries };
  }
  return {
    value: 1,
    warning: `TRUST_PROXY="${text}" is not understood; trusting one proxy (GHOST's nginx). Use a number of proxies (2 behind one more reverse proxy) or their addresses.`,
  };
}

module.exports = { readTrustProxy };
