<script>
  import { onMount } from 'svelte';

  export let data;
  let q = '';
  let sortBy = 'code'; // code | name
  let onlyStash = false;

  // stash: { [colorId]: qty }
  let stash = {};

  // load current inventory once
  onMount(async () => {
    try {
      const r = await fetch('/api/inventory', { cache: 'no-store' });
      const j = await r.json();
      if (j?.items) {
        stash = Object.fromEntries(j.items.map((it) => [it.color_id, Number(it.quantity || 0)]));
      }
    } catch (e) {
      console.warn('stash load failed', e);
    }
  });

  // match + sort
  $: list = (data.colors || [])
    .filter((c) => {
      const s = q.trim().toLowerCase();
      if (!s) return true;
      return String(c.code).toLowerCase().includes(s) || String(c.name).toLowerCase().includes(s);
    })
    .sort((a, b) =>
      sortBy === 'name' ? a.name.localeCompare(b.name) : Number(a.code) - Number(b.code)
    )
    .filter((c) => (onlyStash ? (stash[c.id] ?? 0) > 0 : true));

  function inStash(id) { return (stash[id] ?? 0) > 0; }

  async function addOne(c) {
    try {
      const r = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ color_id: c.id, op: 'add', quantity: 1 })
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j?.message || `HTTP ${r.status}`);
      // update local stash count
      stash = { ...stash, [c.id]: (stash[c.id] ?? 0) + 1 };
    } catch (e) {
      console.error(e);
      alert('Please sign in to save to stash.');
    }
  }

  function clearSearch(){ q = ''; }
</script>

<header class="bar">
  <div class="max">
    <div class="row">
      <h1>Color Catalog</h1>

      <label class="toggle" aria-label="Show my stash only">
        <input type="checkbox" bind:checked={onlyStash} />
        <span class="track"><span class="knob"></span></span>
        <span>Show my stash</span>
      </label>

      <select bind:value={sortBy} aria-label="Sort" class="sort">
        <option value="code">Code</option>
        <option value="name">Name</option>
      </select>
    </div>

    <label class="search">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="11" cy="11" r="7"/><path d="M20 20L16.5 16.5"/>
      </svg>
      <input
        placeholder="Search code or name…"
        bind:value={q}
        spellcheck="false"
        aria-label="Search colors by code or name"
      />
      {#if q}<button class="clear" on:click={clearSearch} aria-label="Clear search">×</button>{/if}
    </label>

    <div class="meta-line">{list.length} colors</div>
  </div>
</header>

<main class="max">
  <div class="grid">
    {#each list as c}
      <article class="card" aria-label={`${c.code} ${c.name}`}>
        <div class="swatch" style={`--sw:${c.hex};`}/>
        <footer class="info">
          <span class="pill">DMC&nbsp;{String(c.code).padStart(2,'0')}</span>
          <div class="name">{c.name}</div>

          <button
            class="add"
            aria-label={inStash(c.id) ? 'In stash' : 'Add to stash'}
            title={inStash(c.id) ? `In stash (${stash[c.id]})` : 'Add to stash'}
            on:click={() => addOne(c)}
            data-in={inStash(c.id)}
          >
            {#if inStash(c.id)}
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20 7L10 17l-6-6" fill="none" stroke="currentColor" stroke-width="2.4"
                      stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            {:else}
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2.4"
                      stroke-linecap="round"/>
              </svg>
            {/if}
          </button>
        </footer>
      </article>
    {/each}
  </div>
</main>

<style>
  :root{
    --radius: 14px;
    --radius-sm: 12px;
    --border: color-mix(in oklab, CanvasText 16%, transparent);
    --panel: color-mix(in oklab, Canvas 90%, transparent);
    --panel-strong: color-mix(in oklab, Canvas 86%, transparent);
    --ink: color-mix(in oklab, CanvasText 94%, #fff 0%);
    --ink-soft: color-mix(in oklab, CanvasText 70%, transparent);
    --ring: color-mix(in oklab, #5bbcff 55%, transparent);
  }

  .max{ width:min(1200px, 94vw); margin:0 auto; }

  /* Header */
  .bar{ position: sticky; top:0; z-index:5; backdrop-filter: blur(6px); padding:16px 0 10px; }
  .row{
    display:grid;
    grid-template-columns: 1fr auto auto;
    gap:12px;
    align-items:center;
    margin-bottom:10px;
  }
  h1{ justify-content: center; margin:0; font-weight:700; font-size:1.45rem; letter-spacing:.2px; color:var(--text); }

  .sort{
    padding:8px 10px;
    border-radius:10px;
    background: var(--panel);
    border:1px solid var(--border);
    color: var(--ink);
  }

  /* switch */
  .toggle{
    justify-self:end;
    display:inline-flex; align-items:center; gap:10px; color:var(--text);
    user-select:none;
  }
  .toggle input{
    position:absolute; opacity:0; width:1px; height:1px; pointer-events:none;
  }
  .toggle .track{
    width:48px; height:28px; border-radius:999px;
    background: var(--panel); border:1px solid var(--border);
    display:inline-flex; align-items:center; padding:2px;
    transition: background .15s ease, border-color .15s ease;
  }
  .toggle .knob{
    width:22px; height:22px; border-radius:999px; background:#fff;
    box-shadow: 0 1px 1px rgba(0,0,0,.15);
    transform: translateX(0);
    transition: transform .15s ease;
  }
  .toggle input:checked + .track{ background: color-mix(in oklab, #2ecc71 30%, var(--panel-strong)); border-color: color-mix(in oklab, #2ecc71 50%, var(--border)); }
  .toggle input:checked + .track .knob{ transform: translateX(20px); }
  .toggle input:focus-visible + .track{ outline: 3px solid var(--ring); outline-offset: 2px; }

  /* search */
  .search{
    display:flex; align-items:center; gap:12px;
    padding:12px 16px; border-radius:999px;
    background: var(--panel-strong);
    border:1px solid var(--border);
    color: var(--text);
  }
  .search svg{ width:18px; height:18px; stroke: var(--ink-soft); fill:none; stroke-width:1.6; }
  .search input{ all:unset; flex:1; min-width:200px; color:var(--ink); font-size:1rem; line-height:1.2; }
  .search input::placeholder{ color: var(--ink-soft); opacity:.95; }
  .search .clear{
    all:unset; cursor:pointer;
    width:26px; height:26px; border-radius:8px;
    display:grid; place-items:center;
    background: color-mix(in oklab, Canvas 86%, transparent);
    color: var(--ink); font-size:18px;
    border:1px solid var(--border);
  }
  .search .clear:focus-visible{ outline:3px solid var(--ring); outline-offset:3px; }
  .search:focus-within{ outline:3px solid var(--ring); outline-offset:3px; }

  .meta-line{ margin-top:6px; font-size:.95rem; color:var(--text-soft); }

  /* Grid / cards */
  .grid{
    --gap: 10px;
    display:grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: var(--gap);
    padding: 10px 0 40px;
  }
  .card{
    border-radius: var(--radius);
    background: rgba(255,255,255,.04);
    border:1px solid var(--border);
    overflow:hidden;
    display:flex; flex-direction:column;
    transition: transform .12s ease, border-color .12s ease, box-shadow .12s ease;
  }
  .card:hover{ transform: translateY(-2px); border-color: color-mix(in oklab, CanvasText 22%, transparent); box-shadow: 0 12px 26px rgba(0,0,0,.12); }
  .swatch{ aspect-ratio: 5/4; background: var(--sw,#888); }

  /* Footer uses a 2×2 grid so the button is always top-right, no overlap */
  .info{
    display:grid;
    grid-template-columns: 1fr auto;        /* left column | add button */
    grid-template-rows: auto auto;          /* row1: pill, row2: name */
    grid-template-areas:
      "pill add"
      "name add";
    gap:6px 8px;
    padding:10px 12px 12px;
    min-height:72px; /* keeps rows visually even */
  }
  .pill{
    grid-area:pill;
    font-size:.72rem; padding:2px 8px; border-radius:999px;
    background: rgba(255,255,255,.06);
    border:1px solid var(--border);
  }
  .name{
    grid-area:name; font-weight:650; line-height:1.2; font-size:.92rem;
    white-space: normal; overflow: visible; /* never truncate */
  }

  /* Add button tile */
  .add{
    grid-area: add;
    justify-self: end;   /* right edge of footer */
    align-self: start;   /* top of footer */
    width:32px; height:32px;
    display:grid; place-items:center;
    border-radius:10px; cursor:pointer;
    border:1px solid var(--border); background:#fff; color:#161616;
    transition: transform .05s, box-shadow .12s ease, border-color .12s ease;
  }
  .add:hover{ border-color: color-mix(in oklab, CanvasText 28%, transparent); box-shadow: 0 2px 10px rgba(0,0,0,.18); }
  .add:active{ transform: scale(.98); }
  .add svg{ width:18px; height:18px; }
  .add svg path{ vector-effect: non-scaling-stroke; }

  /* check state */
  .add[data-in="true"]{
    background:#2ecc71; color:#fff;
    border-color: color-mix(in oklab, #2ecc71 70%, #1b1b1b);
    box-shadow: 0 0 0 2px color-mix(in oklab, #2ecc71 30%, transparent) inset;
  }
</style>
