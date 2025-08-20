// src/routes/+layout.server.js
import { createServerClient } from '@supabase/ssr';
import { env } from '$env/dynamic/private'; // server runtime env

export async function load({ fetch, cookies }) {
  // prefer truly-private names; fall back to PUBLIC_* if you only set those on Vercel
  const url = env.SUPABASE_URL ?? env.PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_ANON_KEY ?? env.PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error('Missing Supabase env vars: SUPABASE_URL / SUPABASE_ANON_KEY (or PUBLIC_* equivalents)');
    return { session: null, user: null };
  }

  const supabase = createServerClient(url, key, { cookies, global: { fetch } });
  const { data: { session } } = await supabase.auth.getSession();
  const { data: { user } } = await supabase.auth.getUser();
  return { session, user };
}
