// src/lib/scan/renderPdfThumb.js
// Render first page of a PDF URL into a <canvas>

let pdfjsPromise;

/** Lazy-load pdf.js and configure worker. */
async function getPdfJs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist/build/pdf').then((mod) => {
      const pdfjsLib = mod.default ?? mod;
      // Use the same worker path as scanDmcPdf.js
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
      return pdfjsLib;
    });
  }
  return pdfjsPromise;
}

/**
 * Render the first page of `url` into `canvas`.
 * Canvas width is used as desired width; height is set automatically.
 */
export async function renderProjectThumbnail(url, canvas) {
  const pdfjsLib = await getPdfJs();

  const loadingTask = pdfjsLib.getDocument(url);
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(1);

  const desiredWidth = canvas.width || 56; // default if not set
  const baseViewport = page.getViewport({ scale: 1.0 });
  const scale = desiredWidth / baseViewport.width;
  const viewport = page.getViewport({ scale });

  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');

  await page
    .render({
      canvasContext: ctx,
      viewport
    })
    .promise;
}
