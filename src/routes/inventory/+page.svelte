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
    <col style="width:56px" />   <!-- swatch -->
    <col style="width:100px" />  <!-- code -->
    <col />                      <!-- name (flex) -->
    <col style="width:140px" />  <!-- qty -->
    <col />                      <!-- notes (flex) -->
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
  /* container width */
.inv{
  width: min(1200px, 94vw);
  margin: 16px auto 48px;
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;          /* <-- crucial: respect colgroup widths */
  background: color-mix(in oklab, Canvas 92%, transparent);
  border: 1px solid color-mix(in oklab, CanvasText 12%, transparent);
  border-radius: 14px;
  overflow: clip;
}

/* header */
.inv thead th{
  text-align: left;
  padding: 12px 14px;
  font-weight: 700;
  letter-spacing: .2px;
  border-bottom: 1px solid color-mix(in oklab, CanvasText 12%, transparent);
  background: color-mix(in oklab, Canvas 88%, transparent);
}

/* rows */
.inv tbody td{
  padding: 10px 14px;
  vertical-align: middle;
  border-bottom: 1px solid color-mix(in oklab, CanvasText 8%, transparent);
  color: color-mix(in oklab, CanvasText 92%, #fff 0%);
}

.inv tbody tr:last-child td{ border-bottom: 0; }
.inv tbody tr:hover td{ background: color-mix(in oklab, Canvas 96%, transparent); }

/* swatch */
.sw{
  display:inline-block; width: 28px; height: 28px; border-radius: 999px;
  background: var(--c,#bbb);
  border:1px solid color-mix(in oklab, CanvasText 18%, transparent);
}

/* monospace-ish code; center */
.code{
  font-variant-numeric: tabular-nums;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  text-align: center;
  color: color-mix(in oklab, CanvasText 85%, transparent);
}

/* name wraps but keeps row height tidy */
.name{
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;     /* inventory can truncate here if needed */
}

/* qty stepper always centered and same width */
.qty{ text-align: center; }
.stepper{
  display:inline-grid;
  grid-template-columns: 34px 46px 34px;  /* button | value | button */
  align-items:center;
  gap:6px;
}
.stepper output{
  display:grid; place-items:center;
  height:34px; min-width:46px; border-radius:8px;
  border:1px solid color-mix(in oklab, CanvasText 12%, transparent);
  background: color-mix(in oklab, Canvas 98%, transparent);
  font-variant-numeric: tabular-nums;
}
.btn.mini{
  width:34px; height:34px; padding:0;
  display:grid; place-items:center;       /* <- centers glyph */
  line-height:1; font-size:18px;          /* crisp minus/plus */
  border-radius:8px;
}

/* note input fills column but stays compact */
.notein{
  width: 100%;
  height: 32px;
  padding: 6px 10px;
  border-radius: 8px;
  border:1px solid color-mix(in oklab, CanvasText 12%, transparent);
  background: color-mix(in oklab, Canvas 98%, transparent);
  color: inherit;
}

/* actions column centered */
.actions{ text-align: center; }

/* Buttons */
.btn{
  height: 32px; padding: 0 10px;
  border-radius: 8px; cursor: pointer;
  border:1px solid color-mix(in oklab, CanvasText 16%, transparent);
  background: color-mix(in oklab, Canvas 98%, transparent);
  color: inherit;
  transition: background .12s, border-color .12s, transform .04s;
}
.btn:hover{ background: color-mix(in oklab, Canvas 96%, transparent); border-color: color-mix(in oklab, CanvasText 26%, transparent); }
.btn:active{ transform: scale(.98); }

.btn.mini{ width: 32px; padding: 0; font-size: 18px; }
.btn.danger{
  border-color: color-mix(in oklab, #ff6060 45%, transparent);
  background: color-mix(in oklab, #ff6060 12%, Canvas 98%);
}
.btn.danger:hover{
  background: color-mix(in oklab, #ff6060 18%, Canvas 96%);
  border-color: color-mix(in oklab, #ff6060 60%, transparent);
}
.inv thead th{ position: sticky; top: 0; z-index: 1; }

.inv-controls{
  width:min(1200px,94vw);
  margin:12px auto 10px;
  display:flex; gap:10px; align-items:center; flex-wrap:wrap;
}
.ctl{
  height:38px; padding:0 14px; border-radius:999px;
  border:1px solid color-mix(in oklab, CanvasText 14%, transparent);
  background: color-mix(in oklab, Canvas 92%, transparent);
  color: color-mix(in oklab, CanvasText 94%, transparent);
}
.ctl::placeholder{ color: color-mix(in oklab, CanvasText 60%, transparent); }
.ctl.search{ flex:1 1 360px; min-width:240px; }
.ctl.id{ width:160px; font-variant-numeric: tabular-nums; text-align:center; }
.ctl.notes{ flex:1 1 260px; min-width:200px; }

.btn.primary{
  height:38px; padding:0 14px; border-radius:12px;
  border:1px solid color-mix(in oklab, CanvasText 20%, transparent);
  background: color-mix(in oklab, #5bbcff 18%, Canvas 96%);
}
.btn.primary:hover{
  background: color-mix(in oklab, #5bbcff 24%, Canvas 94%);
}

@media (max-width: 720px){
  /* hide the Code column (2) */
  .inv col:nth-child(2), .inv th:nth-child(2), .inv td:nth-child(2){ display:none; }

  /* shrink actions; let notes wrap */
  .inv col:nth-child(6){ width:90px !important; }
  .notein{ height:auto; min-height:34px; }
}
</style>
