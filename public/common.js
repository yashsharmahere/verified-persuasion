// Shared by the participant pages. The link's token is the only credential.
const params = new URLSearchParams(location.search);
const token = params.get('t') || '';

// Demo links (demo-*) exist only under `npm run dev -- --demo`: in-memory data, stubbed model.
const isDemo = token.startsWith('demo-');

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { 'content-type': 'application/json', ...(opts.headers || {}) },
  });
  let data = {};
  try { data = await res.json(); } catch {}
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v; else node.setAttribute(k, v);
  }
  for (const c of children) if (c != null) node.append(c);
  return node;
}

function showError(where, err) {
  where.replaceChildren(el('p', { class: 'error' }, err.message || String(err)));
}

const BRAND_SVG = '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="15" fill="var(--accent)"/><circle cx="16" cy="16" r="11.5" fill="none" stroke="var(--accent-ink)" stroke-opacity=".35" stroke-width="1"/><path d="M10.5 16.5l3.8 3.8 7.4-8" fill="none" stroke="var(--accent-ink)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const CHECK_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="8" fill="var(--accent)"/><path d="M4.6 8.3l2.2 2.2 4.4-4.8" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

// The same small header on every participant page.
const topbar = el('header', { class: 'topbar' });
const brand = el('a', { class: 'brand', href: isDemo ? '/' : '#' });
brand.innerHTML = BRAND_SVG + '<span>Verified Persuasion</span>';
if (!isDemo) brand.removeAttribute('href');
topbar.append(brand, el('span', { class: 'muted tagline' }, 'Every fact is checked against its source'));
document.body.prepend(topbar);

// A "working on it" bubble with animated dots.
function thinking(text) {
  return el('div', { class: 'thinking', role: 'status' },
    el('span', { class: 'dots', 'aria-hidden': 'true' }, el('i'), el('i'), el('i')), text);
}

if (isDemo) {
  document.querySelector('main').prepend(el('div', { class: 'demo-banner' },
    el('span', {}, el('b', {}, 'Local demo. '),
      'The belief is made up, and a stand-in replaces the AI model: it only quotes its sources word for word. Nothing here is saved. ',
      el('a', { href: '/' }, 'Back to the start'))));
}
