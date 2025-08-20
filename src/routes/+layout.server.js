import { createServerClient } from '@supabase/ssr';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '$env/static/private';

export async function load({ fetch, cookies }) {
  // Use the REAL cookies object; @supabase/ssr knows how to read/write it.
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies,
    global: { fetch }
  });

  const { data: { session } } = await supabase.auth.getSession();
  const { data: { user } } = await supabase.auth.getUser();

  // Send only the data you need to the client
  return { session, user };
}
