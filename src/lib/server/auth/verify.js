// src/lib/server/auth/verify.js
import { verifyPassword as verifyV3 } from "$lib/server/auth/password.js"; // handles "scrypt:N,r,p:..."
import { validateHash as verifyLegacy } from "$lib/server/auth/scrypt.js";  // handles "$scrypt$N=...,r=...,p=...$"

/**
 * Verify a password against either legacy or v3 scrypt format.
 * Returns true if valid, false otherwise.
 */
export async function verifyAnyPassword(password, stored) {
  if (!stored) return false;

  try {
    if (stored.startsWith("scrypt:")) {
      // New format
      return await verifyV3(password, stored);
    }
    if (stored.startsWith("$scrypt$")) {
      // Legacy format
      return await verifyLegacy(password, stored);
    }
    return false;
  } catch (err) {
    console.error("[verifyAnyPassword] error:", err);
    return false;
  }
}
