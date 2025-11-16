<script>
	import { browser } from '$app/environment';

	let file = null;
	let status = '';
	let error = '';
	let result = null;
	let busy = false;
  let addingShopping = false;

	// PDF state
	let pdfDoc = null;
	let pageCount = 0;
	let selectedPage = 1;
	let thumbUrls = []; // array of data URLs, one per page

	// NEW: which page the current result belongs to
	let scannedPage = null;

	async function onFileChange(e) {
		const f = e.currentTarget.files?.[0] || null;
		file = f;
		result = null;
		scannedPage = null;
		error = '';
		status = '';
		pdfDoc = null;
		pageCount = 0;
		selectedPage = 1;
		thumbUrls = [];

		if (!file || !browser) return;

		busy = true;
		status = 'Loading PDF…';

		try {
			await ensurePdfLoaded();
			status = `Loaded PDF with ${pageCount} page${pageCount === 1 ? '' : 's'}. Select a page and scan.`;
			await renderThumbnails();
		} catch (err) {
			console.error('load pdf error', err);
			error = 'Failed to read PDF. Please check the file.';
			status = '';
			file = null;
			pdfDoc = null;
			pageCount = 0;
			thumbUrls = [];
		} finally {
			busy = false;
		}
	}

	async function ensurePdfLoaded() {
		if (!browser || !file) return;
		if (pdfDoc) return;

		const pdfjsLib = await import('pdfjs-dist/build/pdf');
		const pdfjsWorker = await import('pdfjs-dist/build/pdf.worker?url');
		pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker.default;

		const arrayBuffer = await file.arrayBuffer();
		const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
		pdfDoc = await loadingTask.promise;
		pageCount = pdfDoc.numPages || 0;

		if (!selectedPage || selectedPage < 1) {
			selectedPage = 1;
		} else if (selectedPage > pageCount) {
			selectedPage = pageCount;
		}
	}

	async function renderThumbnails() {
		if (!browser || !pdfDoc || !pageCount) return;

		const urls = new Array(pageCount).fill(null);
		const maxWidth = 200;

		for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
			try {
				const page = await pdfDoc.getPage(pageNum);

				const baseViewport = page.getViewport({ scale: 1 });
				const scale = Math.min(1, maxWidth / baseViewport.width);
				const viewport = page.getViewport({ scale });

				const canvas = document.createElement('canvas');
				const ctx = canvas.getContext('2d');
				canvas.width = viewport.width;
				canvas.height = viewport.height;

				await page.render({
					canvasContext: ctx,
					viewport
				}).promise;

				urls[pageNum - 1] = canvas.toDataURL('image/png');
			} catch (err) {
				console.error('thumbnail render error for page', pageNum, err);
			}
		}

		thumbUrls = urls;
	}

	async function getSelectedPageData() {
		if (!browser) throw new Error('PDF scanning only works in the browser.');
		if (!file) throw new Error('No file selected.');

		await ensurePdfLoaded();

		if (!pdfDoc || !pageCount) {
			throw new Error('PDF not loaded.');
		}

		const pageNum = Math.min(Math.max(Number(selectedPage) || 1, 1), pageCount);
		const page = await pdfDoc.getPage(pageNum);
		const content = await page.getTextContent();

		const items = content.items.map((it) => ({
			str: it.str,
			// pdf.js puts x,y in transform[4], transform[5]
			x: it.transform?.[4] ?? 0,
			y: it.transform?.[5] ?? 0
		}));

		const text = items.map((i) => i.str || '').join(' ');
		return { text, items };
	}

	async function handleScan() {
		if (!file) {
			error = 'Please choose a PDF file first.';
			return;
		}
		if (!browser) {
			error = 'PDF scanning only works in the browser.';
			return;
		}

		busy = true;
		error = '';
		status = `Reading page ${selectedPage}…`;
		result = null;
		scannedPage = null;

		try {
			const { text, items } = await getSelectedPageData();

			status = `Scanning page ${selectedPage} for DMC colors…`;

			const res = await fetch('/api/scan-dmc', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ text, items })
			});

			if (!res.ok) {
				const msg = await res.text();
				throw new Error(`Server error (${res.status}): ${msg}`);
			}

			const data = await res.json();
			result = data;
			scannedPage = selectedPage; // ✅ result belongs to this page
			status = `Page ${selectedPage}: found ${data.codesFound?.length || 0} possible DMC codes.`;
		} catch (e) {
			console.error('scan error', e);
			error = e?.message || 'Scan failed.';
			status = '';
		} finally {
			busy = false;
		}
	}

	function selectPage(pageNum) {
		selectedPage = pageNum;

		// NEW: changing selection clears old results
		result = null;
		scannedPage = null;
		status = `Selected page ${pageNum}. Click "Scan selected page" to analyze.`;
	}

  async function addMissingToShoppingList() {
  if (!result?.missing?.length) return;

  const items = result.missing
    .map((c) => {
      const colorId = c.color_id || c.id || c.colorId;
      if (!colorId) return null;
      return { color_id: colorId, desired_qty: 1 };
    })
    .filter(Boolean);

  if (!items.length) {
    error = 'No color IDs available to add.';
    return;
  }

  addingShopping = true;
  error = '';
  status = `Adding ${items.length} colors to your shopping list…`;

  try {
    const res = await fetch('/api/wishlist', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ items })
    });

    const j = await res.json();
    if (!res.ok || !j.ok) {
      throw new Error(j?.message || `HTTP ${res.status}`);
    }

    status = `Added ${items.length} color${items.length === 1 ? '' : 's'} to your shopping list.`;
  } catch (e) {
    console.error('addMissingToShoppingList error', e);
    error = e?.message || 'Failed to add to shopping list. Are you signed in?';
  } finally {
    addingShopping = false;
  }
}





</script>

<svelte:head>
	<title>Scan PDF for DMC colors • ThreadIndex</title>
</svelte:head>

<section class="scan">
	<h1>Scan a PDF for DMC colors</h1>
	<p class="lead">
		Upload a pattern or chart PDF, pick a page tile, and we’ll scan it for DMC color codes and
		compare them to your stash.
	</p>

	<div class="card">
		<label class="file-label">
			<span>Choose a PDF pattern</span>
			<input type="file" accept="application/pdf" on:change={onFileChange} />
		</label>

		{#if pageCount > 0}
			<div class="thumbs-label">Click a page to select which one to scan:</div>
			<div class="thumb-grid">
				{#each Array(pageCount) as _, i}
					{#if thumbUrls[i]}
						<button
							type="button"
							class="thumb-card"
							class:thumb-selected={selectedPage === i + 1}
							on:click={() => selectPage(i + 1)}
						>
							<img src={thumbUrls[i]} alt={`Page ${i + 1}`} />
							<div class="thumb-caption">Page {i + 1}</div>
						</button>
					{:else}
						<button
							type="button"
							class="thumb-card thumb-loading"
							class:thumb-selected={selectedPage === i + 1}
							on:click={() => selectPage(i + 1)}
						>
							<div class="thumb-placeholder">Page {i + 1}</div>
						</button>
					{/if}
				{/each}
			</div>
		{/if}

		<button class="scan-btn" on:click|preventDefault={handleScan} disabled={busy || !file}>
			{#if busy}Scanning…{/if}
			{#if !busy}Scan selected page{/if}
		</button>

		{#if status}
			<p class="status">{status}</p>
		{/if}
		{#if error}
			<p class="error">{error}</p>
		{/if}
	</div>

	{#if result && scannedPage !== null}
		<section class="results">
			<h2>Results (Page {scannedPage})</h2>

			{#if !result.codesFound || !result.codesFound.length}
				<p>No DMC-like codes were detected on this page.</p>
			{:else}
				<div class="summary">
					<div>
						<strong>Total codes detected:</strong>
						{result.codesFound.length}
					</div>
					<div>
						<strong>In your stash:</strong>
						{result.have.length}
					</div>
					<div>
						<strong>Missing:</strong>
						{result.missing.length}
					</div>
				</div>

				{#if result.have.length}
					<h3>✅ You already have these</h3>
					<ul class="list">
						{#each result.have as c}
							<li>
								<span class="code">{c.code}</span>
								<span class="name">{c.name}</span>
								<span class="qty">({c.quantity} in stash)</span>
							</li>
						{/each}
					</ul>
				{/if}

				{#if result.missing.length}
					<h3>❌ You’re missing these</h3>
            <button
              class="shopping-btn"
              on:click|preventDefault={addMissingToShoppingList}
              disabled={addingShopping}
            >
              {#if addingShopping}
                Adding to shopping list…
              {:else}
                Add all to shopping list
              {/if}
            </button>
					<ul class="list">
						{#each result.missing as c}
							<li>
								<span class="code">{c.code}</span>
								<span class="name">{c.name}</span>
							</li>
						{/each}
					</ul>
				{/if}
			{/if}
		</section>
	{/if}
</section>

<style>
	.scan {
		max-width: 900px;
		margin: 2rem auto;
		padding: 0 1rem;
	}
	h1 {
		font-size: 1.7rem;
		margin-bottom: 0.25rem;
	}
	.lead {
		color: var(--text-2);
		margin-bottom: 1.25rem;
	}
	.card {
		padding: 1rem;
		border-radius: var(--radius, 12px);
		border: 1px solid var(--border);
		background: var(--surface, var(--bg-2));
		display: grid;
		gap: 0.75rem;
	}
	.file-label {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		font-size: 0.9rem;
	}
	.file-label input {
		max-width: 100%;
	}

	.thumbs-label {
		font-size: 0.9rem;
		color: var(--text-2);
	}

	.thumb-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
		gap: 0.75rem;
	}

	.thumb-card {
		padding: 0;
		border-radius: 0.6rem;
		border: 1px solid var(--border);
		background: var(--bg-3);
		cursor: pointer;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		align-items: stretch;
		transition:
			transform 0.08s ease-out,
			box-shadow 0.08s ease-out,
			border-color 0.08s ease-out;
	}

	.thumb-card img {
		display: block;
		width: 100%;
		height: auto;
		background: #fff;
	}

	.thumb-caption {
		padding: 0.35rem 0.5rem;
		font-size: 0.8rem;
		color: var(--text-2);
		text-align: center;
	}

	.thumb-card:hover {
		transform: translateY(-1px);
		box-shadow: var(--shadow-1);
	}

	.thumb-selected {
		border-color: var(--accent-2, #f0a132);
		box-shadow: 0 0 0 1px var(--accent-2, #f0a132);
	}

	.thumb-loading .thumb-placeholder {
		min-height: 120px;
		display: grid;
		place-items: center;
		font-size: 0.8rem;
		color: var(--text-2);
	}

	.scan-btn {
		align-self: flex-start;
		padding: 0.4rem 0.9rem;
		border-radius: 999px;
		border: 1px solid var(--border);
		background: var(--bg-3);
		color: var(--text);
		cursor: pointer;
	}
	.scan-btn[disabled] {
		opacity: 0.6;
		cursor: default;
	}
	.status {
		font-size: 0.85rem;
		color: var(--text-2);
	}
	.error {
		font-size: 0.85rem;
		color: #d66;
	}
	.results {
		margin-top: 1.5rem;
		display: grid;
		gap: 0.75rem;
	}
	.summary {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		font-size: 0.9rem;
	}
	.list {
		list-style: none;
		padding: 0;
		margin: 0.25rem 0 0;
		display: grid;
		gap: 0.15rem;
	}
	.list li {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		font-size: 0.9rem;
	}
	.code {
		font-family:
			ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
			monospace;
		padding: 0.1rem 0.35rem;
		border-radius: 999px;
		background: var(--bg-3);
	}
	.name {
		color: var(--text-2);
	}
	.qty {
		color: var(--text-2);
	}

  .shopping-btn {
  margin: 0.4rem 0 0.6rem;
  padding: 0.4rem 0.9rem;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--bg-3);
  color: var(--text);
  cursor: pointer;
  font-size: 0.9rem;
}
.shopping-btn[disabled] {
  opacity: 0.6;
  cursor: default;
}

</style>
