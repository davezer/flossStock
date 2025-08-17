<script>
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { tabs } from '$lib/util/tabs.js';
  import { supabase } from '$lib/supabaseClient';
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

  const normalize = (s) => (s && s !== '/' ? s.replace(/\/+$/, '') : '/');
  $: active = normalize($page.url.pathname);



  function isActive(dest) {
    const h = normalize(dest);
    return h === '/' ? active === '/' : active === h || active.startsWith(h + '/');
  }

  function onNav(e, dest) {
    e.preventDefault();
    goto(dest);
  }
</script>

<nav class="topbar">
  <a href="/" class="brand">🧵 The Floss Box</a>
  <a href="/" class="tab" aria-current={$page.url.pathname === '/' ? 'page' : undefined}>Home</a>
  <a href="/colors" class="tab" aria-current={$page.url.pathname.startsWith('/colors') ? 'page' : undefined}>Colors</a>
  <a href="/account" class="tab" aria-current={$page.url.pathname.startsWith('/account') ? 'page' : undefined}>
    {user ? 'My stash' : 'Account'}
  </a>

  <div style="flex:1"></div>

  {#if user}
    <button class="btn" on:click={signOut}>Sign out</button>
  {:else}
    <button class="btn grad" on:click={openSignIn}>Sign in</button>
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
        background:rgba(255,255,255,.03); cursor:pointer; color:inherit; }
  .btn.grad{ background:linear-gradient(135deg,#9b5cff,#00d1ff); color:#111; border-color:transparent; }
</style>
