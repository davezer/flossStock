// Pure scrypt-js helper compatible with "scrypt:N,r,p:salt_b64:hash_b64"
import pkg from "scrypt-js";
const { scrypt } = pkg;

const enc = new TextEncoder();

// base64 helpers (btoa/atob are available in CF Workers)
const toBase64 = (bytes) => {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
};
const fromBase64 = (str) => {
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};
const ctEqual = (a, b) => {
  if (a.length !== b.length) return false;
  let v = 0;
  for (let i = 0; i < a.length; i++) v |= a[i] ^ b[i];
  return v === 0;
};

// Default params match oslo defaults
const DEF_N = 16384, DEF_r = 8, DEF_p = 1, KEY_LEN = 32;

/** Make a new "scrypt:N,r,p:salt_b64:hash_b64" string */
export async function hashPassword(password) {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);

  const pwd = enc.encode(password);
  // v3 API: dkLen is a number and it RETURNS the derived key
  const derived = new Uint8Array(await scrypt(pwd, salt, DEF_N, DEF_r, DEF_p, KEY_LEN));
  return `scrypt:${DEF_N},${DEF_r},${DEF_p}:${toBase64(salt)}:${toBase64(derived)}`;
}

/** Verify input against stored "scrypt:..." hash */
export async function verifyPassword(password, stored) {
  if (!stored || !stored.startsWith("scrypt:")) return false;

  const [, params, saltB64, hashB64] = stored.split(":");
  const [Nstr, rstr, pstr] = params.split(",");
  const N = Number(Nstr) || DEF_N;
  const r = Number(rstr) || DEF_r;
  const p = Number(pstr) || DEF_p;

  const salt = fromBase64(saltB64);
  const expected = fromBase64(hashB64);

  const pwd = enc.encode(password);
  const derived = new Uint8Array(await scrypt(pwd, salt, N, r, p, expected.length));

  return ctEqual(derived, expected);
}
