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

    // Filter empty items
    const rawItems = content.items.filter(it => it.str && it.str.trim());
    if (!rawItems.length) continue;

    // Sort top-to-bottom then left-to-right (PDF Y axis is bottom-up)
    rawItems.sort((a, b) => {
      const yA = a.transform[5], yB = b.transform[5];
      if (Math.abs(yA - yB) > 2) return yB - yA; // higher Y = top of page
      return a.transform[4] - b.transform[4];     // then left to right
    });

    // Estimate median font height to use as dynamic threshold
    const fontHeights = rawItems
      .map(it => Math.abs(it.height || Math.abs(it.transform[3]) || 0))
      .filter(h => h > 2 && h < 200);
    fontHeights.sort((a, b) => a - b);
    const medianFH = fontHeights[Math.floor(fontHeights.length / 2)] || 12;

    // Thresholds based on actual font size
    const sameLineThresh = medianFH * 0.55;  // same line: within ~half a font height
    const sameParaThresh = medianFH * 2.2;   // same paragraph: within ~2 line heights

    // Pass 1: merge items into lines
    const lines = [];
    let curLine = null;

    for (const item of rawItems) {
      const y = item.transform[5];
      const text = item.str;

      if (!curLine) {
        curLine = { y, text };
      } else if (Math.abs(curLine.y - y) <= sameLineThresh) {
        // Same line — append with a space if neither side already has one
        const needsSpace = curLine.text.length > 0
          && !curLine.text.endsWith(' ')
          && !text.startsWith(' ');
        curLine.text += (needsSpace ? ' ' : '') + text;
      } else {
        if (curLine.text.trim()) lines.push({ y: curLine.y, text: curLine.text.trim() });
        curLine = { y, text };
      }
    }
    if (curLine && curLine.text.trim()) lines.push({ y: curLine.y, text: curLine.text.trim() });

    if (!lines.length) continue;

    // Pass 2: merge lines into paragraphs based on inter-line gap
    const rawBlocks = [];
    let curBlock = lines[0].text;
    let prevY = lines[0].y;

    for (let i = 1; i < lines.length; i++) {
      const gap = Math.abs(prevY - lines[i].y);
      const lineText = lines[i].text.trim();

      if (gap <= sameParaThresh) {
        // Same paragraph — smart join handling soft hyphens
        if (curBlock.endsWith('-')) {
          curBlock = curBlock.slice(0, -1) + lineText;
        } else {
          curBlock += ' ' + lineText;
        }
      } else {
        const t = curBlock.replace(/\s+/g, ' ').trim();
        if (t.length > 20) rawBlocks.push(t);
        curBlock = lineText;
      }
      prevY = lines[i].y;
    }
    const lastT = curBlock.replace(/\s+/g, ' ').trim();
    if (lastT.length > 20) rawBlocks.push(lastT);

    // Pass 3: merge fragments that are clearly mid-sentence
    // (prev block doesn't end a sentence AND next starts lowercase or continues)
    const merged = [];
    for (const block of rawBlocks) {
      if (!merged.length) { merged.push(block); continue; }
      const prev = merged[merged.length - 1];
      const prevEndsOpen  = !/[.!?:;"'»)\]—]$/.test(prev);
      const curStartsLow  = /^[a-z,;—–(]/.test(block);
      if (prevEndsOpen && curStartsLow) {
        merged[merged.length - 1] = prev + ' ' + block;
      } else {
        merged.push(block);
      }
    }

    for (const text of merged) {
      const clean = text.replace(/\s+/g, ' ').trim();
      if (clean.length > 20) {
        paragraphs.push(clean);
        chunkIndex++;
      }
    }

    if (onProgress) onProgress(Math.round((pageNum / totalPages) * 100));
  }

  return { paragraphs, chunksPerPage, totalPages };
}
