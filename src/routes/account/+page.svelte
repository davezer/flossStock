<script>
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabaseClient'; // PUBLIC client

  // UI state
  let mode = 'signin'; // 'signin' | 'signup' | 'updatePass'
  let email = '';
  let password = '';
  let confirm = '';
  let newPassword = '';
  let loading = false;
  let msg = '';
  let err = '';

  // Determine origin for redirects (works in browser only)
  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';

  // If user came back from the reset link, show "Set new password" mode
  $: if ($page.url.searchParams.get('reset') === '1' && mode !== 'updatePass') {
    mode = 'updatePass';
  }

  // ---- actions ----
  async function oauth(provider) {
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${origin}/account` }
    });
  }

  async function sendMagicLink() {
    err = ''; msg = ''; loading = true;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${origin}/account` }
    });
    loading = false;
    if (error) err = error.message;
    else msg = 'Magic link sent. Please check your email.';
  }

  async function signIn() {
    err = ''; msg = ''; loading = true;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    loading = false;
    if (error) err = error.message;
    else goto('/'); // success
  }

  async function signUp() {
    if (password !== confirm) {
      err = 'Passwords do not match.';
      return;
    }
    err = ''; msg = ''; loading = true;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${origin}/account` }
    });
    loading = false;
    if (error) err = error.message;
    else msg = 'Check your email to confirm your account.';
  }

  async function sendReset() {
    err = ''; msg = '';
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/account?reset=1`
    });
    if (error) err = error.message;
    else msg = 'Password reset email sent.';
  }

  async function updatePassword() {
    if (!newPassword || newPassword.length < 6) {
      err = 'Password must be at least 6 characters.';
      return;
    }
    err = ''; msg = ''; loading = true;
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    loading = false;
    if (error) err = error.message;
    else {
      msg = 'Password updated. You can now sign in.';
      mode = 'signin';
      password = '';
      newPassword = '';
    }
  }
</script>

<svelte:head>
  <title>Account</title>
</svelte:head>

<section class="wrap">
  <h1>Account</h1>

  <div class="card">
    {#if mode !== 'updatePass'}
      <!-- OAuth -->
             <!-- Email/password auth -->
      <div class="tabs">
        <button class:active={mode === 'signin'} on:click={() => (mode = 'signin')}>
          Sign in
        </button>
        <button class:active={mode === 'signup'} on:click={() => (mode = 'signup')}>
          Create account
        </button>
      </div>

      <label>
        <span>Email</span>
        <input type="email" bind:value={email} placeholder="you@example.com" />
      </label>

      {#if mode === 'signin'}
        <label>
          <span>Password</span>
          <input type="password" bind:value={password} />
        </label>

        <div class="row">
          <button class="btn primary" on:click={signIn} disabled={loading}>Sign in</button>
          <button class="btn subtle" on:click={sendReset} disabled={!email || loading}>
            Forgot password?
          </button>
        </div>
      {:else}
        <label>
          <span>Password</span>
          <input type="password" bind:value={password} />
        </label>
        <label>
          <span>Confirm password</span>
          <input type="password" bind:value={confirm} />
        </label>
        <button class="btn primary" on:click={signUp} disabled={loading}>Create account</button>
      {/if}

        <!-- Magic link (optional) -->
    
    {:else}
      <!-- Update password after reset -->
      <h3>Set a new password</h3>
      <label>
        <span>New password</span>
        <input type="password" bind:value={newPassword} />
      </label>
      <button class="btn primary" on:click={updatePassword} disabled={loading}>
        Update password
      </button>
    {/if}

    {#if err}<p class="err">{err}</p>{/if}
    {#if msg}<p class="msg">{msg}</p>{/if}
  </div>
</section>

<style>
  .wrap{ max-width:820px; margin:4rem auto; padding:0 1rem; }
  h1{ font-size:2rem; margin-bottom:1rem; }
  .card{
    max-width:560px; background:#111217; border:1px solid rgba(255,255,255,.08);
    border-radius:16px; padding:1.25rem; box-shadow: 0 10px 30px rgba(0,0,0,.35);
  }
  .btn{ padding:.55rem .9rem; border:1px solid rgba(255,255,255,.12);
    border-radius:10px; background:#171922; color:#fff; cursor:pointer; }
  .btn.primary{ background:#1e2433; border-color:rgba(255,255,255,.18); }
  .btn.grad{ background: linear-gradient(135deg,#9b5cff,#00d1ff); border-color:transparent; }
  .btn.subtle{ background:transparent; }
  .btn[disabled]{ opacity:.6; cursor:not-allowed; }
  .wfull{ width:100%; }
  .row{ display:flex; gap:.6rem; align-items:center; }
  .grow{ flex:1; }
  label{ display:flex; flex-direction:column; gap:.35rem; margin:.6rem 0; }
  input{
    background:#0f121a; color:#fff; border:1px solid rgba(255,255,255,.12);
    padding:.6rem .7rem; border-radius:10px; outline:none;
  }
  .or{ text-align:center; opacity:.7; margin:.6rem 0; }
  .or.small{ margin:.4rem 0 .6rem; font-size:.9rem; }
  .tabs{ display:flex; gap:.4rem; margin:.4rem 0 .6rem; }
  .tabs button{ all:unset; cursor:pointer; padding:.4rem .7rem; border-radius:10px;
    border:1px solid transparent; opacity:.85; }
  .tabs button.active{ background:rgba(255,255,255,.05); border-color:rgba(255,255,255,.12); opacity:1; }
  .err{ color:#ff6b6b; margin-top:.6rem; }
  .msg{ color:#5ad27d; margin-top:.6rem; }
</style>
