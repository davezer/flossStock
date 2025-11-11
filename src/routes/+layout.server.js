export function load({ locals }) {
  // quick debug so you can see it in wrangler logs
  console.log('[+layout.server] user =', locals.user?.email);
  return { user: locals.user ?? null };
}