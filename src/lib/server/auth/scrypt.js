import scryptPkg from 'scrypt-js';
const { scrypt } = scryptPkg;

const hasBtoa = typeof globalThis.btoa === 'function';
const hasAtob = typeof globalThis.atob === 'function';
const toB64 = (u8) => hasBtoa ? btoa(String.fromCharCode(...u8)) : Buffer.from(u8).toString('base64');
const fromB64 = (s) => {
  if (hasAtob) {
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  return new Uint8Array(Buffer.from(s, 'base64'));
};

export async function generateHash(password) {
  const N = 1 << 15, r = 8, p = 1, dkLen = 32;
  const pwd = new TextEncoder().encode(String(password));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const dk = await scrypt(pwd, salt, N, r, p, dkLen);
  return `$scrypt$N=${N},r=${r},p=${p}$${toB64(salt)}$${toB64(dk)}`;
}

export async function validateHash(password, stored) {
  try {
    const parts = stored.split('$');
    if (parts.length < 5 || parts[1] !== 'scrypt') return false;
    const [, , params, saltB64, hashB64] = parts;
    const m = /N=(\d+),r=(\d+),p=(\d+)/.exec(params);
    if (!m) return false;
    const N = +m[1], r = +m[2], p = +m[3];
    const salt = fromB64(saltB64);
    const expected = fromB64(hashB64);
    const pwd = new TextEncoder().encode(String(password));
    const dk = await scrypt(pwd, salt, N, r, p, expected.length);
    if (dk.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < dk.length; i++) diff |= dk[i] ^ expected[i];
    return diff === 0;
  } catch { return false; }
}
