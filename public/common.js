// Shared by the participant pages. The link's token is the only credential.
const params = new URLSearchParams(location.search);
const token = params.get('t') || '';

// Demo links (demo-*) go to the public demo, which keeps its data in memory
// and never reaches the participant database. Same handlers, same pages.
const isDemo = token.startsWith('demo-');

function apiPath(path) {
  if (!isDemo) return path;
  const [route, query] = path.replace(/^\/api\//, '').split('?');
  return '/api/demo?route=' + route + (query ? '&' + query : '');
}

async function api(path, opts = {}) {
  const res = await fetch(apiPath(path), {
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

if (isDemo) {
  document.querySelector('main').prepend(el('div', { class: 'demo-banner' },
    el('b', {}, 'Demo. '),
    'A made-up belief, and a stand-in for the AI model that only quotes its sources word for word. Nothing here reaches the study’s database. ',
    el('a', { href: '/' }, 'Back to the start')));
}
