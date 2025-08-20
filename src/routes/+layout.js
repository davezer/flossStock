// src/routes/+layout.js
import { createBrowserClient, isBrowser } from '@supabase/ssr';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

export async function load({ data, depends, fetch }) {
  depends('supabase:auth');

  // Only instantiate in the browser
  const supabase = isBrowser()
    ? createBrowserClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, { global: { fetch } })
    : null;

  return {
    supabase,
    session: data.session ?? null,
    user: data.user ?? null
  };
}
