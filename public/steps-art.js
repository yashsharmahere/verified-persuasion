// Spot illustrations for the "How this works" cards. Static, hand-written SVG.
const STEP_ART = {
  belief: `<svg viewBox="0 0 240 150" aria-hidden="true">
    <g stroke="#1b1b1b" stroke-width="2.5" stroke-linecap="round"><path d="M40 52l-9-9M34 66l-12-3M50 42l-2-12"/></g>
    <path d="M58 150c0-30 20-46 44-46s44 16 44 46z" fill="#8f7bdb" stroke="#1b1b1b" stroke-width="2.5"/>
    <circle cx="102" cy="78" r="24" fill="#f6b58c" stroke="#1b1b1b" stroke-width="2.5"/>
    <path d="M76 74c-4-22 18-34 34-28 14-6 26 8 18 20-6-6-14-6-20-2-8-6-24-2-32 10z" fill="#1b1b1b"/>
    <circle cx="94" cy="80" r="2.6" fill="#1b1b1b"/><circle cx="110" cy="80" r="2.6" fill="#1b1b1b"/>
    <path d="M95 90q7 5 14 0" fill="none" stroke="#1b1b1b" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M86 96c4 8 14 12 22 6" fill="#f6b58c" stroke="#1b1b1b" stroke-width="2.5" stroke-linecap="round"/>
    <g transform="rotate(-6 178 44)">
      <rect x="122" y="14" width="112" height="56" rx="12" fill="#fff" stroke="#d9dbe8" stroke-width="2"/>
      <path d="M140 70l-6 14 18-14z" fill="#fff"/>
      <path d="M140 26l3 7 7 2-7 3-3 7-3-7-7-3 7-2z" fill="#4b5cff"/>
      <rect x="156" y="30" width="62" height="7" rx="3.5" fill="#d7dbf0"/><rect x="156" y="44" width="48" height="7" rx="3.5" fill="#d7dbf0"/>
    </g></svg>`,
  sources: `<svg viewBox="0 0 240 150" aria-hidden="true">
    <g stroke="#1b1b1b" stroke-width="2.5" stroke-linecap="round"><path d="M30 70l-10-2M34 56l-8-8M34 84l-8 6"/></g>
    <g transform="rotate(-8 120 52)"><rect x="50" y="14" width="140" height="76" rx="12" fill="#fff" stroke="#e1dcf2" stroke-width="2"/>
      <rect x="66" y="34" width="70" height="7" rx="3.5" fill="#dcd6ee"/><rect x="66" y="48" width="58" height="7" rx="3.5" fill="#dcd6ee"/><rect x="66" y="62" width="64" height="7" rx="3.5" fill="#dcd6ee"/>
      <path d="M150 26h22l10 10v32h-32z" fill="#a993f5"/><path d="M172 26v10h10" fill="#7c62e8"/><rect x="157" y="46" width="18" height="4" rx="2" fill="#fff"/><rect x="157" y="55" width="12" height="4" rx="2" fill="#fff"/></g>
    <g transform="rotate(4 140 110)"><rect x="70" y="74" width="150" height="70" rx="12" fill="#fff" stroke="#e1dcf2" stroke-width="2"/>
      <rect x="86" y="94" width="66" height="7" rx="3.5" fill="#dcd6ee"/><rect x="86" y="108" width="54" height="7" rx="3.5" fill="#dcd6ee"/>
      <path d="M170 86h22l10 10v30h-32z" fill="#7fd59a"/><path d="M192 86v10h10" fill="#4fbf72"/><rect x="177" y="104" width="18" height="4" rx="2" fill="#fff"/><rect x="177" y="113" width="12" height="4" rx="2" fill="#fff"/></g></svg>`,
  chat: `<svg viewBox="0 0 240 150" aria-hidden="true">
    <g stroke="#1b1b1b" stroke-width="2.5" stroke-linecap="round"><path d="M42 42l-8-9M36 56l-12-2"/></g>
    <path d="M150 18h66a14 14 0 0 1 14 14v18a14 14 0 0 1-14 14h-46l-12 10v-10h-8a14 14 0 0 1-14-14v-18a14 14 0 0 1 14-14z" fill="#fff" stroke="#d6e9dc" stroke-width="2"/>
    <circle cx="172" cy="41" r="4" fill="#5b7cff"/><circle cx="186" cy="41" r="4" fill="#5b7cff"/><circle cx="200" cy="41" r="4" fill="#5b7cff"/>
    <line x1="104" y1="22" x2="104" y2="36" stroke="#1b1b1b" stroke-width="2.5"/><circle cx="104" cy="20" r="5" fill="#ff8a5b" stroke="#1b1b1b" stroke-width="2.5"/>
    <rect x="66" y="36" width="76" height="58" rx="22" fill="#f4f4f4" stroke="#1b1b1b" stroke-width="2.5"/>
    <rect x="78" y="48" width="52" height="34" rx="14" fill="#1f2433"/>
    <ellipse cx="94" cy="64" rx="5" ry="6" fill="#fff"/><ellipse cx="114" cy="64" rx="5" ry="6" fill="#fff"/>
    <rect x="58" y="56" width="10" height="18" rx="5" fill="#cfd3dc" stroke="#1b1b1b" stroke-width="2"/><rect x="140" y="56" width="10" height="18" rx="5" fill="#cfd3dc" stroke="#1b1b1b" stroke-width="2"/>
    <path d="M70 150v-34a20 20 0 0 1 20-20h28a20 20 0 0 1 20 20v34z" fill="#f4f4f4" stroke="#1b1b1b" stroke-width="2.5"/>
    <g transform="rotate(-10 140 118)"><rect x="118" y="96" width="44" height="52" rx="6" fill="#c9bff7" stroke="#1b1b1b" stroke-width="2.5"/><rect x="126" y="108" width="26" height="4" rx="2" fill="#fff"/><rect x="126" y="118" width="20" height="4" rx="2" fill="#fff"/></g>
    <circle cx="128" cy="124" r="8" fill="#f4f4f4" stroke="#1b1b1b" stroke-width="2.5"/></svg>`,
  answer: `<svg viewBox="0 0 240 150" aria-hidden="true">
    <rect x="40" y="14" width="150" height="122" rx="12" fill="#fff" stroke="#f1dfcc" stroke-width="2"/>
    <rect x="56" y="28" width="104" height="7" rx="3.5" fill="#d9d9d9"/><rect x="56" y="41" width="70" height="7" rx="3.5" fill="#e6e6e6"/>
    <circle cx="64" cy="70" r="7" fill="#fff" stroke="#9a9a9a" stroke-width="2.5"/><rect x="80" y="66" width="70" height="7" rx="3.5" fill="#e3e3e3"/>
    <rect x="50" y="86" width="132" height="22" rx="6" fill="#fff3e3"/>
    <circle cx="64" cy="97" r="7" fill="#ff8a3d" stroke="#d9631b" stroke-width="2.5"/><circle cx="64" cy="97" r="2.5" fill="#fff"/><rect x="80" y="93" width="76" height="7" rx="3.5" fill="#ffc68d"/>
    <circle cx="64" cy="124" r="7" fill="#fff" stroke="#9a9a9a" stroke-width="2.5"/><rect x="80" y="120" width="62" height="7" rx="3.5" fill="#e3e3e3"/>
    <g stroke="#e8590c" stroke-width="2.5" stroke-linecap="round"><path d="M200 70l8-6M202 82h10"/></g>
    <path d="M186 96l0 36 9-9 7 15 6-3-7-14 13-1z" fill="#fff" stroke="#1b1b1b" stroke-width="2.5" stroke-linejoin="round"/></svg>`,
};

// Larger scenes for the other screens.
Object.assign(STEP_ART, {
  welcome: `<svg viewBox="0 0 240 170" aria-hidden="true">
    <ellipse cx="120" cy="96" rx="104" ry="66" fill="#eaefff"/>
    <g stroke="#1b1b1b" stroke-width="2.5" stroke-linecap="round"><path d="M30 46l-9-8M26 62l-13-2M40 34l-3-12"/></g>
    <path d="M44 170c0-30 18-46 40-46s40 16 40 46z" fill="#8f7bdb" stroke="#1b1b1b" stroke-width="2.5"/>
    <circle cx="84" cy="98" r="22" fill="#f6b58c" stroke="#1b1b1b" stroke-width="2.5"/>
    <path d="M60 94c-4-20 16-32 31-26 13-5 24 7 16 18-5-5-12-5-18-2-7-5-21-2-29 10z" fill="#1b1b1b"/>
    <circle cx="77" cy="100" r="2.4" fill="#1b1b1b"/><circle cx="91" cy="100" r="2.4" fill="#1b1b1b"/>
    <path d="M78 109q6 4 12 0" fill="none" stroke="#1b1b1b" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M110 170l10-44h76l-10 44z" fill="#d9dce3" stroke="#1b1b1b" stroke-width="2.5" stroke-linejoin="round"/>
    <circle cx="153" cy="148" r="6" fill="#fff"/>
    <g transform="rotate(4 180 40)"><rect x="132" y="12" width="96" height="52" rx="12" fill="#fff" stroke="#d6e9dc" stroke-width="2"/>
      <path d="M150 64l-4 12 14-12z" fill="#fff"/>
      <rect x="146" y="24" width="26" height="20" rx="8" fill="#1f2433"/><circle cx="154" cy="34" r="3" fill="#fff"/><circle cx="164" cy="34" r="3" fill="#fff"/>
      <rect x="180" y="26" width="36" height="6" rx="3" fill="#cfe3d6"/><rect x="180" y="38" width="26" height="6" rx="3" fill="#cfe3d6"/>
      <circle cx="210" cy="52" r="7" fill="#2f55ff"/><path d="M206.5 52.3l2.4 2.4 4.6-5" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`,
  search: `<svg viewBox="0 0 240 170" aria-hidden="true">
    <ellipse cx="120" cy="96" rx="104" ry="66" fill="#f2ecff"/>
    <g transform="rotate(-6 100 80)"><rect x="40" y="34" width="110" height="96" rx="12" fill="#fff" stroke="#e1dcf2" stroke-width="2"/>
      <rect x="56" y="52" width="64" height="7" rx="3.5" fill="#dcd6ee"/><rect x="56" y="66" width="72" height="7" rx="3.5" fill="#dcd6ee"/>
      <rect x="54" y="78" width="80" height="12" rx="4" fill="#fff1cf"/><rect x="56" y="81" width="70" height="6" rx="3" fill="#f7c55c"/>
      <rect x="56" y="98" width="58" height="7" rx="3.5" fill="#dcd6ee"/><rect x="56" y="112" width="44" height="7" rx="3.5" fill="#dcd6ee"/></g>
    <circle cx="150" cy="84" r="32" fill="#ffffff" fill-opacity=".55" stroke="#1b1b1b" stroke-width="5"/>
    <path d="M173 108l26 26" stroke="#1b1b1b" stroke-width="10" stroke-linecap="round"/>
    <circle cx="196" cy="40" r="16" fill="#2fa45f"/><path d="M188.5 40.5l5 5 9.5-10.5" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
    <g stroke="#1b1b1b" stroke-width="2.5" stroke-linecap="round"><path d="M214 22l6-8M220 34l10-2"/></g></svg>`,
  empty: `<svg viewBox="0 0 240 170" aria-hidden="true">
    <ellipse cx="120" cy="96" rx="104" ry="66" fill="#fff1e3"/>
    <rect x="52" y="34" width="104" height="104" rx="12" fill="#fff" stroke="#f1dfcc" stroke-width="2" stroke-dasharray="7 6"/>
    <circle cx="150" cy="86" r="30" fill="#fff" fill-opacity=".6" stroke="#1b1b1b" stroke-width="5"/>
    <path d="M172 108l24 24" stroke="#1b1b1b" stroke-width="10" stroke-linecap="round"/>
    <text x="150" y="98" text-anchor="middle" font-family="IBM Plex Sans, sans-serif" font-weight="700" font-size="34" fill="#e8590c">?</text></svg>`,
  calendar: `<svg viewBox="0 0 240 170" aria-hidden="true">
    <ellipse cx="120" cy="96" rx="104" ry="66" fill="#e8f6ec"/>
    <rect x="62" y="30" width="116" height="116" rx="14" fill="#fff" stroke="#1b1b1b" stroke-width="2.5"/>
    <path d="M62 44a14 14 0 0 1 14-14h88a14 14 0 0 1 14 14v18H62z" fill="#ff8a5b" stroke="#1b1b1b" stroke-width="2.5"/>
    <rect x="86" y="20" width="8" height="22" rx="4" fill="#1b1b1b"/><rect x="146" y="20" width="8" height="22" rx="4" fill="#1b1b1b"/>
    <text x="120" y="124" text-anchor="middle" font-family="IBM Plex Sans, sans-serif" font-weight="700" font-size="54" fill="#1b1b1b">7</text>
    <text x="120" y="56" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-weight="600" font-size="12" fill="#fff">DAYS</text>
    <g stroke="#1b1b1b" stroke-width="2.5" stroke-linecap="round"><path d="M196 52l10-8M198 68h14M40 60l-10-6"/></g></svg>`,
  done: `<svg viewBox="0 0 240 170" aria-hidden="true">
    <ellipse cx="120" cy="96" rx="104" ry="66" fill="#eaefff"/>
    <circle cx="120" cy="88" r="46" fill="#2f55ff" stroke="#1b1b1b" stroke-width="2.5"/>
    <path d="M98 89l15 15 30-32" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="44" y="40" width="10" height="10" rx="2" fill="#f7a501" transform="rotate(20 49 45)"/>
    <rect x="186" y="34" width="10" height="10" rx="2" fill="#2fa45f" transform="rotate(-15 191 39)"/>
    <circle cx="196" cy="118" r="6" fill="#ff8a5b"/><circle cx="40" cy="120" r="5" fill="#a993f5"/>
    <path d="M60 80l-14-4M180 70l14-6M172 140l10 10M66 136l-10 10" stroke="#1b1b1b" stroke-width="2.5" stroke-linecap="round"/></svg>`,
});

// Generated illustrations, where we have them; the SVG drawings above are the fallback.
const STEP_IMG = {
  welcome: '/img/welcome.webp',
  belief: '/img/belief.webp',
  sources: '/img/sources.webp',
  chat: '/img/chat.webp',
  'step-belief': '/img/step-belief.webp',
  'step-sources': '/img/step-sources.webp',
  'step-chat': '/img/step-chat.webp',
  'step-answer': '/img/step-answer.webp',
};

/** The picture for a screen: the generated image if there is one, else the drawing. */
function artNode(key, fallback = key) {
  if (STEP_IMG[key]) {
    const img = document.createElement('img');
    img.src = STEP_IMG[key];
    img.alt = '';
    img.decoding = 'async';
    return img;
  }
  const span = document.createElement('span');
  span.innerHTML = STEP_ART[fallback] || '';
  return span.firstElementChild || span;
}
