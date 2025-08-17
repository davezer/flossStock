import { createServerClient } from '@supabase/ssr';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

export const handle = async ({ event, resolve }) => {
  // attach a Supabase server client that reads/writes SvelteKit cookies
  const supabase = createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      get: (name) => event.cookies.get(name),
      set: (name, value, options) =>
        event.cookies.set(name, value, { ...options, path: '/' }),
      remove: (name, options) =>
        event.cookies.delete(name, { ...options, path: '/' })
    }
  });

  event.locals.supabase = supabase;

  // fetch the authenticated user (trusted) and stash it on locals
  const { data: { user } } = await supabase.auth.getUser();
  event.locals.user = user ?? null;

  return resolve(event, {
    // Supabase sometimes sets this header; this keeps SvelteKit happy when serializing
    filterSerializedResponseHeaders: (name) => name === 'content-range'
  });
};
