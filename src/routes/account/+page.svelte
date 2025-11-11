<script>
  import { onMount, tick } from 'svelte';
  import { page } from '$app/stores';
  import dmc from '$lib/data/dmc.json';
  import { stash, stashSet, stashCount } from '$lib/stores/stash.js';

  // auth from +layout
  $: user = $page.data.user;

  /* ---------- Avatar upload (Section 5) ---------- */
  let file = null;
  let msg = '';
  let localPreview = '';

  // Prefer R2 avatar if present
  $: r2Avatar = user && user.avatar_key ? `/api/avatar/${user.avatar_key}` : '';

  function onPick(e) {
    file = e.currentTarget.files && e.currentTarget.files[0] ? e.currentTarget.files[0] : null;
    if (localPreview) URL.revokeObjectURL(localPreview);
    localPreview = file ? URL.createObjectURL(file) : '';
    msg = '';
  }

  async function upload() {
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    const r = await fetch('/api/account/avatar', { method: 'POST', body: fd });
    let j = null; try { j = await r.json(); } catch {}
    msg = r.ok ? '✅ Avatar updated!' : (j && j.error ? j.error : 'Upload failed');
    if (r.ok) {
      await tick();
      location.reload(); // refresh to get new user.avatar_key in layout data
    }
  }
  /* ---------- /Avatar upload ---------- */

  let q = '';
  let focusParam = '';

  // Only colors that are in the stash (if signed out, treat as empty)
  $: stashColors = (user ? dmc.filter((c) => $stashSet.has(String(c.code))) : []);

  // Filter within stash by query
  $: filtered = stashColors.filter((c) => {
    if (!q) return true;
    const n = q.toLowerCase();
    return (
      String(c.code).toLowerCase().includes(n) ||
      c.name.toLowerCase().includes(n)
    );
  });
  $: shownCount = filtered.length;

  // Displayed stash count (0 when logged out)
  $: displayStashCount = user ? $stashCount : 0;

  function tip(c) {
    return `DMC ${c.code} — ${c.name}`;
  }

  // Optional focus scroll (parity with /colors)
  onMount(async () => {
    const sp = new URLSearchParams(window.location.search);
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

  // NOTE: your buttons reference saveToCloud/loadFromCloud;
  // leaving them as-is assuming they’re implemented in your stash store.
</script>

<svelte:head><title>My stash • Floss Cabinet</title></svelte:head>

<!-- ===== Account / Avatar card ===== -->
{#if user}
<section class="account">
  <h2 class="h">Account</h2>
  <div class="acct-card">
    <div class="avatar-wrap">
      {#if localPreview}
        <img class="avatar" src={localPreview} alt="avatar preview" />
      {:else if r2Avatar}
        <img class="avatar" src={r2Avatar} alt="current avatar" />
      {:else}
        <div class="avatar placeholder" aria-hidden="true">?</div>
      {/if}
    </div>

    <div class="acct-body">
      <div class="row">
        <label>Email</label>
        <div class="value">{user.email}</div>
      </div>

      <div class="row">
        <label>Avatar</label>
        <div class="value">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            on:change={onPick}
          />
          <button class="btn" on:click={upload} disabled={!file}>Upload</button>
          {#if msg}<div class="msg">{msg}</div>{/if}
          <p class="hint">Max 2&nbsp;MB. PNG / JPG / WebP / GIF. Stored in Cloudflare R2.</p>
        </div>
      </div>
    </div>
  </div>
</section>
{/if}

<!-- ===== Page header ===== -->
<header class="pagehead">
  <div>
    <h1>My stash</h1>
    <p class="meta">
      <strong>{displayStashCount}</strong> saved
      {#if user}<span style="opacity:.6;">· filter to {shownCount}</span>{/if}
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
    <input placeholder="Search name or code…" bind:value={q} disabled={!user} />
  </div>

  <button class="ghost" on:click={() => stash.clear()} disabled={!user || $stashCount===0}>
    Clear local
  </button>
  <button class="ghost" on:click={loadFromCloud} disabled={!user}>
    Load from cloud
  </button>
  <button class="ghost grad" on:click={saveToCloud} disabled={!user || $stashCount===0}>
    Save to cloud
  </button>
</section>

<!-- Grid -->
<main class="wrap">
  <div class="grid">
    {#if user}
      {#each filtered as c (c.code)}
        <button
          id={`dmc-${c.code}`}
          class="card { $stashSet.has(String(c.code)) ? 'in-stash' : '' }"
          on:click={() => stash.toggle(String(c.code))}
          aria-pressed={$stashSet.has(String(c.code))}
          title={tip(c)}
          type="button"
        >
          <div class="swatch" style={`--c:${c.hex}`}></div>
          <div class="meta">
            <div class="code">DMC {c.code}</div>
            <div class="name">{c.name}</div>
          </div>

          {#if $stashSet.has(String(c.code))}
            <span class="chip-stash" aria-label="In stash">✓</span>
          {/if}
        </button>
      {/each}
    {/if}
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

/* ===== Account card ===== */
.account{ max-width:1160px; margin:1rem auto 0; padding:0 1rem; }
.h{ margin:.2rem 0 .6rem; font-size:1.2rem; opacity:.9; }
.acct-card{
  display:grid; grid-template-columns:88px 1fr; gap:1rem;
  padding:.9rem; border:1px solid var(--border); border-radius:14px;
  background: linear-gradient(180deg,
      color-mix(in oklab, white 6%, transparent),
      color-mix(in oklab, white 3%, transparent) 55%,
      transparent);
  box-shadow: 0 8px 24px rgba(0,0,0,.18);
}
.avatar-wrap{ display:grid; place-items:center; }
.avatar{
  width:72px; height:72px; border-radius:999px; object-fit:cover;
  border:1px solid color-mix(in srgb, #fff 18%, transparent);
  box-shadow: 0 6px 16px rgba(0,0,0,.22);
}
.avatar.placeholder{
  display:grid; place-items:center; font-weight:800; font-size:1.1rem; color:#fff;
  background: radial-gradient(circle at 30% 20%, #333, #111 70%);
}
.acct-body{ display:grid; gap:.5rem; align-content:center; }
.row{ display:grid; grid-template-columns:120px 1fr; gap:.6rem; align-items:center; }
.row label{ opacity:.8; }
.value{ display:flex; align-items:center; gap:.6rem; flex-wrap:wrap; }
.btn{ padding:.45rem .75rem; border-radius:10px; border:1px solid var(--border); background:var(--surface); color:inherit; cursor:pointer; }
.msg{ margin-left:.35rem; opacity:.8; }
.hint{ margin:.25rem 0 0; opacity:.65; font-size:.85rem; }

/* ===== Page header ===== */
.pagehead{
  max-width:1160px; margin:.9rem auto .4rem; padding:0 1rem;
  display:flex; align-items:end; justify-content:space-between;
}
h1{ margin:0; font-size:1.6rem; letter-spacing:.2px;}
.meta{ margin:.25rem 0 0; opacity:.8;}
.link{ text-decoration:underline; text-underline-offset:3px; }

/* ===== Toolbar ===== */
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
.search{
  flex:1 1 420px; min-width:240px;
  display:grid; grid-template-columns:38px 1fr; align-items:center;
  border:1px solid var(--border); border-radius:999px;
  background: var(--surface);
  padding:.2rem .3rem;
}
.search svg{ width:20px; height:20px; margin-left:.45rem; opacity:.85;}
.search input{ border:0; outline:0; background:transparent; color:inherit; padding:.55rem .65rem; font-size:1rem;}

.ghost{
  border-radius:999px; padding:.55rem .8rem;
  background:var(--surface); border:1px solid var(--border);
  color:inherit; cursor:pointer;
}
.ghost:disabled{ opacity:.55; cursor:not-allowed;}
.ghost.grad{ background:linear-gradient(135deg,#9b5cff,#00d1ff); color:#111; border-color:transparent; }

/* ===== Layout & grid ===== */
.wrap{ max-width:1160px; margin:0 auto 2rem; padding:0 1rem;}
.grid{
  display:grid;
  grid-template-columns: repeat(auto-fill, minmax(170px,1fr));
  gap:.85rem;
}

/* ===== Cards ===== */
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
