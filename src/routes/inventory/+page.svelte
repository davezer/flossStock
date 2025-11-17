<script>
  import { onMount } from 'svelte';
  import { pushToast } from '$lib/stores/toast.js';

  export let data;

  const user = data.user;

  // which panel is active: "stash" | "wishlist" | "projects"
  let view = 'stash';

  // shared search text
  let q = '';

  // stash (have) items come from server data initially
  let stashItems = data?.items ?? [];

  // wishlist (shopping list) items will be loaded on mount
  let wishlistItems = [];
  let loadingWishlist = false;

  // projects from server
  let projects = data?.projects ?? [];
  let loadingProjects = false;
  let activeProjectId = '';
  $: if (!activeProjectId && projects.length) {
    activeProjectId = projects[0].id;
  }

  // map: color_id -> [{ id, name }]
  let colorProjects = {};

  // ------- helpers for membership display -------

  function getMembership(it) {
    const arr = colorProjects[it.color_id];
    return Array.isArray(arr) ? arr : [];
  }

  async function loadColorProjects(colorId) {
    // already loaded or currently loading? (simple guard)
    if (colorProjects[colorId] === '__loading__') return;
    if (Array.isArray(colorProjects[colorId])) return;

    colorProjects = { ...colorProjects, [colorId]: '__loading__' };

    try {
      const r = await fetch(
        `/api/colors/${encodeURIComponent(colorId)}/projects`,
        { cache: 'no-store' }
      );
      const j = await r.json().catch(() => ({}));
      if (r.ok && j?.ok !== false && Array.isArray(j.projects)) {
        colorProjects = { ...colorProjects, [colorId]: j.projects };
      } else {
        colorProjects = { ...colorProjects, [colorId]: [] };
      }
    } catch (e) {
      console.warn('loadColorProjects failed', e);
      colorProjects = { ...colorProjects, [colorId]: [] };
    }
  }

  // kick off loading memberships for visible stash items
  onMount(() => {
    if (user) {
      loadWishlist();
      // refresh project list from API so projects tab stays in sync
      loadProjects();

      // fire-and-forget load of memberships
      for (const it of stashItems) {
        if (it?.color_id) {
          loadColorProjects(it.color_id);
        }
      }
    }
  });

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
  // projects: just match on project name using the same q
  $: filteredProjects = projects.filter((p) => {
    if (!q) return true;
    const s = q.trim().toLowerCase();
    return (p.name ?? '').toLowerCase().includes(s);
  });

  // --- API helpers ---

  async function refreshStash() {
    try {
      const r = await fetch('/api/inventory', { cache: 'no-store' });
      const j = await r.json().catch(() => ({}));
      const rawItems = Array.isArray(j.items) ? j.items : [];
      stashItems = rawItems.map((it) => ({
        color_id: it.color_id,
        quantity: Number(it.quantity ?? it.qty ?? 0) || 0,
        notes: it.notes ?? '',
        code: it.code ?? '',
        name: it.name ?? '',
        hex: it.hex ?? '#cccccc',
        updated_at: it.updated_at ?? null,
        used_in_projects: Number(it.used_in_projects ?? it.project_count ?? 0) || 0
      }));
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

  async function loadProjects() {
    if (!user) return;
    loadingProjects = true;
    try {
      const r = await fetch('/api/projects', { cache: 'no-store' });
      const j = await r.json().catch(() => ({}));

      if (r.ok && j?.ok !== false) {
        const raw = Array.isArray(j.projects)
          ? j.projects
          : Array.isArray(j.items)
          ? j.items
          : [];
        projects = raw.map((p) => ({
          id: p.id,
          name: p.name,
          file_key: p.pdf_path ?? p.file_key ?? p.fileKey ?? null,
          created_at: p.created_at ?? null
        }));
      }
    } catch (e) {
      console.warn('loadProjects failed', e);
    } finally {
      loadingProjects = false;
    }
  }

  // ===== QTY / NOTES / DELETE for stash =====

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

  const inflightQty = new Set();
  export async function adjust(it, delta) {
    const id = it.color_id;
    if (inflightQty.has(id)) return;
    const next = Math.max(0, (Number(it.qty ?? it.quantity) || 0) + Number(delta || 0));
    if (next === it.qty || next === it.quantity) return;

    inflightQty.add(id);
    const prev = it.qty ?? it.quantity;
    it.qty = next;
    it.quantity = next;

    try {
      await patchItem(id, { quantity: next });
    } catch (e) {
      it.qty = prev;
      it.quantity = prev;
      alert(`Update failed: ${e.message || e}`);
    } finally {
      inflightQty.delete(id);
    }
  }

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

  export async function remove(it) {
    const id = it.color_id;
    const idx = stashItems.findIndex((x) => x.color_id === id);
    if (idx === -1) return;

    const keep = stashItems[idx];
    stashItems = [...stashItems.slice(0, idx), ...stashItems.slice(idx + 1)];

    try {
      const r = await fetch(`/api/inventory/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j?.ok === false) throw new Error(j?.message || `HTTP ${r.status}`);
    } catch (e) {
      stashItems = [...stashItems.slice(0, idx), keep, ...stashItems.slice(idx)];
      alert(`Delete failed: ${e.message || e}`);
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

  // ===== PROJECTS tab: upload new project =====

  let projectName = '';
  let projectFile = null;
  let projectBusy = false;
  let projectError = '';
  let projectStatus = '';

  async function handleProjectUpload(e) {
    e.preventDefault();
    if (!projectFile) {
      projectError = 'Please choose a PDF.';
      return;
    }

    projectError = '';
    projectStatus = 'Uploading…';
    projectBusy = true;

    const fd = new FormData();
    fd.append('name', projectName);
    fd.append('file', projectFile);

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        body: fd
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.ok === false) {
        throw new Error(j?.message || `HTTP ${res.status}`);
      }

      projectStatus = `Uploaded "${j.project?.name ?? projectName}"`;
      pushToast?.({ type: 'success', msg: 'Project uploaded!' });

      if (j.project) {
        projects = [j.project, ...projects];
      } else {
        await loadProjects();
      }

      projectName = '';
      projectFile = null;
      e.target.reset?.();
    } catch (err) {
      projectError = err.message || String(err);
      projectStatus = '';
      pushToast?.({ type: 'error', msg: projectError });
    } finally {
      projectBusy = false;
    }
  }

  function onProjectFileChange(e) {
    projectFile = e.currentTarget.files?.[0] ?? null;
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
        <button
          type="button"
          role="tab"
          aria-selected={view === 'projects'}
          class="view-pill"
          data-active={view === 'projects'}
          on:click={() => (view = 'projects')}
        >
          Projects
          <span class="count-pill">{projects.length}</span>
        </button>
      </div>
    </header>

    <!-- shared search line -->
    <div class="inv-search-row">
      <input
        class="search-pill"
        placeholder={view === 'projects' ? 'Search projects…' : 'Search code or name…'}
        bind:value={q}
        spellcheck="false"
        aria-label="Search inventory"
      />
    </div>

    {#if view === 'stash'}
      <!-- ===== STASH VIEW ===== -->
      <table class="inv">
        <colgroup>
          <col style="width:60px" />
          <col style="width:100px" />
          <col />
          <col style="width:120px" />
          <col />
          <col style="width:112px" />
        </colgroup>

        <thead>
          <tr>
            <th>Swatch</th>
            <th>Code</th>
            <th>Name</th>
            <th>Qty</th>
            <th>Projects</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {#if !filteredStash.length}
            <tr>
              <td colspan="6" class="empty">
                No colors in your stash yet. Scan a PDF or add from your shopping list.
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
                    <output>{it.qty ?? it.quantity}</output>
                    <button
                      class="btn mini"
                      on:click={() => adjust(it, +1)}
                      aria-label="Plus one"
                    >
                      ＋
                    </button>
                  </div>
                </td>

                <!-- NEW: read-only projects list -->
                <td class="projects-cell">
                  {#if !projects.length}
                    <span class="project-pill no-projects">No projects yet</span>
                  {:else}
                    {#if colorProjects[it.color_id] === '__loading__'}
                      <span class="project-pill loading">Loading…</span>
                    {:else}
                      {#if !colorProjects[it.color_id]}
                        <!-- kick off load on first render -->
                        {@html (() => { loadColorProjects(it.color_id); return ''; })()}
                        <span class="project-pill loading">Loading…</span>
                      {:else if getMembership(it).length}
                        <div class="project-chip-row">
                          {#each getMembership(it) as p}
                            <span class="project-pill has-projects">{p.name}</span>
                          {/each}
                        </div>
                      {:else}
                        <span class="project-pill no-projects">Not in any project</span>
                      {/if}
                    {/if}
                  {/if}
                </td>

                <td class="actions">
                  <button class="btn danger" on:click={() => remove(it)}>Delete</button>
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    {:else if view === 'wishlist'}
      <!-- ===== WISHLIST VIEW ===== -->
      <div class="wishlist-intro">
        <p>
          These are colors you’ve marked as <strong>needed</strong>.
          When you pick them up, move them into your stash with one click.
        </p>
      </div>

      <table class="inv inv-wishlist">
        <colgroup>
          <col style="width:60px" />
          <col style="width:100px" />
          <col />
          <col style="width:120px" />
          <col style="width:160px" />
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
    {:else}
      <!-- ===== PROJECTS VIEW ===== -->
      <div class="projects-shell">
        <div class="projects-intro">
          <h2>Projects</h2>
          <p>
            Upload your cross-stitch patterns as PDFs and keep track of which threads are used in each project.
          </p>
        </div>

        <form class="project-form" on:submit={handleProjectUpload}>
          <div class="pf-row">
            <label class="pf-label">
              <span>Project name</span>
              <input
                required
                bind:value={projectName}
                placeholder="Cozy Winter Forest"
              />
            </label>

            <label class="pf-label">
              <span>PDF file</span>
              <input
                type="file"
                accept="application/pdf"
                required
                on:change={onProjectFileChange}
              />
            </label>
          </div>

          <button class="btn primary" type="submit" disabled={projectBusy}>
            {#if projectBusy}Uploading…{:else}Upload project{/if}
          </button>

          {#if projectStatus}
            <p class="pf-status">{projectStatus}</p>
          {/if}
          {#if projectError}
            <p class="pf-error">{projectError}</p>
          {/if}
        </form>

        <div class="projects-list">
          <h3>Your projects</h3>
          {#if loadingProjects}
            <p class="empty">Loading projects…</p>
          {:else if !filteredProjects.length}
            <p class="empty">
              No projects yet. Upload a PDF above to get started.
            </p>
          {:else}
            <ul class="projects-ul">
              {#each filteredProjects as p}
                <li class="project-item">
                  <a class="pi-main" href={`/projects/${p.id}`}>
                    <div class="pi-icon">📄</div>
                    <div class="pi-text">
                      <div class="pi-name">{p.name}</div>
                      <div class="pi-meta">
                        Added {p.created_at ? new Date(p.created_at * 1000).toLocaleDateString() : ''}
                      </div>
                    </div>
                  </a>
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      </div>
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
    color: var(--text, color-mix(in oklab, CanvasText 70%, transparent));
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

  .sw {
    display: inline-block;
    width: 28px;
    height: 28px;
    border-radius: 999px;
    background: var(--c, #bbb);
    border: 1px solid color-mix(in oklab, CanvasText 18%, transparent);
  }

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

  .projects-cell {
    white-space: nowrap;
  }

  .project-chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .project-pill {
    display: inline-flex;
    align-items: center;
    padding: 0.15rem 0.6rem;
    border-radius: 999px;
    font-size: 0.78rem;
    font-variant-numeric: tabular-nums;
    border: 1px solid color-mix(in oklab, CanvasText 12%, transparent);
    background: color-mix(in oklab, Canvas 96%, transparent);
  }

  .project-pill.has-projects {
    background: color-mix(in oklab, #c6f1c0 35%, Canvas 65%);
    border-color: color-mix(in oklab, #4b9b51 40%, transparent);
    color: color-mix(in oklab, #1f4f23 90%, transparent);
  }

  .project-pill.no-projects {
    opacity: 0.75;
  }

  .project-pill.loading {
    opacity: 0.7;
    font-style: italic;
  }

  .projects-shell {
    margin-top: 8px;
    display: grid;
    gap: 16px;
  }

  .projects-intro h2 {
    margin: 0 0 4px;
    font-size: 1.2rem;
  }

  .projects-intro p {
    margin: 0;
    font-size: 0.9rem;
    color: color-mix(in oklab, CanvasText 72%, transparent);
  }

  .project-form {
    padding: 12px;
    border-radius: 12px;
    border: 1px solid color-mix(in oklab, CanvasText 10%, transparent);
    background: color-mix(in oklab, Canvas 97%, transparent);
    display: grid;
    gap: 8px;
  }

  .pf-row {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 1.2fr);
    gap: 12px;
  }

  .pf-label span {
    display: block;
    font-size: 0.85rem;
    margin-bottom: 2px;
  }

  .pf-label input[type='text'],
  .pf-label input[type='file'],
  .pf-label input:not([type]) {
    width: 100%;
    height: 38px;
    padding: 6px 12px;
    border-radius: 999px;
    border: 1px solid color-mix(in oklab, CanvasText 14%, transparent);
    background: color-mix(in oklab, Canvas 96%, transparent);
    font: inherit;
  }

  .pf-status {
    font-size: 0.85rem;
    color: color-mix(in oklab, CanvasText 70%, transparent);
  }

  .pf-error {
    font-size: 0.85rem;
    color: #c33;
  }

  .projects-list h3 {
    margin: 0 0 4px;
    font-size: 1rem;
  }

  .projects-ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 6px;
  }

  .project-item {
    padding: 8px 10px;
    border-radius: 10px;
    border: 1px solid color-mix(in oklab, CanvasText 10%, transparent);
    background: color-mix(in oklab, Canvas 97%, transparent);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .pi-main {
    display: flex;
    align-items: center;
    gap: 8px;
    text-decoration: none;
    color: inherit;
  }

  .pi-main:hover .pi-name {
    text-decoration: underline;
  }

  .pi-icon {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    display: grid;
    place-items: center;
    background: color-mix(in oklab, CanvasText 8%, Canvas 92%);
  }

  .pi-text {
    display: grid;
    gap: 1px;
  }

  .pi-name {
    font-size: 0.95rem;
    font-weight: 500;
  }

  .pi-meta {
    font-size: 0.75rem;
    color: color-mix(in oklab, CanvasText 70%, transparent);
  }

  @media (max-width: 1100px) {
    .inv-header {
      flex-direction: column;
      align-items: flex-start;
    }

    .pf-row {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 720px) {
    .inv-header {
      align-items: stretch;
    }

    .inv col:nth-child(2),
    .inv th:nth-child(2),
    .inv td:nth-child(2) {
      display: none;
    }
  }
</style>
