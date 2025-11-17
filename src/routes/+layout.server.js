// src/routes/+layout.server.js
export function load({ locals }) {
  console.log("[+layout.server] user =", locals.user?.email);
  return {
    user: locals.user ?? null
  };
}
