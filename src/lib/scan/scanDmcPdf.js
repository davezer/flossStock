// src/lib/scan/scanDmcPdf.js
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker';

// 👇 Tell pdf.js to use the bundled worker instead of a URL that 404s
pdfjsLib.GlobalWorkerOptions.workerPort = new pdfjsWorker();

export async function scanDmcPdfFile(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const items = [];
  let fullText = '';

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    for (const item of textContent.items) {
      const str = String(item.str || '');
      if (!str.trim()) continue;

      items.push({
        str,
        x: item.transform?.[4] ?? 0,
        y: item.transform?.[5] ?? 0,
        transform: item.transform
      });

      fullText += str + ' ';
    }
  }

  const res = await fetch('/api/scan-dmc', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      text: fullText,
      items
    })
  });

  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(j?.error || j?.message || `HTTP ${res.status}`);
  }

  // { codesFound, have, missing } from your API
  return j;
}
