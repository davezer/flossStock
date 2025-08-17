import { redirect, error as kitError } from '@sveltejs/kit';
import dmc from '$lib/data/dmc.json';

export const load = async ({ locals }) => {
  const { user, supabase } = locals;

  // Guests → send home and open the modal
  // Use a 3xx here (303 is safest after actions/side-effects)
  if (!user) {
    throw redirect(303, '/?signin=1');
  }

  // Fetch the user's stash
  const { data, error } = await supabase
    .from('stash')
    .select('code, qty')
    .eq('user_id', user.id)
    .order('code');

  // On failure, throw a 500 error (NOT a redirect)
  if (error) {
    throw kitError(500, error.message);
  }

  // Enrich with DMC metadata (adjust to your schema)
  const byCode = new Map(dmc.map((c) => [String(c.code).toUpperCase(), c]));
  const stash = (data ?? [])
    .map((r) => {
      const meta = byCode.get(String(r.code).toUpperCase());
      return meta ? { ...meta, qty: r.qty ?? 1 } : null;
    })
    .filter(Boolean);

  return { user, stash, total: dmc.length };
};
