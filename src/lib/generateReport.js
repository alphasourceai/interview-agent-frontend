// src/lib/generateReport.js
// Requires Node 18+ (global fetch). If you're on older Node, `npm i node-fetch` and `import fetch from 'node-fetch'`.

const API = 'https://api.pdfmonkey.io/api/v1';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/**
 * generateReport(payload) -> Promise<string downloadUrl>
 * - payload: object matching your PDFMonkey template fields
 * - returns a temporary, downloadable URL for the generated PDF
 */
async function generateReport(payload) {
  const apiKey = process.env.PDFMONKEY_API_KEY;
  const templateId = process.env.PDFMONKEY_TEMPLATE_ID;
  if (!apiKey) throw new Error('PDFMonkey: missing PDFMONKEY_API_KEY');
  if (!templateId) throw new Error('PDFMonkey: missing PDFMONKEY_TEMPLATE_ID');

  // 1) Create a document
  const createRes = await fetch(`${API}/documents`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      document: {
        template_id: templateId,
        payload,          // your fields for the template
        status: 'processed' // ask PDFMonkey to render immediately
      }
    })
  });

  if (!createRes.ok) {
    const txt = await createRes.text().catch(() => '');
    throw new Error(`PDFMonkey create failed (${createRes.status}): ${txt}`);
  }

  const created = await createRes.json();
  // PDFMonkey responses vary by SDK/version; support common shapes:
  let doc = created.document || created;
  let { id } = doc || {};
  let url = doc?.download_url || created?.download_url || created?.url;

  // 2) If no URL yet, poll until processed (or fail after ~10s)
  for (let i = 0; !url && i < 10; i++) {
    await sleep(1000);
    const showRes = await fetch(`${API}/documents/${id}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    if (!showRes.ok) continue;
    const j = await showRes.json();
    const d = j.document || j;
    if (d.status === 'processed' && (d.download_url || d.url)) {
      url = d.download_url || d.url;
      break;
    }
    if (d.status === 'failed') {
      throw new Error('PDFMonkey rendering failed');
    }
  }

  if (!url) throw new Error('PDFMonkey did not return a download URL');
  return url;
}

module.exports = { generateReport };
