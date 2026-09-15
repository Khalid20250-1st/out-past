// Pull plain text out of a dropped/picked file so KAI can read a real strategy
// document (PDF, Word .docx, or plain text) instead of only pasted text.
// Heavy parsers are dynamically imported so they only load when a file is used.

function extOf(name) { return (name || '').toLowerCase().split('.').pop() }

function stripRtf(rtf) {
  return rtf
    .replace(/\\par[d]?/g, '\n')
    .replace(/\{\\\*[^{}]*\}/g, '')
    .replace(/\\'[0-9a-fA-F]{2}/g, '')
    .replace(/\\[a-zA-Z]+-?\d* ?/g, '')
    .replace(/[{}]/g, '')
    .replace(/\r/g, '')
    .trim()
}

export async function extractText(file) {
  const ext = extOf(file.name)
  const type = file.type || ''

  // plain text family
  if (['txt', 'md', 'markdown', 'text', 'csv', 'json', 'log'].includes(ext) || type.startsWith('text/')) {
    return (await file.text()).trim()
  }
  if (ext === 'rtf' || type === 'application/rtf' || type === 'text/rtf') {
    return stripRtf(await file.text())
  }

  // PDF
  if (ext === 'pdf' || type === 'application/pdf') {
    const pdfjs = await import('pdfjs-dist')
    const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
    const data = await file.arrayBuffer()
    const pdf = await pdfjs.getDocument({ data }).promise
    let out = ''
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const tc = await page.getTextContent()
      out += tc.items.map((it) => (it.str || '')).join(' ') + '\n\n'
    }
    return out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  }

  // Word .docx
  if (ext === 'docx' || type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const mammoth = (await import('mammoth/mammoth.browser.js')).default
    const arrayBuffer = await file.arrayBuffer()
    const res = await mammoth.extractRawText({ arrayBuffer })
    return ((res && res.value) || '').trim()
  }

  if (ext === 'doc') throw new Error('Old .doc format is not readable. Save it as .docx or PDF and drop that.')
  if (ext === 'pages') throw new Error('Apple Pages files are not readable. Export as PDF or Word and drop that.')

  // last resort: try to read as text
  const t = await file.text()
  if (/[\x00-\x08\x0e-\x1f]/.test(t.slice(0, 400))) throw new Error('That file type is not readable. Use PDF, Word .docx, or a text file.')
  return t.trim()
}
