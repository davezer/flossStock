<script>
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { tabs } from '$lib/util/tabs.js';
  import { supabase } from '$lib/supabaseClient.js';
  import { authModalOpen } from '$lib/stores/authModal';

  $: user = $page.data.user;

  function openSignIn() {
    authModalOpen.set(true);
  }

  async function signOut() {
    await supabase.auth.signOut();
    await invalidateAll();
    goto('/');
  }

  let title = 'The Floss Box';
  let links = tabs;

  $: active = normalize($page.url.pathname);

  function onNav(e, dest) {
    e.preventDefault();
    goto(dest);
  }

 export let user = null;

  // normalize + isActive() from earlier answer, or keep what you have
  const normalize = (p = '/') => {
    const base = p.split('?')[0].split('#')[0];
    return base.length > 1 && base.endsWith('/') ? base.slice(0, -1) : base;
  };
  
  $: current = normalize($page.url.pathname);
  function isActive(href, { exact = false } = {}) {
    const t = normalize(href);
    if (exact) return current === t;
    return current === t || (t !== '/' && current.startsWith(t + '/'));
  }

</script>
<nav class="topbar" aria-label="Primary" data-sveltekit-preload-data="hover">
  <a href="/" class="brand">🧵 The Floss Box</a>

  <a href="/" class="tab" class:active={isActive('/', { exact: true })}
     aria-current={isActive('/', { exact: true }) ? 'page' : undefined}>Home</a>

  <a href="/colors" class="tab" class:active={isActive('/colors')}
     aria-current={isActive('/colors') ? 'page' : undefined}>Colors</a>

  <a href="/account" class="tab" class:active={isActive('/account')}
     aria-current={isActive('/account') ? 'page' : undefined}>
    {user ? 'My stash' : 'Account'}
  </a>

  <div style="flex:1"></div>

  {#if user}
    <form method="POST" action="/auth?/logout">
      <button class="btn" title="Sign out">{user.email?.split('@')[0] ?? 'Sign out'}</button>
    </form>
  {:else}
    <a href="/auth?tab=login" class="btn">Sign in</a>
    <a href="/auth?tab=signup" class="btn grad">Create account</a>
  {/if}
</nav>


<style>
  :global(:root){ --topbar-h: 52px; }
  .topbar{
    position:sticky; top:0; z-index:40;
    display:flex; gap:.6rem; align-items:center;
    padding:.6rem 1rem;
    background: color-mix(in oklab, #0f0f12 92%, black);
    border-bottom:1px solid color-mix(in oklab, white 14%, transparent);
    backdrop-filter: blur(6px) saturate(1.15);
  }
  .brand{
    text-decoration:none; font-weight:900; letter-spacing:.3px;
    background: linear-gradient(135deg, #9b5cff, #00d1ff);
    -webkit-background-clip:text; background-clip:text; color:transparent;
    margin-right:.2rem;
  }
  .tab{
    text-decoration:none; color:inherit; opacity:.85;
    padding:.28rem .6rem; border-radius:10px; border:1px solid transparent;
  }
  .tab.active{
    background: color-mix(in oklab, white 5%, transparent);
    border-color: color-mix(in oklab, white 14%, transparent);
    opacity:1;
  }
  .btn{ padding:.45rem .8rem; border-radius:10px; border:1px solid rgba(255,255,255,.14);
        background: linear-gradient(-26deg, #9b5cff, #00d1ff); cursor:pointer; color:inherit; }
  .btn.grad{ background:linear-gradient(135deg,#9b5cff,#00d1ff); color:#111; border-color:transparent; }
</style>