<script>
  import { onMount, tick } from 'svelte';
  import { page } from '$app/stores';
  import dmc from '$lib/data/dmc.json';
  import { stash, stashSet, stashCount } from '$lib/stores/stash.js';
  import NavBar from '$lib/components/NavBar.svelte';

  let q = '';
  let showOnlyStash = false;
  let focusParam = '';

  // auth from +layout
  $: user = $page.data.user;

  // filtering
  $: filtered = dmc.filter((c) => {
    // When signed out, stash is effectively empty
    if (showOnlyStash && !(user && $stashSet.has(String(c.code)))) return false;
    if (!q) return true;
    const n = q.toLowerCase();
    return (
      String(c.code).toLowerCase().includes(n) ||
      c.name.toLowerCase().includes(n)
    );
  });
  $: shownCount = filtered.length;

  // Displayed stash count = 0 when signed out
  $: displayStashCount = user ? $stashCount : 0;

  function tip(c) {
    return `DMC ${c.code} — ${c.name}`;
  }

  onMount(async () => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get('stash') === '1') showOnlyStash = true;
    const initialQ = sp.get('q'); if (initialQ) q = initialQ;
    focusParam = sp.get('focus') || '';
    const hashId = window.location.hash?.slice(1);

    await tick();
    const id = hashId || (focusParam ? `dmc-${focusParam}` : '');
    if (!id) return;
    let el = document.getElementById(id);
    if (!el) { q = ''; await tick(); el = document.getElementById(id); }
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('flash');
      setTimeout(() => el.classList.remove('flash'), 1400);
    }
  });
</script>

<svelte:head><title>DMC Colors • Floss Cabinet</title></svelte:head>

<!-- Page header -->
<header class="pagehead">
  <div>
    <h1>DMC Colors</h1>
    <p class="meta">
      <strong>{shownCount}</strong> shown ·
      <strong>{displayStashCount}</strong> in stash ·
      <strong>{dmc.length}</strong> total
    </p>
    {#if !user}
      <p class="meta" style="opacity:.75;">You’re signed out — your stash is empty. <a href="/auth?tab=login" class="link">Sign in</a> to save colors.</p>
    {/if}
  </div>
</header>

<!-- Sticky toolbar -->
<section class="toolbar">
  <div class="search">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 21l-4.2-4.2m1.7-5.5a7 7 0 11-14 0 7 7 0 0114 0z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
    <input placeholder="Search name or code…" bind:value={q} />
  </div>

  <label class="toggle" title={!user ? 'Sign in to filter by your stash' : undefined}>
    <input type="checkbox" bind:checked={showOnlyStash} disabled={!user} />
    <span>Show my stash only</span>
  </label>

  <button class="ghost danger" on:click={stash.clear} disabled={!user || $stashCount===0}>
    Clear stash ({displayStashCount})
  </button>
</section>

<!-- Grid -->
<main class="wrap">
  <div class="grid">
    {#each filtered as c (c.code)}
      <button
        id={`dmc-${c.code}`}
        class="card { user && $stashSet.has(String(c.code)) ? 'in-stash' : '' }"
        on:click={() => { if (user) stash.toggle(String(c.code)); }}
        aria-pressed={user && $stashSet.has(String(c.code))}
        title={tip(c)}
        type="button"
      >
        <div class="swatch" style={`--c:${c.hex}`}></div>
        <div class="meta">
          <div class="code">DMC {c.code}</div>
          <div class="name">{c.name}</div>
        </div>

        {#if user && $stashSet.has(String(c.code))}
          <span class="chip-stash" aria-label="In stash">✓</span>
        {/if}
      </button>
    {/each}
  </div>
</main>

<style>
:root{
  --bg:#0f0f12;
  --surface: color-mix(in oklab, white 5%, transparent);
  --border:  color-mix(in oklab, white 14%, transparent);
  --border-strong: color-mix(in oklab, white 22%, transparent);
  --accent:#9b5cff;
  color-scheme: dark;
}

/* ===== Page header ===== */
.pagehead{
  max-width:1160px; margin:.9rem auto .4rem; padding:0 1rem;
  display:flex; align-items:end; justify-content:space-between;
}
h1{ margin:0; font-size:1.6rem; letter-spacing:.2px;}
.meta{ margin:.25rem 0 0; opacity:.8;}

/* ===== “Island” toolbar (rounded container) ===== */
.toolbar{
  position:sticky; top:52px; z-index:30;
  max-width:1160px; margin:0 auto 1rem; padding:.55rem .6rem;
  display:flex; gap:.6rem; align-items:center; flex-wrap:wrap;
  background: linear-gradient(180deg,
      color-mix(in oklab, white 6%, transparent),
      color-mix(in oklab, white 3%, transparent) 55%,
      transparent);
  border:1px solid var(--border);
  border-radius:14px;
  box-shadow: 0 8px 24px rgba(0,0,0,.18);
  backdrop-filter: blur(4px) saturate(1.15);
}

/* pill search */
.search{
  flex:1 1 420px; min-width:240px;
  display:grid; grid-template-columns:38px 1fr; align-items:center;
  border:1px solid var(--border); border-radius:999px;
  background: var(--surface);
  padding:.2rem .3rem;
}
.search svg{ width:20px; height:20px; margin-left:.45rem; opacity:.85;}
.search input{ border:0; outline:0; background:transparent; color:inherit; padding:.55rem .65rem; font-size:1rem;}
.toggle{ display:inline-flex; align-items:center; gap:.4rem; opacity:.9;}
.toggle input{ width:16px; height:16px;}
.ghost{
  border-radius:999px; padding:.55rem .8rem;
  background:var(--surface); border:1px solid var(--border);
  color:inherit; cursor:pointer;
}
.ghost:disabled{ opacity:.55; cursor:not-allowed;}
.danger{ border-color: color-mix(in oklab, #ff5d7a 58%, transparent);}

/* ===== Layout & grid ===== */
.wrap{ max-width:1160px; margin:0 auto 2rem; padding:0 1rem;}
.grid{
  display:grid;
  grid-template-columns: repeat(auto-fill, minmax(170px,1fr));
  gap:.85rem;
}

/* ===== Cards — softer & less blocky ===== */
.card{
  position:relative;
  display:grid; grid-template-columns:42px 1fr; align-items:center; gap:.6rem;
  padding:.7rem .75rem;
  border-radius:16px;
  background: linear-gradient(180deg,
      color-mix(in oklab, white 6%, transparent),
      transparent 65%);
  border:1px solid var(--border);
  box-shadow: 0 6px 20px rgba(0,0,0,.12);
  text-align:left; cursor:pointer;
  transition: transform .12s ease, box-shadow .18s ease, border-color .18s ease, filter .18s ease;
  overflow:hidden;
}
/* soft “sheen” on hover */
.card::before{
  content:"";
  position:absolute; inset:-1px; border-radius:inherit; pointer-events:none;
  background:
    radial-gradient(60% 80% at 8% 0%, rgba(255,255,255,.10), transparent 40%);
  opacity:0; transition:opacity .18s ease;
}
.card:hover{
  transform: translateY(-2px);
  border-color: color-mix(in oklab, var(--accent) 22%, var(--border));
  box-shadow: 0 14px 28px rgba(0,0,0,.18);
}
.card:hover::before{ opacity:1; }
.card:active{ transform: translateY(0); filter:brightness(.98); }
.toolbar { top: var(--topbar-h); }

@keyframes flash-ring{
  0%{ box-shadow:0 0 0 0 rgba(155,92,255,.55);}
  70%{ box-shadow:0 0 0 10px rgba(155,92,255,0);}
  100%{ box-shadow:0 0 0 0 rgba(155,92,255,0);}
}

/* swatch — rounder with subtle bevel */
.swatch{
  --c:#ccc;
  width:42px; height:42px; border-radius:12px; background:var(--c);
  border:1px solid #0000001a;
  box-shadow:
    inset 0 0 0 2px #0000000d,
    inset 0 10px 20px rgba(255,255,255,.06);
}
.meta .code{ font-weight:800; font-size:.92rem; line-height:1.05;}
.meta .name{ opacity:.92; font-size:.86rem; line-height:1.1;}

/* tiny top-right stash chip */
.card{ position:relative; }
.chip-stash{
  position:absolute; top:6px; right:6px;
  width:22px; height:22px; border-radius:999px;
  display:grid; place-items:center;
  background:#1fc96e; color:#fff; font-weight:1000; font-size:.85rem;
  box-shadow:0 6px 16px rgba(0,0,0,.22), inset 0 0 0 2px rgba(255,255,255,.15);
  pointer-events:none;
}
.card.in-stash .chip-stash{ animation:chip-pop .18s ease-out;}
@keyframes chip-pop{ 0%{ transform:scale(.6); opacity:0;} 60%{ transform:scale(1.1); opacity:1;} 100%{ transform:scale(1);}}

/* Respect reduced motion */
@media (prefers-reduced-motion: reduce){
  .card, .card::before, .chip-stash{ transition:none !important; animation:none !important;}
}

@media (max-width: 430px){
  .toolbar{
    top: calc(var(--topbar-h) + .5rem);
    padding: .6rem;
    border-radius: 14px;
  }
}
</style>
