<script>
  import { onMount } from 'svelte';
  import { pushToast } from '$lib/stores/toast.js';

  export let data;

  const user = data.user;

  // which panel is active: "stash" | "wishlist"
  let view = 'stash';

  // search text (shared between views)
  let q = '';

  // stash (have) items come from server data initially
  let stashItems = data?.items ?? [];

  // wishlist (shopping list) items will be loaded on mount
  let wishlistItems = [];
  let loadingWishlist = false;

  // add/update form for stash
  let adding = { color_id: '', quantity: 1, notes: '' };

  // --- filtering for search ---
  const matchesQuery = (it, q) => {
    if (!q) return true;
    const s = q.trim().toLowerCase();
    return (
      String(it.code ?? '').toLowerCase().includes(s) ||
      String(it.name ?? '').toLowerCase().includes(s)
    );
  };

  $: filteredStash = stashItems.filter((it) => matchesQuery(it, q));
  $: filteredWishlist = wishlistItems.filter((it) => matchesQuery(it, q));

  // --- API helpers ---

  async function refreshStash() {
    try {
      const r = await fetch('/api/inventory', { cache: 'no-store' });
      const j = await r.json().catch(() => ({}));
      stashItems = j.items || [];
    } catch (e) {
      console.warn('refreshStash failed', e);
    }
  }

  async function loadWishlist() {
    if (!user) return;
    loadingWishlist = true;
    try {
      const r = await fetch('/api/wishlist', { cache: 'no-store' });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j?.ok !== false) {
        wishlistItems = j.items || [];
      }
    } catch (e) {
      console.warn('loadWishlist failed', e);
    } finally {
      loadingWishlist = false;
    }
  }

  onMount(() => {
    if (user) loadWishlist();
  });

  async function patchItem(colorId, payload) {
    const r = await fetch(`/api/inventory/${encodeURIComponent(colorId)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j?.ok === false) throw new Error(j?.message || `HTTP ${r.status}`);
    return j;
  }

  // ===== QTY: plus/minus with optimistic UI =====
  const inflightQty = new Set();
  export async function adjust(it, delta) {
    const id = it.color_id;
    if (inflightQty.has(id)) return; // avoid spamming
    const next = Math.max(0, (Number(it.quantity) || 0) + Number(delta || 0));
    if (next === it.quantity) return;

    inflightQty.add(id);
    const prev = it.quantity;
    it.quantity = next; // optimistic

    try {
      await patchItem(id, { quantity: next });
    } catch (e) {
      it.quantity = prev; // rollback
      alert(`Update failed: ${e.message || e}`);
    } finally {
      inflightQty.delete(id);
    }
  }

  // ===== NOTES: save on change/blur =====
  const inflightNotes = new Set();
  export async function saveNotes(it) {
    const id = it.color_id;
    if (inflightNotes.has(id)) return;
    inflightNotes.add(id);

    try {
      await patchItem(id, { notes: it.notes ?? null });
    } catch (e) {
      alert(`Saving notes failed: ${e.message || e}`);
    } finally {
      inflightNotes.delete(id);
    }
  }

  // ===== DELETE: remove row with optimistic rollback =====
  export async function remove(it) {
    const id = it.color_id;
    const idx = stashItems.findIndex((x) => x.color_id === id);
    if (idx === -1) return;

    const keep = stashItems[idx]; // for rollback
    stashItems = [...stashItems.slice(0, idx), ...stashItems.slice(idx + 1)]; // optimistic

    try {
      const r = await fetch(`/api/inventory/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j?.ok === false) throw new Error(j?.message || `HTTP ${r.status}`);
    } catch (e) {
      // rollback
      stashItems = [...stashItems.slice(0, idx), keep, ...stashItems.slice(idx)];
      alert(`Delete failed: ${e.message || e}`);
    }
  }

  // ===== ADD / UPDATE stash from controls =====
  async function addOrUpdate() {
    try {
      const r = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          color_id: adding.color_id,
          quantity: Number(adding.quantity ?? 0),
          op: 'add',
          notes: adding.notes || null
        })
      });
      if (r.status === 401) {
        pushToast?.({ type: 'warning', msg: 'You must be signed in to do that.' });
        return;
      }
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j?.ok === false) {
        pushToast?.({ type: 'error', msg: j?.error || 'Could not update inventory.' });
        return;
      }
      pushToast?.({ type: 'success', msg: 'Added to inventory!' });
      adding = { color_id: '', quantity: 1, notes: '' };
      await refreshStash();
    } catch (err) {
      pushToast?.({ type: 'error', msg: 'Could not update inventory.' });
    }
  }

  // ===== WISHLIST actions =====

  async function removeWishlistItem(item) {
    try {
      const r = await fetch('/api/wishlist', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ color_id: item.color_id })
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j?.ok === false) {
        pushToast?.({
          type: 'error',
          msg: j?.message || 'Could not remove from shopping list.'
        });
        return;
      }
      wishlistItems = wishlistItems.filter((w) => w.color_id !== item.color_id);
    } catch (e) {
      pushToast?.({ type: 'error', msg: 'Could not remove from shopping list.' });
    }
  }

  async function moveWishlistToStash(item) {
    try {
      const qty = Number(item.desired_qty ?? 1) || 1;

      // 1) add to stash
      const r1 = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          color_id: item.color_id,
          quantity: qty,
          op: 'add'
        })
      });

      const j1 = await r1.json().catch(() => ({}));
      if (!r1.ok || j1?.ok === false) {
        pushToast?.({ type: 'error', msg: j1?.message || 'Could not move to stash.' });
        return;
      }

      // 2) remove from wishlist
      const r2 = await fetch('/api/wishlist', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ color_id: item.color_id })
      });
      const j2 = await r2.json().catch(() => ({}));
      if (!r2.ok || j2?.ok === false) {
        pushToast?.({
          type: 'error',
          msg: j2?.message || 'Stash updated, but failed to remove from shopping list.'
        });
      } else {
        pushToast?.({ type: 'success', msg: 'Moved to stash!' });
      }

      await Promise.all([refreshStash(), loadWishlist()]);
    } catch (e) {
      pushToast?.({ type: 'error', msg: 'Could not move to stash.' });
    }
  }
</script>

<svelte:head><title>Inventory • ThreadIndex</title></svelte:head>

{#if !user}
  <div class="card">Please sign in to view your inventory.</div>
{:else}
  <section class="inv-shell">
    <header class="inv-header">
      <div>
        <h1>My threads</h1>
        <p class="subtitle">Everything you own and everything on your wish list, in one cozy place.</p>
      </div>

      <div class="view-toggle" role="tablist" aria-label="Inventory view">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'stash'}
          class="view-pill"
          data-active={view === 'stash'}
          on:click={() => (view = 'stash')}
        >
          Stash
          <span class="count-pill">{stashItems.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'wishlist'}
          class="view-pill"
          data-active={view === 'wishlist'}
          on:click={() => (view = 'wishlist')}
        >
          Shopping list
          <span class="count-pill">{wishlistItems.length}</span>
        </button>
      </div>
    </header>

    <!-- shared search line -->
    <div class="inv-search-row">
      <input
        class="search-pill"
        placeholder="Search code or name…"
        bind:value={q}
        spellcheck="false"
        aria-label="Search inventory"
      />
    </div>

    {#if view === 'stash'}
      <!-- ===== STASH VIEW ===== -->
      <div class="inv-controls">
        <!-- ghost swatch to align with table -->
        <span class="ghost-swatch" aria-hidden="true"></span>

        <input
          class="ctl id"
          placeholder="color_id"
          bind:value={adding.color_id}
          spellcheck="false"
        />

        <input
          class="ctl qty"
          type="number"
          min="1"
          step="1"
          bind:value={adding.quantity}
          aria-label="Quantity to add"
        />

        <input
          class="ctl notes"
          placeholder="notes (optional)"
          bind:value={adding.notes}
        />

        <button class="btn primary" on:click|preventDefault={addOrUpdate}>
          Add / update
        </button>
      </div>

      <table class="inv">
        <colgroup>
          <col style="width:60px" />   <!-- swatch -->
          <col style="width:100px" />  <!-- code -->
          <col />                      <!-- name -->
          <col style="width:120px" />  <!-- qty -->
          <col />                      <!-- notes -->
          <col style="width:112px" />  <!-- actions -->
        </colgroup>

        <thead>
          <tr>
            <th>Swatch</th>
            <th>Code</th>
            <th>Name</th>
            <th>Qty</th>
            <th>Notes</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {#if !filteredStash.length}
            <tr>
              <td colspan="6" class="empty">
                No colors in your stash yet. Add one above, or use the <strong>Scan PDF</strong> tool to find what you have.
              </td>
            </tr>
          {:else}
            {#each filteredStash as it}
              <tr>
                <td>
                  <span class="sw" style={`--c:${it.hex};`}></span>
                </td>

                <td class="code">{it.code}</td>

                <td class="name">{it.name}</td>

                <td class="qty">
                  <div class="stepper">
                    <button
                      class="btn mini"
                      on:click={() => adjust(it, -1)}
                      aria-label="Minus one"
                    >
                      −
                    </button>
                    <output>{it.quantity}</output>
                    <button
                      class="btn mini"
                      on:click={() => adjust(it, +1)}
                      aria-label="Plus one"
                    >
                      ＋
                    </button>
                  </div>
                </td>

                <td class="notes">
                  <input
                    class="notein"
                    placeholder="optional…"
                    bind:value={it.notes}
                    on:change={() => saveNotes(it)}
                  />
                </td>

                <td class="actions">
                  <button class="btn danger" on:click={() => remove(it)}>Delete</button>
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    {:else}
      <!-- ===== WISHLIST VIEW ===== -->
      <div class="wishlist-intro">
        <p>
          These are colors you’ve marked as <strong>needed</strong> from scans or browsing.
          When you pick them up, move them into your stash with one click.
        </p>
      </div>

      <table class="inv inv-wishlist">
        <colgroup>
          <col style="width:60px" />   <!-- swatch -->
          <col style="width:100px" />  <!-- code -->
          <col />                      <!-- name -->
          <col style="width:120px" />  <!-- desired qty -->
          <col style="width:160px" />  <!-- actions -->
        </colgroup>

        <thead>
          <tr>
            <th>Swatch</th>
            <th>Code</th>
            <th>Name</th>
            <th>Need</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {#if loadingWishlist}
            <tr>
              <td colspan="5" class="empty">Loading your shopping list…</td>
            </tr>
          {:else if !filteredWishlist.length}
            <tr>
              <td colspan="5" class="empty">
                Your shopping list is empty. Scan a PDF and use
                <strong>“Add all to shopping list”</strong> to fill this up.
              </td>
            </tr>
          {:else}
            {#each filteredWishlist as it}
              <tr>
                <td>
                  <span class="sw" style={`--c:${it.hex};`}></span>
                </td>
                <td class="code">{it.code}</td>
                <td class="name">{it.name}</td>
                <td class="qty wishlist-qty">
                  {it.desired_qty ?? 1}
                </td>
                <td class="actions">
                  <button class="btn primary small" on:click={() => moveWishlistToStash(it)}>
                    Move to stash
                  </button>
                  <button class="btn ghost" on:click={() => removeWishlistItem(it)}>
                    Remove
                  </button>
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    {/if}
  </section>
{/if}

<style>
  .inv-shell {
    width: min(1360px, 96vw);
    margin: 18px auto 24px;
  }

  .inv-header {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: flex-end;
    margin-bottom: 10px;
  }

  h1 {
    margin: 0;
    font-weight: 700;
    font-size: 1.6rem;
    letter-spacing: 0.2px;
    color: var(--text);
  }

  .subtitle {
    margin: 4px 0 0;
    font-size: 0.9rem;
    color: var(--text-2, color-mix(in oklab, CanvasText 70%, transparent));
  }

  .view-toggle {
    display: inline-flex;
    padding: 3px;
    border-radius: 999px;
    background: var(--bg);
    border: 1px solid color-mix(in oklab, CanvasText 12%, transparent);
    gap: 4px;
  }

  .view-pill {
    position: relative;
    border-radius: 999px;
    border: none;
    padding: 6px 16px;
    font-size: 0.9rem;
    cursor: pointer;
    background: transparent;
    color: var(--text);
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .view-pill[data-active='true'] {
    background: color-mix(in oklab, #f5f0e6 70%, Canvas 30%);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.18);
  }

  .count-pill {
    min-width: 24px;
    height: 20px;
    border-radius: 999px;
    padding: 0 6px;
    display: grid;
    place-items: center;
    font-size: 0.75rem;
    background: color-mix(in oklab, CanvasText 8%, Canvas 92%);
    font-variant-numeric: tabular-nums;
  }

  .inv-search-row {
    margin-top: 14px;
    margin-bottom: 10px;
  }

  .search-pill {
    width: 100%;
    height: 42px;
    padding: 0 16px;
    border-radius: 999px;
    border: 1px solid color-mix(in oklab, CanvasText 14%, transparent);
    background: color-mix(in oklab, Canvas 92%, transparent);
    color: color-mix(in oklab, CanvasText 94%, transparent);
    font: inherit;
    -webkit-appearance: none;
    outline: none;
  }

  .search-pill::placeholder {
    color: color-mix(in oklab, CanvasText 60%, transparent);
  }

  .search-pill:focus {
    border-color: color-mix(in oklab, #5bbcff 46%, transparent);
    box-shadow: 0 0 0 3px color-mix(in oklab, #5bbcff 22%, transparent);
  }

  /* ===== STASH CONTROLS ===== */

  .inv-controls {
    display: grid;
    grid-template-columns: 60px 120px 80px minmax(380px, 1fr) 132px;
    gap: 12px;
    align-items: center;
    margin: 0 0 8px;
  }

  .ghost-swatch {
    width: 28px;
    height: 28px;
    border-radius: 999px;
  }

  .ctl.id {
    grid-column: 2;
    text-align: center;
  }
  .ctl.qty {
    grid-column: 3;
    text-align: center;
  }
  .ctl.notes {
    grid-column: 4;
  }
  .btn.primary {
    grid-column: 5;
    justify-self: end;
  }

  :where(.ctl, .notein) {
    height: 42px;
    padding: 0 16px;
    border-radius: 999px;
    border: 1px solid color-mix(in oklab, CanvasText 14%, transparent);
    background: color-mix(in oklab, Canvas 92%, transparent);
    color: color-mix(in oklab, CanvasText 94%, transparent);
    font: inherit;
    box-sizing: border-box;
    -webkit-appearance: none;
    outline: none;
  }
  :where(.ctl, .notein)::placeholder {
    color: color-mix(in oklab, CanvasText 60%, transparent);
  }
  :where(.ctl, .notein):focus {
    border-color: color-mix(in oklab, #5bbcff 46%, transparent);
    box-shadow: 0 0 0 3px color-mix(in oklab, #5bbcff 22%, transparent);
  }

  .notein {
    width: 100%;
  }

  /* ===== TABLE SHARED ===== */

  .inv {
    width: 100%;
    margin: 6px 0 0;
    table-layout: fixed;
    border-collapse: separate;
    border-spacing: 0;
  }

  .inv thead th {
    position: sticky;
    top: 0;
    z-index: 1;
    text-align: left;
    padding: 10px 16px;
    background: color-mix(in oklab, Canvas 96%, transparent);
  }

  .inv tbody td {
    padding: 10px 16px;
    vertical-align: middle;
    border-top: 1px solid color-mix(in oklab, CanvasText 10%, transparent);
  }

  .inv tbody tr {
    height: 52px;
  }

  .inv tbody tr:nth-child(even) {
    background: color-mix(in oklab, Canvas 96%, transparent);
  }

  .inv tbody tr:nth-child(odd) {
    background: color-mix(in oklab, Canvas 92%, transparent);
  }

  .inv .empty {
    text-align: center;
    padding: 18px 16px;
    color: color-mix(in oklab, CanvasText 68%, transparent);
    font-size: 0.9rem;
  }

  /* Swatch circle */
  .sw {
    display: inline-block;
    width: 28px;
    height: 28px;
    border-radius: 999px;
    background: var(--c, #bbb);
    border: 1px solid color-mix(in oklab, CanvasText 18%, transparent);
  }

  /* Code column centered + tabular */
  .code {
    text-align: center;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.02em;
    color: var(--text);
  }

  .name {
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
  }

  /* Qty stepper */
  .stepper {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border-radius: 999px;
    padding: 2px 4px;
    background: color-mix(in oklab, Canvas 94%, transparent);
    border: 1px solid color-mix(in oklab, CanvasText 12%, transparent);
  }

  .stepper output {
    min-width: 24px;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  .btn {
    height: 32px;
    padding: 0 10px;
    border-radius: 8px;
    cursor: pointer;
    border: 1px solid color-mix(in oklab, CanvasText 16%, transparent);
    background: color-mix(in oklab, Canvas 98%, transparent);
    color: inherit;
    transition: background 0.12s, border-color 0.12s, transform 0.04s;
  }

  .btn.primary {
    height: 42px;
    padding: 0 16px;
    border-radius: 999px;
    border: 1px solid color-mix(in oklab, CanvasText 20%, transparent);
    background: color-mix(in oklab, #5bbcff 18%, Canvas 96%);
  }

  .btn.primary:hover {
    background: color-mix(in oklab, #5bbcff 24%, Canvas 94%);
  }

  .btn.primary.small {
    height: 32px;
    padding: 0 12px;
    border-radius: 999px;
  }

  .btn.danger {
    border-radius: 999px;
  }

  .btn.ghost {
    background: transparent;
  }

  .btn.mini {
    height: 24px;
    padding: 0 6px;
    border-radius: 999px;
    font-size: 0.75rem;
  }

  .wishlist-intro {
    margin: 6px 0 4px;
    font-size: 0.88rem;
    color: color-mix(in oklab, CanvasText 72%, transparent);
  }

  .wishlist-qty {
    font-variant-numeric: tabular-nums;
    text-align: center;
  }

  /* ====== RESPONSIVE ====== */

  @media (max-width: 1100px) {
    .inv-header {
      flex-direction: column;
      align-items: flex-start;
    }

    .inv-controls {
      grid-template-columns: 60px 1fr 80px minmax(240px, 1fr) 132px;
    }
  }

  @media (max-width: 720px) {
    .inv-header {
      align-items: stretch;
    }

    .inv-controls {
      grid-template-columns: 60px 1fr 80px;
      row-gap: 8px;
    }

    .ctl.notes {
      grid-column: 2 / span 2;
    }

    .btn.primary {
      grid-column: 3;
    }

    /* hide code column on tiny screens */
    .inv col:nth-child(2),
    .inv th:nth-child(2),
    .inv td:nth-child(2) {
      display: none;
    }
  }
</style>
