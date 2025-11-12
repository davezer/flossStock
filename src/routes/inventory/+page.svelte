<script>
  export let data;

  import { pushToast } from '$lib/stores/toast.js';

  let q = '';
   let items = data?.items ?? [];
  let adding = { color_id: '', quantity: 1, notes: '' };

  async function refresh() {
    const r = await fetch('/api/inventory' + (q ? `?q=${encodeURIComponent(q)}` : ''), { cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    items = j.items || [];
  }
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
    const idx = items.findIndex((x) => x.color_id === id);
    if (idx === -1) return;

    const keep = items[idx];                // for rollback
    items = [...items.slice(0, idx), ...items.slice(idx + 1)]; // optimistic

    try {
      const r = await fetch(`/api/inventory/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j?.ok === false) throw new Error(j?.message || `HTTP ${r.status}`);
    } catch (e) {
      // rollback
      items = [...items.slice(0, idx), keep, ...items.slice(idx)];
      alert(`Delete failed: ${e.message || e}`);
    }
  }
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
      pushToast?.({ type: 'success', msg: 'Added to Inventory!' });
      adding = { color_id: '', quantity: 1, notes: '' };
      await refresh();
    } catch (err) {
      pushToast?.({ type: 'error', msg: 'Could not update inventory.' });
    }
  }

  async function setQty(row, next) {
    try {
      const r = await fetch(`/api/inventory/${encodeURIComponent(row.id)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ quantity: Number(next) })
      });
      if (r.status === 401) {
        pushToast?.({ type: 'warning', msg: 'You must be signed in to do that.' });
        return;
      }
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j?.ok === false) {
        pushToast?.({ type: 'error', msg: j?.error || 'Update failed.' });
        return;
      }
      await refresh();
    } catch (e) {
      pushToast?.({ type: 'error', msg: 'Update failed.' });
    }
  }

  async function removeRow(row) {
    try {
      const r = await fetch(`/api/inventory/${encodeURIComponent(row.id)}`, { method: 'DELETE' });
      if (r.status === 401) {
        pushToast?.({ type: 'warning', msg: 'You must be signed in to do that.' });
        return;
      }
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j?.ok === false) {
        pushToast?.({ type: 'error', msg: j?.error || 'Delete failed.' });
        return;
      }
      await refresh();
    } catch (e) {
      pushToast?.({ type: 'error', msg: 'Delete failed.' });
    }
  }
</script>

<svelte:head><title>Inventory</title></svelte:head>

{#if !data.user}
  <div class="card">Please sign in to view your inventory.</div>
{:else}
  <div class="inv-controls">
      <input class="ctl search" placeholder="Search code or name…" />
      <input class="ctl id" placeholder="color_id" />
      <input class="ctl notes" placeholder="notes (optional)" />
      <button class="btn primary">Add/Update</button>
    </div>
 

  <table class="inv">
  <!-- lock column widths -->
  <colgroup>
    <col style="width:60px" />   <!-- swatch -->
    <col style="width:100px" />  <!-- code -->
    <col />                      <!-- name (flex) -->
    <!-- <col style="width:140px" />  qty -->
    <col />                      <!-- notes (flex) -->
    <col style="width:112px" />  <!-- actions -->
  </colgroup>

  <thead>
    <tr>
      <th>Swatch</th>
      <th>Code</th>
      <th>Name</th>
      <!-- <th>Qty</th> -->
      <th>Notes</th>
      <th>Actions</th>
    </tr>
  </thead>

  <tbody>
    {#each items as it}
      <tr>
        <td>
          <span class="sw" style={`--c:${it.hex};`}></span>
        </td>

        <td class="code">{it.code}</td>

        <td class="name">{it.name}</td>

        <!-- <td class="qty">
          <div class="stepper">
            <button class="btn mini" on:click={() => adjust(it, -1)} aria-label="Minus">−</button>
            <output>{it.quantity}</output>
            <button class="btn mini" on:click={() => adjust(it, +1)} aria-label="Plus">＋</button>
          </div>
        </td> -->

        <td class="notes">
          <input class="notein" placeholder="optional…" bind:value={it.notes} on:change={() => saveNotes(it)} />
        </td>

        <td class="actions">
          <button class="btn danger" on:click={() => remove(it)}>Delete</button>
        </td>
      </tr>
    {/each}
  </tbody>
</table>

{/if}

<style>

/* ====== DESKTOP WIDTH + SHARED ====== */
.inv,
.inv-controls{
  width: min(1360px, 96vw);
  margin: 14px auto 12px;
}

/* Controls mirror table columns: 60 | 120 | 1fr | 1fr | 132 */
.inv-controls{
  display:grid;
  grid-template-columns: 60px 120px minmax(420px,1fr) minmax(380px,1fr) 132px;
  gap:12px;
  align-items:center;
}

/* Invisible placeholder = Swatch column so controls align */
.inv-controls::before{
  content:"";
  display:block;
  grid-column:1;
}

/* Place each control over its column */
.ctl.id     { grid-column: 2; text-align:center; }
.ctl.search { grid-column: 3; }
.ctl.notes  { grid-column: 4; }
.btn.primary{ grid-column: 5; justify-self:end; }

/* Lock table columns to match the grid above */
.inv{ table-layout: fixed; border-collapse: separate; border-spacing: 0; }
.inv col:nth-child(1){ width:60px !important; }   /* swatch */
.inv col:nth-child(2){ width:120px !important; }  /* code   */
.inv col:nth-child(5){ width:132px !important; }  /* actions */

/* Sticky header + comfy rows */
.inv thead th{
  position: sticky; top: 0; z-index: 1;
  text-align:left; padding: 12px 16px;
}
.inv tbody td{ padding: 12px 16px; vertical-align: middle; }
.inv tbody tr{ height: 56px; }

/* Swatch circle */
.sw{
  display:inline-block; width: 28px; height: 28px; border-radius: 999px;
  background: var(--c,#bbb);
  border:1px solid color-mix(in oklab, CanvasText 18%, transparent);
}

/* Code column centered + tabular */
.code{
  text-align:center;
  font-variant-numeric: tabular-nums;
  letter-spacing:.02em;
  color: var(--text);
}

/* Uniform pill styling for top inputs AND row note inputs */
:where(.ctl, .notein){
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
:where(.ctl, .notein)::placeholder{
  color: color-mix(in oklab, CanvasText 60%, transparent);
}
:where(.ctl, .notein):focus{
  border-color: color-mix(in oklab, #5bbcff 46%, transparent);
  box-shadow: 0 0 0 3px color-mix(in oklab, #5bbcff 22%, transparent);
}
.notein{ width: 100%; }

/* Buttons to match the pills */
.btn{
  height: 32px; padding: 0 10px;
  border-radius: 8px; cursor: pointer;
  border:1px solid color-mix(in oklab, CanvasText 16%, transparent);
  background: color-mix(in oklab, Canvas 98%, transparent);
  color: inherit;
  transition: background .12s, border-color .12s, transform .04s;
}
.btn.primary{
  height: 42px; padding: 0 16px; border-radius: 999px;
  border: 1px solid color-mix(in oklab, CanvasText 20%, transparent);
  background: color-mix(in oklab, #5bbcff 18%, Canvas 96%);
}
.btn.primary:hover{
  background: color-mix(in oklab, #5bbcff 24%, Canvas 94%);
}
.btn.danger{ border-radius: 999px; }

/* ====== MEDIUM (<=1100px) ====== */
@media (max-width:1100px){
  .inv-controls{
    grid-template-columns: 60px 100px 1fr 1fr 112px;
    gap:10px;
  }
  .inv col:nth-child(2){ width:100px !important; }
  .inv col:nth-child(5){ width:112px !important; }
  .inv, .inv-controls{ width: min(1200px, 96vw); }
  .inv tbody tr{ height: 52px; }
}

/* ====== MOBILE (<=720px) ====== */
@media (max-width:720px){
  /* Hide Code column on phones */
  .inv col:nth-child(2),
  .inv th:nth-child(2),
  .inv td:nth-child(2){ display:none; }

  /* Controls: keep ghost swatch, then wide input + button */
  .inv-controls{
    grid-template-columns: 60px 1fr 96px;
    gap: 8px;
  }
  .ctl.id{ display:none; }
  .ctl.search{ grid-column: 2; }
  .ctl.notes { grid-column: 2; margin-top:8px; }
  .btn.primary{ grid-column: 3; justify-self:end; }

  .inv tbody td{ padding: 10px 12px; }
  .inv tbody tr{ height: 50px; }
}

</style>
