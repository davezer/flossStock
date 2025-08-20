import { json } from '@sveltejs/kit';
const COOKIE = 'stash_codes_v1', MAX_AGE = 60*60*24*365*2;
const enc = (a)=> (Array.isArray(a)? [...new Set(a)].join(','): '');
const dec = (s)=> (s? s.split(',').filter(Boolean): []);

export async function GET({ locals, cookies }) {
  const { data: { user } } = await locals.supabase.auth.getUser();
  if (user) {
    const { data, error } = await locals.supabase
      .from('stash')
      .select('codes')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error && error.code !== 'PGRST116') console.error(error);
    return json({ codes: data?.codes ?? [] });
  }
  return json({ codes: dec(cookies.get(COOKIE)) });
}

export async function POST({ locals, request, cookies }) {
  const { codes = [] } = await request.json().catch(() => ({}));
  const next = [...new Set(Array.isArray(codes) ? codes : [])];

  const { data: { user } } = await locals.supabase.auth.getUser();
  if (user) {
    const { error } = await locals.supabase
      .from('stash')
      .upsert({ user_id: user.id, codes: next }, { onConflict: 'user_id' });
    if (error) { console.error(error); return json({ ok:false }, { status:500 }); }
    return json({ ok:true, count: next.length, source:'supabase' });
  }

  cookies.set(COOKIE, enc(next), { path:'/', httpOnly:true, sameSite:'lax', secure:true, maxAge:MAX_AGE });
  return json({ ok:true, count: next.length, source:'cookie' });
}