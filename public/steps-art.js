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
