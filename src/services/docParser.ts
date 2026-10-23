import * as pdfParseModule from 'pdf-parse';

// Handle both CJS and ESM export shapes of pdf-parse
const pdfParse: any = (pdfParseModule as any).default || pdfParseModule;

export interface ExtractedPage {
  pageNumber: number;
  text: string;
}

export async function extractTextFromBuffer(
  buffer: Buffer,
  mimeType: string,
  originalFilename?: string
): Promise<ExtractedPage[]> {
  const isPdf =
    mimeType === 'application/pdf' ||
    (originalFilename && originalFilename.toLowerCase().endsWith('.pdf'));

  if (isPdf) {
    const pages: ExtractedPage[] = [];

    // Custom pagerender to extract text per page
    const options = {
      pagerender: (pageData: any) => {
        return pageData.getTextContent().then((textContent: any) => {
          let lastY: number | null = null;
          let text = '';
          for (const item of textContent.items) {
            if (lastY === item.transform[5] || lastY === null) {
              text += item.str;
            } else {
              text += '\n' + item.str;
            }
            lastY = item.transform[5];
          }
          pages.push({
            pageNumber: pageData.pageIndex + 1,
            text: text.trim()
          });
          return text;
        });
      }
    };

    try {
      await pdfParse(buffer, options);
      // Sort pages by pageNumber in case callbacks returned out of order
      pages.sort((a, b) => a.pageNumber - b.pageNumber);
      if (pages.length > 0) return pages;
    } catch (err) {
      console.warn('Custom page render error in pdf-parse, falling back to default:', err);
    }

    // Fallback if pagerender didn't populate
    const defaultData = await pdfParse(buffer);
    return [{ pageNumber: 1, text: defaultData.text }];
  }

  // Text file (.txt or application/text)
  const fullText = buffer.toString('utf-8');

  // Check if text has page markers like "Page 1", "--- Page 1 ---", or form feeds \f
  if (fullText.includes('\f')) {
    const rawPages = fullText.split('\f');
    return rawPages.map((pageText, idx) => ({
      pageNumber: idx + 1,
      text: pageText.trim()
    })).filter(p => p.text.length > 0);
  }

  const pageMarkerRegex = /(?:^|\n)(?:---+\s*Page\s*(\d+)\s*---+|Page\s+(\d+)[:\s])/gi;
  const matches = [...fullText.matchAll(pageMarkerRegex)];

  if (matches.length > 1) {
    const pages: ExtractedPage[] = [];
    for (let i = 0; i < matches.length; i++) {
      const currentMatch = matches[i];
      const startIdx = currentMatch.index! + currentMatch[0].length;
      const endIdx = i + 1 < matches.length ? matches[i + 1].index! : fullText.length;
      const pageNum = parseInt(currentMatch[1] || currentMatch[2] || String(i + 1), 10);
      pages.push({
        pageNumber: pageNum,
        text: fullText.substring(startIdx, endIdx).trim()
      });
    }
    return pages;
  }

  // Single page fallback
  return [{ pageNumber: 1, text: fullText.trim() }];
}
