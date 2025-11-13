<!-- src/routes/scan/+page.svelte -->
<script>
  import { browser } from '$app/environment';

  let file = null;
  let status = '';
  let error = '';
  let result = null;
  let busy = false;

  function onFileChange(e) {
    const f = e.currentTarget.files?.[0];
    file = f || null;
    result = null;
    error = '';
  }

  async function extractTextFromPdf(file) {
    if (!browser) return '';

    // Dynamic import so this only runs client-side
    const pdfjsLib = await import('pdfjs-dist/build/pdf');
    const pdfjsWorker = await import('pdfjs-dist/build/pdf.worker?url');

    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker.default;

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    let fullText = '';

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      const pageText = content.items.map((it) => it.str || '').join(' ');
      fullText += ' ' + pageText;
    }

    return fullText;
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
    status = 'Reading PDF…';
    result = null;

    try {
      const text = await extractTextFromPdf(file);

      status = 'Scanning for DMC colors…';

      const res = await fetch('/api/scan-dmc', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text })
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Server error (${res.status}): ${msg}`);
      }

      const data = await res.json();
      result = data;
      status = `Found ${data.codesFound?.length || 0} possible DMC codes.`;
    } catch (e) {
      console.error('scan error', e);
      error = e?.message || 'Scan failed.';
      status = '';
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head>
  <title>Scan PDF for DMC colors • ThreadIndex</title>
</svelte:head>

<section class="scan">
  <h1>Scan a PDF for DMC colors</h1>
  <p class="lead">
    Upload a pattern or chart PDF and we’ll scan it for DMC color codes and
    compare them to your stash.
  </p>

  <div class="card">
    <label class="file-label">
      <span>Choose a PDF pattern</span>
      <input type="file" accept="application/pdf" on:change={onFileChange} />
    </label>

    <button class="scan-btn" on:click|preventDefault={handleScan} disabled={busy || !file}>
      {#if busy}Scanning…{/if}
      {#if !busy}Scan for DMC colors{/if}
    </button>

    {#if status}
      <p class="status">{status}</p>
    {/if}
    {#if error}
      <p class="error">{error}</p>
    {/if}
  </div>

  {#if result}
    <section class="results">
      <h2>Results</h2>

      {#if !result.codesFound || !result.codesFound.length}
        <p>No DMC-like codes were detected in this PDF.</p>
      {:else}
        <div class="summary">
          <div>
            <strong>Total codes detected:</strong> {result.codesFound.length}
          </div>
          <div>
            <strong>In your stash:</strong> {result.have.length}
          </div>
          <div>
            <strong>Missing:</strong> {result.missing.length}
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
    max-width: 720px;
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
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
      "Courier New", monospace;
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
</style>
