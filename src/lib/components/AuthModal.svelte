<script>
  import { authModalOpen } from '$lib/stores/authModal';
  import { supabase } from '$lib/supabaseClient';
  import { get } from 'svelte/store';
  import { invalidateAll, goto } from '$app/navigation';

  let open;
  const unsub = authModalOpen.subscribe((v) => (open = v));
  let mode = 'signin'; // 'signin' | 'signup'
  let email = '';
  let password = '';
  let loading = false;
  let message = '';

  function close() {
    authModalOpen.set(false);
    message = '';
    email = '';
    password = '';
  }

  async function afterAuth(redirectTo = null) {
    await invalidateAll(); // refresh $page.data.user in layout load
    close();
    if (redirectTo) goto(redirectTo);
  }

  async function signInWithGitHub() {
    loading = true; message = '';
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: `${location.origin}/account` }
    });
    loading = false;
    if (error) message = error.message;
    // On success, browser will redirect to /account.
  }

  async function sendMagicLink() {
    loading = true; message = '';
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/account` }
    });
    loading = false;
    message = error ? error.message : 'Check your email for a magic link.';
  }

  async function signInWithPassword() {
    loading = true; message = '';
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    loading = false;
    if (error) { message = error.message; return; }
    afterAuth('/account');
  }

  async function signUpWithPassword() {
    loading = true; message = '';
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: `${location.origin}/account` }
    });
    loading = false;
    message = error ? error.message : 'Check your email to confirm and then sign in.';
  }

  function onBackdrop(e) {
    if (e.target === e.currentTarget) close();
  }

  // Close on Esc
  function onKey(e) {
    if (e.key === 'Escape' && open) close();
  }
</script>

<svelte:window on:keydown={onKey} />

{#if open}
  <div class="backdrop" on:click={onBackdrop}>
    <div class="modal" role="dialog" aria-modal="true" aria-label="Sign in">
      <header class="head">
        <h2>{mode === 'signin' ? 'Sign in' : 'Create account'}</h2>
        <button class="x" on:click={close} aria-label="Close">✕</button>
      </header>

      <div class="body">
        <button class="btn grad full" on:click={signInWithGitHub} disabled={loading}>
          Continue with GitHub
        </button>

        <div class="or">or</div>

        <div class="row">
          <input
            type="email"
            placeholder="you@example.com"
            bind:value={email}
            autocomplete="email"
          />
        </div>

        {#if mode === 'signin' || mode === 'signup'}
          <div class="row">
            <input
              type="password"
              placeholder="password"
              bind:value={password}
              autocomplete={mode === 'signin' ? 'current-password' : 'new-password'}
            />
          </div>
        {/if}

        {#if mode === 'signin'}
          <div class="row">
            <button class="btn full" on:click={signInWithPassword} disabled={loading || !email || !password}>
              Sign in with email & password
            </button>
          </div>
          <div class="row">
            <button class="btn subtle full" on:click={sendMagicLink} disabled={loading || !email}>
              Send magic link
            </button>
          </div>
          <p class="tiny">
            New here? <a href="#" on:click|preventDefault={() => (mode='signup')}>Create an account</a>
          </p>
        {:else}
          <div class="row">
            <button class="btn full" on:click={signUpWithPassword} disabled={loading || !email || !password}>
              Create account
            </button>
          </div>
          <p class="tiny">
            Already have an account? <a href="#" on:click|preventDefault={() => (mode='signin')}>Sign in</a>
          </p>
        {/if}

        {#if message}<p class="msg">{message}</p>{/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .backdrop{
    position:fixed; inset:0; background:rgba(0,0,0,.45);
    display:flex; align-items:center; justify-content:center; z-index:100;
    backdrop-filter: blur(4px) saturate(1.1);
  }
  .modal{
    width:min(520px, calc(100vw - 2rem));
    background:rgba(255,255,255,.02);
    border:1px solid rgba(255,255,255,.1);
    border-radius:16px; box-shadow:0 20px 60px rgba(0,0,0,.5);
  }
  .head{ display:flex; justify-content:space-between; align-items:center;
    padding:.9rem 1rem .6rem; border-bottom:1px solid rgba(255,255,255,.08); }
  .x{ background:transparent; border:0; color:inherit; opacity:.8; cursor:pointer; font-size:1.1rem; }
  .body{ padding:1rem; }
  .row{ margin:.5rem 0; }
  .full{ width:100%; }
  .btn{
    padding:.6rem .9rem; border-radius:10px; cursor:pointer;
    background:rgba(255,255,255,.04);
    border:1px solid rgba(255,255,255,.14); color:inherit;
  }
  .btn.grad{ background:linear-gradient(135deg,#9b5cff,#00d1ff); color:#0d0f12; border-color:transparent; }
  .btn.subtle{ background:rgba(255,255,255,.02); }
  input{
    width:100%; padding:.6rem .7rem; border-radius:10px;
    border:1px solid rgba(255,255,255,.14);
    background:rgba(0,0,0,.35); color:inherit;
  }
  .or{ text-align:center; opacity:.7; margin:.7rem 0; }
  .tiny{ opacity:.8; font-size:.9rem; margin-top:.5rem; }
  .msg{ margin-top:.6rem; opacity:.9; }
</style>