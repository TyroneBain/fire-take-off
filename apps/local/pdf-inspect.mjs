import { readFile } from 'node:fs/promises';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

try {
  const bytes = new Uint8Array(await readFile(process.argv[2]));
  const task = getDocument({ data: bytes, isEvalSupported: false, stopAtErrors: true,
    useSystemFonts: false, disableFontFace: true });
  const document = await task.promise;
  if (document.numPages > 200) throw new Error('The local preview supports at most 200 pages per PDF');
  const pages = [];
  for (let number = 1; number <= document.numPages; number++) {
    const page = await document.getPage(number);
    pages.push({ number, view: page.view, rotation: page.rotate, userUnit: page.userUnit });
    page.cleanup();
  }
  await task.destroy();
  process.stdout.write(JSON.stringify({ pages }));
} catch (error) {
  process.stderr.write(error.name === 'PasswordException' ? 'Password-protected PDFs are not supported yet' : 'PDF could not be parsed safely');
  process.exitCode = 1;
}
