/**
 * Extraction de texte côté client pour .txt, .docx et .pdf (pdf.js + mammoth).
 */

import mammoth from 'mammoth';

const MAX_BYTES = 10 * 1024 * 1024;

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ''));
    r.onerror = () => reject(new Error('Lecture du fichier impossible.'));
    r.readAsText(file, 'UTF-8');
  });
}

export async function extractTextFromFile(file: File): Promise<string> {
  if (file.size > MAX_BYTES) {
    throw new Error('Fichier trop volumineux (max. 10 Mo).');
  }

  const name = file.name.toLowerCase();
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1) : '';

  if (ext === 'txt' || file.type === 'text/plain') {
    return readFileAsText(file);
  }

  if (ext === 'docx' || file.type.includes('wordprocessingml')) {
    const buf = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: buf });
    return (result.value || '').trim();
  }

  if (ext === 'pdf' || file.type === 'application/pdf') {
    const pdfjs = await import('pdfjs-dist');
    const workerMod = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
    pdfjs.GlobalWorkerOptions.workerSrc = workerMod.default;

    const buf = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: buf }).promise;
    const parts: string[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const line = content.items
        .map((item) => ('str' in item ? String((item as { str: string }).str) : ''))
        .join(' ');
      parts.push(line);
    }

    return parts.join('\n\n').trim();
  }

  throw new Error('Format non pris en charge. Utilisez .txt, .pdf ou .docx.');
}
