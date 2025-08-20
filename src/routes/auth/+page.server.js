import { redirect } from '@sveltejs/kit';

export const actions = {
  signup: async ({ request, locals: { supabase } }) => {
    const form = await request.formData();
    const email = form.get('email');
    const password = form.get('password');
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw redirect(303, '/auth?error=1');
    throw redirect(303, '/'); // or /account
  },
  login: async ({ request, locals: { supabase } }) => {
    const form = await request.formData();
    const email = form.get('email');
    const password = form.get('password');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw redirect(303, '/auth?error=1');
    throw redirect(303, '/account');
  },
  logout: async ({ locals: { supabase } }) => {
    await supabase.auth.signOut();
    throw redirect(303, '/');
  }
};
