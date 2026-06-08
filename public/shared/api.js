// Tiny fetch wrapper. All endpoints are same-origin and use cookie auth.
const API = {
  async get(url) {
    const r = await fetch(url, { credentials: 'same-origin' });
    if (!r.ok) throw new Error((await safeJson(r)).error || r.statusText);
    return r.json();
  },
  async post(url, body) {
    const r = await fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    });
    if (!r.ok) throw new Error((await safeJson(r)).error || r.statusText);
    return r.json();
  },
  async put(url, body) {
    const r = await fetch(url, {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    });
    if (!r.ok) throw new Error((await safeJson(r)).error || r.statusText);
    return r.json();
  },
  async del(url) {
    const r = await fetch(url, { method: 'DELETE', credentials: 'same-origin' });
    if (!r.ok) throw new Error((await safeJson(r)).error || r.statusText);
    return r.json();
  },
  async upload(url, file) {
    const fd = new FormData();
    fd.append('file', file);
    const r = await fetch(url, { method: 'POST', credentials: 'same-origin', body: fd });
    if (!r.ok) throw new Error((await safeJson(r)).error || r.statusText);
    return r.json();
  }
};

async function safeJson(r) { try { return await r.json(); } catch { return {}; } }

window.API = API;
