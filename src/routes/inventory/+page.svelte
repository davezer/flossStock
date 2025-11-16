<script>
	import { onMount } from 'svelte';
	import { pushToast } from '$lib/stores/toast.js';
	import { renderProjectThumbnail } from '../scan/renderPdfThumb.js';

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
	let loadingProjects = false; // ✅ this was missing before
	let activeProjectId = '';
	$: if (!activeProjectId && projects.length) {
		activeProjectId = projects[0].id;
	}

	let colorProjects = {};
	let openProjectPicker = null;

	function getMembership(it) {
		const arr = colorProjects[it.color_id];
		return Array.isArray(arr) ? arr : [];
	}

	function isInProject(it, projectId) {
		return getMembership(it).some((p) => p.id === projectId);
	}

	async function loadColorProjects(colorId) {
		try {
			const r = await fetch(`/api/colors/${encodeURIComponent(colorId)}/projects`, {
				cache: 'no-store'
			});
			const j = await r.json().catch(() => ({}));
			if (r.ok && j?.ok !== false && Array.isArray(j.projects)) {
				colorProjects = { ...colorProjects, [colorId]: j.projects };
			}
		} catch (e) {
			console.warn('loadColorProjects failed', e);
		}
	}

	async function toggleProjectPicker(it) {
		if (!projects.length) return;
		const id = it.color_id;
		if (!colorProjects[id]) {
			await loadColorProjects(id);
		}
		openProjectPicker = openProjectPicker === id ? null : id;
	}

	const inflightProjectToggle = new Set();

	async function handleColorProjectToggle(it, project, checked) {
		const colorId = it.color_id;
		const key = `${project.id}:${colorId}`;
		if (inflightProjectToggle.has(key)) return;
		inflightProjectToggle.add(key);

		try {
			if (checked) {
				// ADD color → project
				const res = await fetch(`/api/projects/${encodeURIComponent(project.id)}/colors`, {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ color_id: colorId })
				});
				const j = await res.json().catch(() => ({}));
				if (!res.ok || j?.ok === false) {
					throw new Error(j?.message || `HTTP ${res.status}`);
				}

				const current = getMembership(it);
				if (!current.some((p) => p.id === project.id)) {
					const next = [...current, { id: project.id, name: project.name }];
					colorProjects = { ...colorProjects, [colorId]: next };
					it.used_in_projects = next.length;
				}

				pushToast?.({
					type: 'success',
					msg: `Added ${it.code} to “${project.name}”.`
				});
			} else {
				// REMOVE color ← project
				const res = await fetch(
					`/api/projects/${encodeURIComponent(
						project.id
					)}/colors?color_id=${encodeURIComponent(colorId)}`,
					{ method: 'DELETE' }
				);
				const j = await res.json().catch(() => ({}));
				if (!res.ok || j?.ok === false) {
					throw new Error(j?.message || `HTTP ${res.status}`);
				}

				const current = getMembership(it);
				const next = current.filter((p) => p.id !== project.id);
				colorProjects = { ...colorProjects, [colorId]: next };
				it.used_in_projects = next.length;

				pushToast?.({
					type: 'success',
					msg: `Removed ${it.code} from “${project.name}”.`
				});
			}
		} catch (e) {
			pushToast?.({
				type: 'error',
				msg: e.message || 'Could not update project colors.'
			});
		} finally {
			inflightProjectToggle.delete(key);
		}
	}

	// add/update form for stash
	let adding = { color_id: '', quantity: 1, notes: '' };

	// --- filtering for search ---

	const matchesQuery = (it, q) => {
		if (!q) return true;
		const s = q.trim().toLowerCase();
		return (
			String(it.code ?? '')
				.toLowerCase()
				.includes(s) ||
			String(it.name ?? '')
				.toLowerCase()
				.includes(s)
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

	async function loadProjects() {
		if (!user) return;
		loadingProjects = true;
		try {
			const r = await fetch('/api/projects', { cache: 'no-store' });
			const j = await r.json().catch(() => ({}));

			if (r.ok && j?.ok !== false) {
				const rawProjects = Array.isArray(j.projects)
					? j.projects
					: Array.isArray(j.items)
						? j.items
						: [];

				projects = rawProjects.map((p) => ({
					id: p.id,
					name: p.name,
					file_key: p.pdf_path ?? p.file_key ?? p.fileKey ?? null,
					created_at: p.created_at ?? null
				}));

				projectError = '';
			} else {
				projectError = j?.error || `HTTP ${r.status}`;
			}
		} catch (e) {
			console.warn('loadProjects failed', e);
			projectError = e.message || 'Could not load projects.';
		} finally {
			loadingProjects = false;
		}
	}

	const deletingProjects = new Set();

	async function deleteProject(p) {
		if (deletingProjects.has(p.id)) return;

		const ok = confirm(
			`Delete project “${p.name}”? This will remove its colors and PDF, but won’t touch your stash.`
		);
		if (!ok) return;

		deletingProjects.add(p.id);

		// Optimistic removal
		const prev = projects;
		projects = projects.filter((proj) => proj.id !== p.id);

		try {
			const res = await fetch(`/api/projects/${encodeURIComponent(p.id)}`, {
				method: 'DELETE'
			});
			const j = await res.json().catch(() => ({}));
			if (!res.ok || j?.ok === false) {
				throw new Error(j?.message || `HTTP ${res.status}`);
			}

			// If the activeProjectId was this one, pick another
			if (activeProjectId === p.id) {
				activeProjectId = projects[0]?.id ?? '';
			}

			pushToast?.({
				type: 'success',
				msg: `Deleted “${p.name}”.`
			});
		} catch (e) {
			// rollback
			projects = prev;
			pushToast?.({
				type: 'error',
				msg: e.message || 'Could not delete project.'
			});
		} finally {
			deletingProjects.delete(p.id);
		}
	}

	function formatProjectDate(ts) {
		if (!ts) return '';
		const d = new Date(Number(ts) * 1000);
		return d.toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	async function ensureProjectThumb(p) {
		if (typeof window === 'undefined') return;
		if (!p._thumbCanvas || p._thumbLoading || p._hasThumb) return;
		if (!p.id) return;

		p._thumbLoading = true;
		try {
			const url = `/api/projects/${encodeURIComponent(p.id)}/file`;
			await renderProjectThumbnail(url, p._thumbCanvas);
			p._hasThumb = true;
		} catch (e) {
			console.warn('thumbnail failed for project', p.id, e);
		} finally {
			p._thumbLoading = false;
		}
	}
	$: if (typeof window !== 'undefined') {
		filteredProjects.forEach((p) => {
			if (p._thumbCanvas) ensureProjectThumb(p);
		});
	}

	onMount(() => {
		if (user) {
			loadWishlist();
			// projects are already preloaded from SSR; if you want to always refresh, uncomment:
			loadProjects();
		}
	});

	const inflightProjectAssign = new Set();

	async function addColorToActiveProject(it) {
		if (!activeProjectId) {
			pushToast?.({
				type: 'warning',
				msg: 'Choose a project first.'
			});
			return;
		}

		const key = `${activeProjectId}:${it.color_id}`;
		if (inflightProjectAssign.has(key)) return;
		inflightProjectAssign.add(key);

		try {
			const res = await fetch(`/api/projects/${encodeURIComponent(activeProjectId)}/colors`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ color_id: it.color_id })
			});

			const j = await res.json().catch(() => ({}));
			if (!res.ok || j?.ok === false) {
				throw new Error(j?.message || `HTTP ${res.status}`);
			}

			// Optimistically bump the "used_in_projects" count
			it.used_in_projects = (Number(it.used_in_projects) || 0) + 1;

			const proj = projects.find((p) => p.id === activeProjectId);
			pushToast?.({
				type: 'success',
				msg: `Added ${it.code} to “${proj?.name ?? 'project'}”.`
			});
		} catch (e) {
			pushToast?.({
				type: 'error',
				msg: e.message || 'Could not add color to project.'
			});
		} finally {
			inflightProjectAssign.delete(key);
		}
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

		const keep = stashItems[idx];
		stashItems = [...stashItems.slice(0, idx), ...stashItems.slice(idx + 1)];

		try {
			const r = await fetch(`/api/inventory/${encodeURIComponent(id)}`, { method: 'DELETE' });
			const j = await r.json().catch(() => ({}));
			if (!r.ok || j?.ok === false) throw new Error(j?.message || `HTTP ${r.status}`);
		} catch (e) {
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

	// ===== PROJECTS: upload new project =====
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
				<p class="subtitle">
					Everything you own and everything on your wish list, in one cozy place.
				</p>
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
		{#if projects.length}
			<div class="active-project-row">
				<label>
					Assign colors into:
					<select bind:value={activeProjectId}>
						{#each projects as p}
							<option value={p.id}>{p.name}</option>
						{/each}
					</select>
				</label>
			</div>
		{/if}

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
			<!-- <div class="inv-controls">
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
      </div> -->

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
								No colors in your stash yet. Add one above, or use the <strong>Scan PDF</strong> tool
								to find what you have.
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
										<button class="btn mini" on:click={() => adjust(it, -1)} aria-label="Minus one">
											−
										</button>
										<output>{it.qty ?? it.quantity}</output>
										<button class="btn mini" on:click={() => adjust(it, +1)} aria-label="Plus one">
											＋
										</button>
									</div>
								</td>

								<td class="projects-cell">
									{#if !projects.length}
										<span class="project-pill no-projects"> No projects yet </span>
									{:else}
										<div class="project-dropdown">
											<button
												type="button"
												class="project-pill has-projects"
												on:click={() => toggleProjectPicker(it)}
											>
												{#if getMembership(it).length}
													{#each getMembership(it).slice(0, 2) as p, i}
														{#if i > 0},
														{/if}{p.name}
													{/each}
													{#if getMembership(it).length > 2}
														&nbsp;+ {getMembership(it).length - 2} more
													{/if}
												{:else if it.used_in_projects > 0}
													In {it.used_in_projects} project{it.used_in_projects === 1 ? '' : 's'}
												{:else}
													Assign to project…
												{/if}
												<span class="caret">▾</span>
											</button>

											{#if openProjectPicker === it.color_id}
												<div class="project-menu">
													{#each projects as p}
														<label class="project-menu-item">
															<input
																type="checkbox"
																checked={isInProject(it, p.id)}
																on:change={(e) =>
																	handleColorProjectToggle(it, p, e.currentTarget.checked)}
															/>
															<span>{p.name}</span>
														</label>
													{/each}
												</div>
											{/if}
										</div>
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
					These are colors you’ve marked as <strong>needed</strong> from scans or browsing. When you
					pick them up, move them into your stash with one click.
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
						Upload your cross-stitch patterns as PDFs and keep track of which threads are used in
						each project. (Color assignments coming next!)
					</p>
				</div>

				<form class="project-form" on:submit={handleProjectUpload}>
					<div class="pf-row">
						<label class="pf-label">
							<span>Project name</span>
							<input required bind:value={projectName} placeholder="Cozy Winter Forest" />
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
						<p class="empty">No projects yet. Upload a PDF above to get started.</p>
					{:else}
						<ul class="projects-ul">
              {#each filteredProjects as p}
                <li class="project-item">
                  <a class="pi-main" href={`/projects/${p.id}`}>
                    <div class="pi-icon">
                      <!-- Thumbnail from PDF; falls back to emoji on error -->
                      <img
                        src={`/api/projects/${p.id}/file`}
                        alt=""
                        loading="lazy"
                        on:error={(e) => {
                          // hide broken image and just show a generic icon
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.parentElement?.classList.add('pi-icon-fallback');
                        }}
                      />
                      <span class="pi-icon-emoji">📄</span>
                    </div>
                    <div class="pi-text">
                      <div class="pi-name">{p.name}</div>
                      <div class="pi-meta">
                        Added {new Date((p.created_at ?? 0) * 1000).toLocaleDateString()}
                      </div>
                    </div>
                  </a>
                   <button
                      type="button"
                      class="btn danger small"
                      on:click={() => deleteProject(p)}
                    >
                      Delete
                    </button>
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

	.project-dropdown {
		position: relative;
		display: inline-block;
	}

	.project-dropdown .project-pill {
		cursor: pointer;
	}

	.project-dropdown .caret {
		margin-left: 4px;
		font-size: 0.7rem;
	}

	.project-menu {
		position: absolute;
		z-index: 5;
		margin-top: 4px;
		min-width: 220px;
		padding: 6px 8px;
		border-radius: 10px;
		background: color-mix(in oklab, Canvas 98%, transparent);
		border: 1px solid color-mix(in oklab, CanvasText 12%, transparent);
		box-shadow: 0 4px 14px rgba(0, 0, 0, 0.16);
	}

	.project-menu-item {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.85rem;
		padding: 3px 2px;
	}

	.project-menu-item input[type='checkbox'] {
		margin: 0;
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

	:where(.ctl) {
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
	:where(.ctl)::placeholder {
		color: color-mix(in oklab, CanvasText 60%, transparent);
	}
	:where(.ctl):focus {
		border-color: color-mix(in oklab, #5bbcff 46%, transparent);
		box-shadow: 0 0 0 3px color-mix(in oklab, #5bbcff 22%, transparent);
	}

	.active-project-row {
		margin-top: 4px;
		margin-bottom: 8px;
		font-size: 0.85rem;
		color: color-mix(in oklab, CanvasText 72%, transparent);
	}

	.active-project-row select {
		margin-left: 4px;
		min-width: 200px;
		height: 30px;
		border-radius: 999px;
		border: 1px solid color-mix(in oklab, CanvasText 14%, transparent);
		background: color-mix(in oklab, Canvas 96%, transparent);
		font: inherit;
		padding: 0 10px;
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
		transition:
			background 0.12s,
			border-color 0.12s,
			transform 0.04s;
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

    .btn.small {
    height: 30px;
    padding: 0 10px;
    border-radius: 999px;
    font-size: 0.8rem;
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

	/* ===== PROJECTS ===== */

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

	.projects-cell {
		white-space: nowrap;
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

	.pi-main {
  display: flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
  color: inherit;
  flex: 1 1 auto;
}

	.pi-main:hover .pi-name {
		text-decoration: underline;
	}

.pi-icon {
  width: 38px;
  height: 50px;
  border-radius: 6px;
  display: grid;
  place-items: center;
  background: color-mix(in oklab, CanvasText 6%, Canvas 94%);
  overflow: hidden;
}
.pi-icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.pi-icon-emoji {
  font-size: 1.1rem;
}
.pi-icon-fallback {
  background: color-mix(in oklab, CanvasText 8%, Canvas 92%);
}
.pi-icon canvas {
  width: 100%;
  height: auto;
  display: block;
  border-radius: inherit;
}
.pi-icon-text {
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.04em;
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

	.pi-delete {
		border-radius: 999px;
		font-size: 0.8rem;
		white-space: nowrap;
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

		.pf-row {
			grid-template-columns: 1fr;
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

		.inv col:nth-child(2),
		.inv th:nth-child(2),
		.inv td:nth-child(2) {
			display: none;
		}
	}
</style>
