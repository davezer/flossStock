<script>
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import StashGauge from '$lib/components/StashGauge.svelte';
  import { stash, stashSet, stashCount } from '$lib/stores/stash';

  export let data; // { colors }
  let q = '';
  let suggestions = [];

  $: user = $page.data.user;

  const norm = (s) => (s || '').toString().toLowerCase().trim();
  $: colors = data?.colors || [];

  // filter by search
  $: filtered = q
    ? colors.filter((c) =>
        norm(c.code).includes(norm(q)) ||
        norm(c.name).includes(norm(q)) ||
        norm(c.description).includes(norm(q)))
    : colors;

  // shuffle helpers for suggestions
  function refresh() {
    const arr = [...filtered];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    suggestions = arr.slice(0, 12);
  }
  $: if (!suggestions.length) refresh(); // initial fill

  function addAll() {
    if (!user) { goto('/auth?tab=login'); return; }
    suggestions.forEach((c) => stash.add(String(c.code)));
  }

  function tip(c) {
    return `DMC ${c.code} — ${c.name}`;
  }

  function displayName(u) {
  const m = u?.user_metadata ?? {};
  return (
    m.full_name ||
    m.name ||
    m.preferred_username ||
    m.user_name ||
    (u?.email ? u.email.split('@')[0] : '') ||
    ''
  );
}
function possessive(name) {
  if (!name) return "User’s";
  return /s$/i.test(name.trim()) ? `${name}’` : `${name}’s`;
}

$: owner = user ? displayName(user) : 'User';
$: heading = `${possessive(owner)} Floss Box`;

</script>

<svelte:head>
  <title>{heading}</title>
</svelte:head>

<div class="hero">
  <div class="title">
    <h1>{heading}</h1>
    <p>Count. Sort. Stitch.</p>
    <div class="rainbow"></div>
  </div>

  

  {#if user}
    <StashGauge total={colors.length} count={$stashCount} />
    <div class="stash-actions">
      <button on:click={() => stash.clear()} disabled={$stashCount===0}>Clear stash</button>
    </div>
  {:else}
    <a class="btn grad" href="/auth?tab=login">Sign in to save colors</a>
  {/if}
</div>

<div class="bar">
  <input
    placeholder="Search DMC code or name…"
    bind:value={q}
    aria-label="Search DMC" />
</div>

<section class="suggestions">
  <header>
    <h2>Try these next</h2>
    <div class="flex">
      <button class="chip" type="button" on:click={refresh} title="Shuffle">Refresh</button>
      <button class="chip addall" type="button" on:click={addAll} disabled={!suggestions.length || !user}>Add all</button>
    </div>
  </header>

  <div class="grid">
    {#each suggestions as c (c.code)}
      <button
        id={`dmc-${c.code}`}
        class="card { user && $stashSet.has(String(c.code)) ? 'in-stash' : '' }"
        type="button"
        on:click={() => user ? stash.toggle(String(c.code)) : goto('/auth?tab=login')}
        aria-pressed={user && $stashSet.has(String(c.code))}
        title={tip(c)}
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
</section>

<style>
  :root {
    --bg: #0f0f12;
    --card: color-mix(in oklab, white 5%, transparent);
    --border: color-mix(in oklab, white 18%, transparent);
    --accent: #9b5cff;
    --accent2: #00d1ff;
    color-scheme: dark;
  }

  /* hero */
  h1 { font-size:2.2rem; margin:.25rem 0; }
  .hero {
    display: grid; grid-template-columns: 1fr auto; align-items: center;
    gap: 1.2rem; max-width: 1100px; margin: 1.2rem auto .6rem; padding: 0 1rem;
  }
  .title h1 { font-size: 2.2rem; margin: 0; letter-spacing: .3px; }
  .title p { margin: .35rem 0 0; opacity: .8; }
  .rainbow {
    height: 6px; margin-top: .8rem; border-radius: 999px;
    background: linear-gradient(90deg, #ff715b, #ffcd4d, #7bd881, #4dcde0, #9b5cff, #ff71e0);
    box-shadow: 0 6px 22px rgba(155,92,255,.45);
  }
  .stash-actions button {
    padding:.6rem .9rem; border-radius:12px; border:1px solid var(--border);
    background:rgba(255,255,255,.03); color:inherit; cursor:pointer;
  }
  .btn { padding:.6rem .9rem; border-radius:12px; border:1px solid rgba(255,255,255,.14);
         background:rgba(255,255,255,.03); color:inherit; text-decoration:none; }
  .btn.grad { background:linear-gradient(135deg,#9b5cff,#00d1ff); color:#111; border-color:transparent; }

  /* search bar row */
  .bar {
    display:grid; grid-template-columns: 1fr; gap:.75rem;
    align-items:center; max-width:1100px; margin:1rem auto 1.25rem; padding: 0 1rem;
  }
  input {
    width:90%; padding:.9rem 1rem; border-radius:14px;
    border:1px solid var(--border); background:#15161b; color:inherit;
  }

  /* suggestions section header */
  .suggestions { max-width: 1100px; margin: 0 auto 2rem; padding: 0 1rem; }
  .suggestions header {
    display: flex; align-items: center; justify-content: space-between; gap: .6rem;
    margin: .6rem 0 .6rem;
  }
  .suggestions .flex { display: flex; gap: .6rem; flex-wrap: wrap; }

  .chip {
    display: inline-flex; align-items: center; gap: .35rem;
    padding: .6rem .8rem; border-radius: 12px; text-decoration: none;
    border: 1px solid var(--border); background: var(--card); color: inherit;
    cursor: pointer;
  }
  .chip.addall:disabled { opacity:.55; cursor:not-allowed; }

  /* grid + cards — same look/behavior as /colors & /account */
  .grid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: .85rem;
  }
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

  @media (max-width: 430px) {
  /* Layout */
  .hero{
    grid-template-columns: 1fr;   /* stack title + gauge/cta */
    align-items: start;
    gap: .8rem;
    max-width: 680px;
  }
  .title h1{ font-size: 1.8rem; line-height: 1.15; }
  .title p{ margin-top: .2rem; }
  .rainbow{ height: 4px; margin-top: .55rem; }

  /* CTA: full-width + comfy touch target */
  .btn, .stash-actions button{
    width: 90%;
    display: inline-flex;
    justify-content: center;
    padding: .8rem 1rem;
    border-radius: 14px;
    touch-action: manipulation;
  }

  /* Sticky search “island” under the nav bar */
  .bar{
    grid-template-columns: 1fr;  /* input on its own row */
    gap: .55rem;
    position: sticky;
    top: calc(var(--topbar-h) + .5rem);
    z-index: 20;
    padding: .6rem;
    border-radius: 14px;
    border: 1px solid var(--border);
    background: var(--card);
    backdrop-filter: blur(4px) saturate(1.1);
  }
  input{
    padding: .95rem 1rem;
    border-radius: 12px;
    font-size: 1rem;
  }

  /* Section header & action chips */
  .suggestions header{
    flex-direction: column;
    align-items: flex-start;
    gap: .5rem;
  }
  .chip{ padding: .55rem .75rem; border-radius: 12px; }

  /* Card grid → single column with comfy spacing */
  .grid{ grid-template-columns: 1fr; gap: .8rem; }
  .card{
    padding: .85rem .9rem;
    border-radius: 14px;
    transition: transform .08s ease, box-shadow .15s ease;
  }
  .swatch{
    width: 44px; height: 44px; border-radius: 10px;
  }
  .meta .code{ font-size: .98rem; }
  .meta .name{ font-size: .88rem; }
}

/* Respect iOS safe areas */
@supports(padding:max(0px)){
  .hero, .suggestions{
    padding-left: max(1rem, env(safe-area-inset-left));
    padding-right: max(1rem, env(safe-area-inset-right));
  }
}

</style>
