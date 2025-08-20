<script>
  import { page } from '$app/stores';
  $: supabase = $page.data.supabase;

  $: tab = $page.url.searchParams.get('tab') || 'login';
  $: hasError = Boolean($page.url.searchParams.get('error'));

  function switchTab(next) {
    const u = new URL(location.href);
    u.searchParams.set('tab', next);
    u.searchParams.delete('error');
    location.href = u.toString();
  }

  async function oauth(provider) {
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: new URL('/auth', location.origin).toString() }
    });
  }
</script>

<svelte:head>
  <title>{tab === 'signup' ? 'Create account' : 'Sign in'} • Floss Box</title>
</svelte:head>

<div class="auth-wrap">
  <div class="panel" role="region" aria-labelledby="auth-title">
    <h1 id="auth-title" class="visually-hidden">{tab === 'signup' ? 'Create account' : 'Sign in'}</h1>

    <div class="tabs" role="tablist">
      <button class:active={tab==='login'} role="tab" aria-selected={tab==='login'} on:click={() => switchTab('login')}>Sign in</button>
      <button class:active={tab==='signup'} role="tab" aria-selected={tab==='signup'} on:click={() => switchTab('signup')}>Create account</button>
    </div>

    {#if hasError}
      <div class="error" aria-live="polite">Something went wrong. Double-check your email and password.</div>
    {/if}

    {#if tab === 'login'}
      <form method="POST" class="form">
        <label>
          <span class="label">Email</span>
          <input name="email" type="email" placeholder="Email" required autocomplete="email" autofocus />
        </label>
        <label>
          <span class="label">Password</span>
          <input name="password" type="password" placeholder="Password" required minlength="6" autocomplete="current-password" />
        </label>
        <button class="cta" formaction="?/login">Sign in</button>
      </form>
      <div class="or">or</div>
      <button class="btn" on:click={() => oauth('google')}>Continue with Google</button>
    {:else}
      <form method="POST" class="form">
        <label>
          <span class="label">Email</span>
          <input name="email" type="email" placeholder="Email" required autocomplete="email" autofocus />
        </label>
        <label>
          <span class="label">Password</span>
          <input name="password" type="password" placeholder="Password (min 6 chars)" required minlength="6" autocomplete="new-password" />
        </label>
        <button class="cta" formaction="?/signup">Create account</button>
      </form>
      <div class="or">or</div>
      <button class="btn" on:click={() => oauth('google')}>Sign up with Google</button>
    {/if}
  </div>
</div>

<style>
  :root{
  --bg:#0f0f12;
  --surface: color-mix(in oklab, white 5%, transparent);
  --border:  color-mix(in oklab, white 14%, transparent);
  --border-strong: color-mix(in oklab, white 22%, transparent);
  --accent:#9b5cff;
  color-scheme: dark;
}

  .visually-hidden {
    position:absolute; width:1px; height:1px; padding:0; margin:-1px;
    overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; border:0;
  }

  /* Full-page center (accounts for sticky topbar) */
  .auth-wrap{
    min-height: calc(100dvh - var(--topbar-h, 52px));
    display:grid; place-items:center;
    padding: clamp(16px, 3vw, 32px);
  }

  /* Glass panel with gradient hairline + ambient ring */
  .panel{
    width:min(620px, 92vw);
    padding: clamp(14px, 2.4vw, 18px);
    border-radius: 16px;
    background:
      var(--glass) padding-box,
      linear-gradient(135deg, rgba(255,255,255,.18), rgba(255,255,255,.06)) border-box;
    border:1px solid transparent;
    position:relative;
  }
  .panel::after{
    content:"";
    position:absolute; inset:-28px -32px -42px;
    border-radius: 28px;
    filter: blur(30px);
    background: radial-gradient(60% 60% at 50% 0%,
      rgba(155,92,255,.18), transparent 60%);
    pointer-events:none;
  }

  .tabs{
    display:inline-flex; gap:.4rem; margin: .2rem 0 .9rem;
    justify-content: center; align-items:center;
    padding:.25rem; border-radius:999px;
    background: linear-gradient(-26deg, #9b5cff, #00d1ff);
    border:1px solid var(--border);
  }
  .tabs button{
    padding:.5rem .85rem; border:0; border-radius:999px; cursor:pointer;
    background: linear-gradient(135deg, #9b5cff, #00d1ff);
  }
  .tabs button.active{
    opacity:1; font-weight:600;
    background: linear-gradient(135deg, #9b5cff, #00d1ff);
    box-shadow: inset 0 6px 20px rgba(0,0,0,.16);
  }

  .error{
    margin:.4rem 0 .8rem; color:#ff8b8b;
    background:rgba(255,139,139,.07);
    border:1px solid rgba(255,139,139,.22);
    padding:.55rem .7rem; border-radius:10px;
  }

  .form{ display:grid; gap:.7rem; }
  .label{ display:block; font-size:.9rem; opacity:.78; margin:.1rem 0 .25rem; }

  input{
    width:95%; padding:.9rem 1rem; border-radius:12px;
    background:#121317; color:inherit; border:1px solid var(--border);
    box-shadow: inset 0 0 0 1px rgba(0,0,0,.18);
  }
  input::placeholder{ opacity:.6; }
  input:focus{
    outline:2px solid color-mix(in oklab, var(--accent1) 38%, transparent);
    outline-offset:1px;
  }

  .cta{
    margin-top:.25rem;
    width:100%; padding:.95rem 1rem; border-radius:12px; border:0;
    background: linear-gradient(135deg, #9b5cff, #00d1ff);
    box-shadow: 0 10px 26px rgba(0,0,0,.22);
    cursor:pointer; font-weight:700; letter-spacing:.1px;
  }
  .cta:hover{ filter:brightness(1.05); }

  .or{ text-align:center; opacity:.7; margin:.8rem 0 .7rem; }

  .btn{
    width:100%; padding:.85rem 1rem; border-radius:12px;
    background: linear-gradient(135deg, #9b5cff, #00d1ff);;
    border:1px solid var(--border);
  }
  .btn:hover{ background: rgba(255,255,255,.08); }
</style>
