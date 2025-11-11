// Server loader (authoritative). Prefer this data if SSR.
// Keeps client and server in sync with the same API result.

export const load = async ({ fetch, locals }) => {
  const r = await fetch('/api/inventory', { cache: 'no-store' });
  const j = await r.json().catch(() => ({}));
  // Only trust user when Lucia says so:
  const { user } = await locals?.auth?.validateUser?.() ?? { user: null };
  return {
    user,
    items: Array.isArray(j.items) ? j.items : []
  };
};
