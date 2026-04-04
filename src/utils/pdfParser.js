// pdfParser.js — Browser-native PDF text extraction using pdfjs-dist

import * as pdfjsLib from 'pdfjs-dist';

// Point to the bundled worker. Vite will copy this file to /public automatically.
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

/**
 * Extract text paragraphs from a PDF File object.
 * Returns { paragraphs: string[], chunksPerPage: { [pageNum]: startChunkIndex }, totalPages: number }
 */
export async function extractPDF(file, onProgress) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const totalPages = pdf.numPages;

  const paragraphs = [];
  const chunksPerPage = {};
  let chunkIndex = 0;

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    chunksPerPage[pageNum] = chunkIndex;
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    // Group text items into lines by Y position, then into paragraphs by proximity
    const items = content.items.filter(it => it.str.trim());
    if (!items.length) continue;

    let blocks = [];
    let currentBlock = items[0].str;
    let lastY = items[0].transform[5];

    for (let i = 1; i < items.length; i++) {
      const item = items[i];
      const y = item.transform[5];
      const gap = Math.abs(lastY - y);

      if (gap < 5) {
        // Same line — append with space
        currentBlock += ' ' + item.str;
      } else if (gap < 24) {
        // Soft line break — same paragraph
        currentBlock += ' ' + item.str;
      } else {
        // Paragraph break
        if (currentBlock.trim().length > 20) {
          blocks.push(currentBlock.trim());
        }
        currentBlock = item.str;
      }
      lastY = y;
    }
    if (currentBlock.trim().length > 20) {
      blocks.push(currentBlock.trim());
    }

    // Normalize whitespace and filter noise
    for (const block of blocks) {
      const text = block.replace(/\s+/g, ' ').trim();
      if (text.length > 20) {
        paragraphs.push(text);
        chunkIndex++;
      }
    }

    if (onProgress) onProgress(Math.round((pageNum / totalPages) * 100));
  }

  return { paragraphs, chunksPerPage, totalPages };
}
