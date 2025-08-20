import { createBrowserClient, isBrowser } from '@supabase/ssr';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

export async function load({ data, depends, fetch }) {
  depends('supabase:auth');

  // Only create the browser client in the browser.
  const supabase = isBrowser()
    ? createBrowserClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, { global: { fetch } })
    : null;

  // Reuse session/user calculated on the server
  return {
    supabase,
    session: data.session ?? null,
    user: data.user ?? null
  };
}
