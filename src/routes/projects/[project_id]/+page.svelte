<!-- src/routes/projects/[project_id]/+page.svelte -->
<script>
  import { browser } from '$app/environment';
  import { pushToast } from '$lib/stores/toast.js';
  export let data;


  const project = data.project;
  let colors = data.colors ?? [];

  // ----- remove color from project -----
  const inflightRemove = new Set();

  async function removeColor(c) {
    const key = c.color_id;
    if (inflightRemove.has(key)) return;
    inflightRemove.add(key);

    const prev = colors;
    colors = colors.filter((x) => x.color_id !== key);

    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(project.id)}/colors?color_id=${encodeURIComponent(
          key
        )}`,
        { method: 'DELETE' }
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.ok === false) {
        throw new Error(j?.message || `HTTP ${res.status}`);
      }
      pushToast?.({
        type: 'success',
        msg: `Removed ${c.code} from “${project.name}”.`
      });
    } catch (e) {
      colors = prev;
      pushToast?.({
        type: 'error',
        msg: e.message || 'Could not remove color from project.'
      });
    } finally {
      inflightRemove.delete(key);
    }
  }

  // ----- scan PDF for this project -----
    // ----- scan PDF for this project -----
  let scanFile = null;        // Blob/File currently loaded into pdf.js
  let scanning = false;
  let scanError = '';
  let scanResults = [];       // [{ color_id, code, name, hex, selected, ... }]

  // pdf.js state
  let pdfDoc = null;
  let pageCount = 0;
  let selectedPage = 1;
  let thumbUrls = [];         // data URLs of page thumbnails
  let scannedPage = null;     // which page the current scan results belong to

  function resetPdfState() {
    scanResults = [];
    scanError = '';
    pdfDoc = null;
    pageCount = 0;
    selectedPage = 1;
    thumbUrls = [];
    scannedPage = null;
  }

  async function setPdfFile(fileOrBlob) {
    scanFile = fileOrBlob || null;
    resetPdfState();

    if (!scanFile || !browser) return;

    scanning = true;
    try {
      await ensurePdfLoaded();
      await renderThumbnails();
    } catch (err) {
      console.error('PDF load error', err);
      scanError = 'Failed to read PDF. Please check the file.';
      scanFile = null;
      resetPdfState();
    } finally {
      scanning = false;
    }
  }

  function onScanFileChange(e) {
    const f = e.currentTarget.files?.[0] ?? null;
    setPdfFile(f);
  }

  async function ensurePdfLoaded() {
    if (!browser || !scanFile) return;
    if (pdfDoc) return;

    const pdfjsLib = await import('pdfjs-dist/build/pdf');
    const pdfjsWorker = await import('pdfjs-dist/build/pdf.worker?url');
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker.default;

    const arrayBuffer = await scanFile.arrayBuffer();
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
    const maxWidth = 160;

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

        await page
          .render({
            canvasContext: ctx,
            viewport
          })
          .promise;

        urls[pageNum - 1] = canvas.toDataURL('image/png');
      } catch (err) {
        console.error('thumbnail render error for page', pageNum, err);
      }
    }

    thumbUrls = urls;
  }

  async function getSelectedPageData() {
    if (!browser) throw new Error('PDF scanning only works in the browser.');
    if (!scanFile) throw new Error('No PDF loaded.');

    await ensurePdfLoaded();

    if (!pdfDoc || !pageCount) {
      throw new Error('PDF not loaded.');
    }

    const pageNum = Math.min(Math.max(Number(selectedPage) || 1, 1), pageCount);
    const page = await pdfDoc.getPage(pageNum);
    const content = await page.getTextContent();

    const items = content.items.map((it) => ({
      str: it.str,
      x: it.transform?.[4] ?? 0,
      y: it.transform?.[5] ?? 0
    }));

    const text = items.map((i) => i.str || '').join(' ');
    return { text, items, pageNum };
  }

  async function handleScan(e) {
    e?.preventDefault?.();

    if (!scanFile) {
      scanError = 'Load a PDF first (saved or local).';
      return;
    }
    if (!browser) {
      scanError = 'PDF scanning only works in the browser.';
      return;
    }

    scanning = true;
    scanError = '';
    scanResults = [];
    scannedPage = null;

    try {
      const { text, items, pageNum } = await getSelectedPageData();

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
      scannedPage = pageNum;

      const raw = [
        ...(Array.isArray(data.have) ? data.have : []),
        ...(Array.isArray(data.missing) ? data.missing : [])
      ];

      scanResults = raw.map((c) => ({
        ...c,
        selected: true
      }));
    } catch (err) {
      console.error('scan error', err);
      scanError = err?.message || 'Scan failed.';
    } finally {
      scanning = false;
    }
  }

  async function scanSavedPdf() {
    scanning = true;
    scanError = '';
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(project.id)}/file`
      );
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('Saved PDF not found in storage.');
        }
        const msg = await res.text();
        throw new Error(`HTTP ${res.status}: ${msg}`);
      }
      const blob = await res.blob();
      await setPdfFile(blob);
    } catch (err) {
      console.error('scanSavedPdf error', err);
      scanError = err?.message || 'Could not load saved PDF.';
    } finally {
      scanning = false;
    }
  }

  function selectPage(pageNum) {
    selectedPage = pageNum;
    // clear previous results, they belonged to another page
    scanResults = [];
    scannedPage = null;
  }

  function toggleResultSelection(res) {
    res.selected = !res.selected;
    // force Svelte to notice
    scanResults = [...scanResults];
  }



  // ----- add scanned colors to project -----
  const inflightAddAll = new Set();

  async function addSelectedToProject() {
    const ids = scanResults
      .filter((r) => r.selected)
      .map((r) => r.color_id)
      .filter(Boolean);

    if (!ids.length) {
      pushToast?.({ type: 'warning', msg: 'No colors selected.' });
      return;
    }

    const key = project.id;
    if (inflightAddAll.has(key)) return;
    inflightAddAll.add(key);

    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(project.id)}/colors`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ color_ids: ids })
        }
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.ok === false) {
        throw new Error(j?.message || `HTTP ${res.status}`);
      }

      // Merge into project colors list
      const existingIds = new Set(colors.map((c) => c.color_id));
      const newOnes = scanResults.filter(
        (r) => r.selected && !existingIds.has(r.color_id)
      );
      colors = [...colors, ...newOnes];

      pushToast?.({
        type: 'success',
        msg: `Added ${ids.length} color${ids.length === 1 ? '' : 's'} to “${
          project.name
        }”.`
      });
    } catch (e) {
      pushToast?.({
        type: 'error',
        msg: e.message || 'Could not add colors to project.'
      });
    } finally {
      inflightAddAll.delete(key);
    }
  }
</script>

<svelte:head>
  <title>{project.name} • ThreadIndex</title>
</svelte:head>

<section class="proj-shell">
  <header class="proj-header">
    <div>
      <h1>{project.name}</h1>
      <p class="subtitle">
        Colors assigned to this project, plus PDF scanning just for “{project.name}”.
      </p>
    </div>
    <a class="back-link" href="/inventory">← Back to My threads</a>
  </header>

  <!-- CURRENT COLORS IN PROJECT -->
  <section class="proj-section">
    <h2>Colors in this project</h2>
    {#if !colors.length}
      <p class="empty">
        No colors linked yet. Scan a PDF below or add them from your stash.
      </p>
    {:else}
      <table class="proj-table">
        <colgroup>
          <col style="width:50px" />
          <col style="width:90px" />
          <col />
          <col style="width:80px" />
          <col style="width:120px" />
        </colgroup>
        <thead>
          <tr>
            <th>Swatch</th>
            <th>Code</th>
            <th>Name</th>
            <th>Have</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each colors as c}
            <tr>
              <td>
                <span class="sw" style={`--c:${c.hex};`}></span>
              </td>
              <td class="code">{c.code}</td>
              <td class="name">{c.name}</td>
              <td class="qty">
                {c.quantity ?? 0}
              </td>
              <td class="actions">
                <button class="btn danger" on:click={() => removeColor(c)}>
                  Remove
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </section>

  <!-- SCAN PDF FOR THIS PROJECT -->
   <section class="proj-section">
    <h2>Scan a PDF for this project</h2>

    <form class="scan-form" on:submit|preventDefault={handleScan}>
      <label class="scan-label">
        <span>PDF file</span>
        <input
          type="file"
          accept="application/pdf"
          on:change={onScanFileChange}
        />
      </label>

      <div class="scan-buttons">
        <button
          class="btn primary"
          type="button"
          on:click={handleScan}
          disabled={scanning || !scanFile}
        >
          {#if scanning}Scanning…{:else}Scan selected page{/if}
        </button>

        <button
          class="btn ghost"
          type="button"
          disabled={scanning}
          on:click={scanSavedPdf}
        >
          Load saved PDF
        </button>
      </div>

      {#if scanError}
        <p class="scan-error">{scanError}</p>
      {/if}
    </form>

    {#if pageCount > 0}
      <div class="thumbs-label">
        Click a page to select which one to scan:
      </div>
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
              <div class="thumb-caption">
                Page {i + 1}
                {#if scannedPage === i + 1}
                  • scanned
                {/if}
              </div>
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

    {#if scanResults.length}
      <div class="scan-results">
        <div class="scan-header-row">
          <h3>
            Detected colors
            {#if scannedPage !== null}
              (page {scannedPage})
            {/if}
          </h3>
          <button
            class="btn primary small"
            type="button"
            on:click={addSelectedToProject}
          >
            Add selected to project
          </button>
        </div>

        <table class="proj-table">
          <colgroup>
            <col style="width:40px" />
            <col style="width:50px" />
            <col style="width:90px" />
            <col />
          </colgroup>
          <thead>
            <tr>
              <th></th>
              <th>Sw</th>
              <th>Code</th>
              <th>Name</th>
            </tr>
          </thead>
          <tbody>
            {#each scanResults as r}
              <tr>
                <td>
                  <input
                    type="checkbox"
                    bind:checked={r.selected}
                    on:change={() => toggleResultSelection(r)}
                  />
                </td>
                <td>
                  <span class="sw" style={`--c:${r.hex};`}></span>
                </td>
                <td class="code">{r.code}</td>
                <td class="name">{r.name}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </section>
</section>

<style>

  .proj-shell {
    width: min(1200px, 96vw);
    margin: 18px auto 24px;
  }

  .proj-header {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: flex-end;
    margin-bottom: 16px;
  }

  .proj-header h1 {
    margin: 0;
    font-size: 1.5rem;
  }

  .subtitle {
    margin: 4px 0 0;
    font-size: 0.9rem;
    color: color-mix(in oklab, CanvasText 70%, transparent);
  }

  .back-link {
    font-size: 0.85rem;
    text-decoration: none;
    color: color-mix(in oklab, CanvasText 80%, transparent);
  }

  .proj-section {
    margin-top: 16px;
  }

  .proj-section h2 {
    margin: 0 0 6px;
    font-size: 1.1rem;
  }

  .empty {
    font-size: 0.9rem;
    color: color-mix(in oklab, CanvasText 72%, transparent);
  }

  .proj-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    margin-top: 6px;
  }

  .proj-table thead th {
    text-align: left;
    padding: 8px 10px;
    background: color-mix(in oklab, Canvas 96%, transparent);
  }

  .proj-table tbody td {
    padding: 8px 10px;
    border-top: 1px solid color-mix(in oklab, CanvasText 10%, transparent);
  }

  .proj-table tbody tr:nth-child(even) {
    background: color-mix(in oklab, Canvas 96%, transparent);
  }

  .sw {
    display: inline-block;
    width: 22px;
    height: 22px;
    border-radius: 999px;
    background: var(--c, #bbb);
    border: 1px solid color-mix(in oklab, CanvasText 18%, transparent);
  }

  .code {
    font-variant-numeric: tabular-nums;
    text-align: center;
  }

  .name {
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
  }

  .qty {
    text-align: center;
  }

  .actions {
    text-align: right;
  }

  .btn {
    height: 32px;
    padding: 0 10px;
    border-radius: 8px;
    cursor: pointer;
    border: 1px solid color-mix(in oklab, CanvasText 16%, transparent);
    background: color-mix(in oklab, Canvas 98%, transparent);
  }

  .btn.primary {
    border-radius: 999px;
    background: color-mix(in oklab, #5bbcff 18%, Canvas 96%);
  }

  .btn.primary.small {
    height: 30px;
    padding: 0 12px;
  }

  .btn.danger {
    border-radius: 999px;
  }

    .scan-buttons {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .btn.ghost {
    background: transparent;
  }

  .scan-form {
    display: flex;
    gap: 10px;
    align-items: center;
    margin-bottom: 8px;
  }

  .scan-label span {
    display: block;
    font-size: 0.85rem;
    margin-bottom: 2px;
  }

  .scan-label input[type='file'] {
    font-size: 0.85rem;
  }

  .scan-error {
    font-size: 0.85rem;
    color: #c33;
  }

  .scan-results {
    margin-top: 8px;
  }

  .scan-header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
  }

  .scan-header-row h3 {
    margin: 0;
    font-size: 1rem;
  }

  .thumbs-label {
    margin-top: 8px;
    font-size: 0.9rem;
    color: color-mix(in oklab, CanvasText 70%, transparent);
  }

  .thumb-grid {
    margin-top: 6px;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 0.6rem;
  }

  .thumb-card {
    padding: 0;
    border-radius: 10px;
    border: 1px solid color-mix(in oklab, CanvasText 12%, transparent);
    background: color-mix(in oklab, Canvas 98%, transparent);
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
    padding: 0.3rem 0.5rem;
    font-size: 0.8rem;
    color: color-mix(in oklab, CanvasText 70%, transparent);
    text-align: center;
  }

  .thumb-card:hover {
    transform: translateY(-1px);
    box-shadow: var(--shadow-1, 0 2px 10px rgba(0,0,0,.25));
  }

  .thumb-selected {
    border-color: var(--accent-2, #f0a132);
    box-shadow: 0 0 0 1px var(--accent-2, #f0a132);
  }

  .thumb-loading .thumb-placeholder {
    min-height: 110px;
    display: grid;
    place-items: center;
    font-size: 0.8rem;
    color: color-mix(in oklab, CanvasText 70%, transparent);
  }

</style>
