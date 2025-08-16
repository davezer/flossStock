<script>
  import { goto } from '$app/navigation';
  import dmc from '$lib/data/dmc.json';
  import { stash, stashSet, stashCount } from '$lib/stores/stash.js';
  import NavBar from '$lib/components/NavBar.svelte';
  import StashGauge from '$lib/components/StashGauge.svelte';

  let q = '';
  const total = dmc.length;
  $: pct = Math.round(($stashCount / total) * 100);

  // --- Suggestions (random colors NOT in stash) ---
  const SUGGESTION_COUNT = 12;
  let refreshKey = 0; // bump to reshuffle

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  $: available = dmc.filter((c) => !$stashSet.has(String(c.code)));
  $: suggestions = shuffle(available).slice(0, SUGGESTION_COUNT); // runs when stash or refreshKey changes

  function refresh() {
    refreshKey++; // triggers reactive block -> new shuffle
  }

  function addAll() {
    for (const c of suggestions) stash.add(String(c.code));
  }

   function bestMatch(query) {
    if (!query) return null;
    const q = String(query).trim().toLowerCase().replace(/^dmc\s+/, '');
    // exact code match (e.g. "310", "b5200", "ecru")
    const exact = dmc.find(c => String(c.code).toLowerCase() === q);
    if (exact) return exact.code;
    // starts-with code (e.g. "37" -> 3713)
    const starts = dmc.find(c => String(c.code).toLowerCase().startsWith(q));
    if (starts) return starts.code;
    // name contains (e.g. "salmon")
    const byName = dmc.find(c => c.name.toLowerCase().includes(q));
    return byName ? byName.code : null;
  }


 function openSearch(e) {
    e.preventDefault();
    const code = bestMatch(q);
    if (code) {
      // Pass focus param and also a hash for browsers to jump immediately
      const hash = `#dmc-${encodeURIComponent(code)}`;
      const params = new URLSearchParams({ focus: String(code) });
      goto(`/colors?${params.toString()}${hash}`);
    } else {
      // fallback: just go to colors (no focus)
      goto('/colors');
    }
  }
</script>

<svelte:head><title>Liz O’s Floss Cabinet</title></svelte:head>

<div class="hero">
  <div class="title">
    <h1>Liz O’s Floss Cabinet</h1>
    <p>Count. Sort. Stitch.</p>
    <div class="rainbow"></div>
  </div>

  
    <StashGauge count={$stashCount} total={dmc.length} href="/colors?stash=1" />
  
</div>

<form class="actions" on:submit={openSearch}>
  <div class="search">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 21l-4.2-4.2m1.7-5.5a7 7 0 11-14 0 7 7 0 0114 0z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
    <input placeholder="Search DMC code or name…" bind:value={q} />
  </div>
  <button class="primary" type="submit">Search</button>
  <a class="chip" href="/colors?stash=1" class:disabled={$stashCount===0}>View my stash</a>
  <button class="chip danger" type="button" on:click={stash.clear} disabled={$stashCount===0}>Clear stash</button>
</form>

{#if $stashCount}
  <h2 class="subhead">Recently added</h2>
  <!-- You can keep your recent grid here if you like -->
{/if}

<!-- Suggestions -->
<section class="suggestions">
  <header>
    <h2>Try these next</h2>
    <div class="flex">
      <button class="chip" type="button" on:click={refresh} title="Shuffle">Refresh</button>
      <button class="chip addall" type="button" on:click={addAll} disabled={!suggestions.length}>Add all</button>
    </div>
  </header>

  <div class="grid">
    {#each suggestions as c (c.code)}
      <button
        class="card"
        on:click={() => stash.add(String(c.code))}
        title={`Add DMC ${c.code} — ${c.name}`}>
        <div class="swatch" style={`--c:${c.hex}`}></div>
        <div class="meta">
          <div class="code">DMC {c.code}</div>
          <div class="name">{c.name}</div>
        </div>
        <span class="plus" aria-hidden="true">+</span>
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

  .ring { position: relative; width: 110px; height: 110px; display: grid; place-items: center; }
  .meter {
    --p: 0;
    width: 110px; height: 110px; border-radius: 999px;
    background:
      radial-gradient(closest-side, var(--bg) 76%, transparent 77% 100%),
      conic-gradient(from -90deg,
        var(--accent) calc(var(--p) * 1%), color-mix(in oklab, white 8%, transparent) 0);
    box-shadow: 0 0 0 1px var(--border), inset 0 0 0 1px #0006;
  }
  .count { position: absolute; inset: 0; display: grid; place-items: center; text-align: center; pointer-events: none; }
  .big { font-weight: 800; font-size: 1.6rem; line-height: 1; }
  .label { font-size: .8rem; opacity: .75; }

  .actions {
    max-width: 1100px; margin: .2rem auto 1.2rem; padding: 0 1rem;
    display: flex; flex-wrap: wrap; gap: .6rem; align-items: center;
  }
  .search {
    flex: 1 1 420px; min-width: 260px;
    display: grid; grid-template-columns: 36px 1fr; align-items: center;
    border: 1px solid var(--border); border-radius: 14px; background: var(--card);
    padding: .25rem .3rem; overflow: hidden;
  }
  .search svg { width: 20px; height: 20px; margin-left: .4rem; opacity: .8; }
  .search input {
    border: 0; outline: none; background: transparent; color: inherit;
    padding: .55rem .6rem .55rem .2rem; font-size: 1rem;
  }
  .primary {
    border: 0; cursor: pointer; border-radius: 12px; padding: .65rem .9rem; font-weight: 700;
    background: linear-gradient(135deg, var(--accent), var(--accent2));
    color: white; box-shadow: 0 10px 22px rgba(0,0,0,.25);
    transition: transform .08s ease, filter .15s ease;
  }
  .primary:hover { transform: translateY(-1px); filter: brightness(1.05); }
  .chip {
    display: inline-flex; align-items: center; gap: .35rem;
    padding: .6rem .8rem; border-radius: 12px; text-decoration: none;
    border: 1px solid var(--border); background: var(--card); color: inherit;
  }
  .chip.disabled, .chip[disabled] { opacity: .5; pointer-events: none; }
  .chip.danger { border-color: color-mix(in oklab, #ff5d7a 60%, transparent); }
  .chip.addall { border-color: color-mix(in oklab, #36c46b 60%, transparent); }

  .subhead { max-width: 1100px; margin: .6rem auto .4rem; padding: 0 1rem; font-size: 1.05rem; opacity: .85; }

  /* Suggestions section */
  .suggestions { max-width: 1100px; margin: 0 auto 2rem; padding: 0 1rem; }
  .suggestions header {
    display: flex; align-items: center; justify-content: space-between; gap: .6rem;
    margin: .6rem 0 .6rem;
  }
  .suggestions .flex { display: flex; gap: .6rem; flex-wrap: wrap; }

  .grid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: .9rem;
  }
  .card {
    position: relative; display: flex; gap: .75rem; align-items: center;
    padding: .8rem; border-radius: 12px;
    border: 1px solid var(--border); background: var(--card);
    cursor: pointer; text-align: left;
    transition: transform .08s ease, box-shadow .15s ease, filter .2s ease;
  }
  .card:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(0,0,0,.08); }
  .plus {
    position: absolute; top: 6px; right: 8px; font-weight: 900;
    background: color-mix(in oklab, CanvasText 10%, transparent);
    color: Canvas; border-radius: 999px; padding: 0 .45rem;
  }
  .swatch {
    --c: #ccc; width: 48px; height: 48px; flex: 0 0 48px;
    border-radius: 8px; background: var(--c);
    border: 1px solid #0000001a; box-shadow: inset 0 0 0 2px #0000000d;
  }
  .meta .code { font-weight: 700; }
  .meta .name { opacity: .85; font-size: .9rem; }
</style>
