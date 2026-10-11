// Drawn (not photographed) faces for demo children and teachers: a simple SVG cartoon rendered to JPEG with sharp.
// Real children's photos must never be used for demos; these make lists and profiles look like a working school.
const sharp = require('sharp');

const SKIN = ['#8D5524', '#A0643B', '#B87A4B', '#C68642', '#9A6A43', '#7C4A2D', '#D1A074'];
const HAIR = ['#141010', '#1f1510', '#2a1a12', '#0d0d0d'];
const BG = ['#FDE2E4', '#E2F0CB', '#CDE7F0', '#FFF1C1', '#E8DFF5', '#FCE1C8', '#D7F2E3'];
const UNIFORM = ['#7FB3E6', '#8EC5FF', '#F2F2F2', '#A7D3A6'];
const RIBBON = ['#D7263D', '#FFFFFF', '#1B4F9C'];
const SAREE = ['#B23A48', '#2D6A4F', '#7B2CBF', '#C2410C', '#1D4ED8', '#9D174D'];

// Small deterministic generator so the same seed always draws the same face.
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}
const pick = (r, list) => list[Math.floor(r() * list.length)];

function face(r, { skin, adult }) {
  const eyeY = adult ? 250 : 258;
  const look = (r() - 0.5) * 6;
  const smile = adult ? 'M226 318 Q256 338 286 318' : r() < 0.5 ? 'M222 312 Q256 348 290 312' : 'M228 316 Q256 336 284 316';
  return `
    <rect x="226" y="330" width="60" height="70" rx="20" fill="${skin}"/>
    <ellipse cx="256" cy="268" rx="${adult ? 92 : 98}" ry="${adult ? 108 : 104}" fill="${skin}"/>
    <ellipse cx="160" cy="275" rx="16" ry="24" fill="${skin}"/>
    <ellipse cx="352" cy="275" rx="16" ry="24" fill="${skin}"/>
    <ellipse cx="${222 + look}" cy="${eyeY}" rx="11" ry="${adult ? 10 : 13}" fill="#1a1a1a"/>
    <ellipse cx="${290 + look}" cy="${eyeY}" rx="11" ry="${adult ? 10 : 13}" fill="#1a1a1a"/>
    <circle cx="${226 + look}" cy="${eyeY - 4}" r="3.5" fill="#fff"/>
    <circle cx="${294 + look}" cy="${eyeY - 4}" r="3.5" fill="#fff"/>
    <path d="M204 ${eyeY - 26} Q222 ${eyeY - 34} 240 ${eyeY - 26}" stroke="#1a1a1a" stroke-width="6" fill="none" stroke-linecap="round"/>
    <path d="M272 ${eyeY - 26} Q290 ${eyeY - 34} 308 ${eyeY - 26}" stroke="#1a1a1a" stroke-width="6" fill="none" stroke-linecap="round"/>
    <path d="M256 272 Q262 292 250 296" stroke="rgba(0,0,0,.25)" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="${smile}" stroke="#5a1f1f" stroke-width="7" fill="${adult ? 'none' : '#7a2a2a'}" stroke-linecap="round"/>
    <circle cx="200" cy="300" r="16" fill="#ff7b7b" opacity=".25"/>
    <circle cx="312" cy="300" r="16" fill="#ff7b7b" opacity=".25"/>`;
}

function childSvg(seed, gender) {
  const r = rng(seed);
  const skin = pick(r, SKIN);
  const hair = pick(r, HAIR);
  const bg = pick(r, BG);
  const shirt = pick(r, UNIFORM);
  const girl = gender === 'F';
  const ribbon = pick(r, RIBBON);
  const hairBack = girl
    ? r() < 0.6
      ? // two plaits with ribbons
        `<path d="M150 250 Q130 360 160 420" stroke="${hair}" stroke-width="34" fill="none" stroke-linecap="round"/>
         <path d="M362 250 Q382 360 352 420" stroke="${hair}" stroke-width="34" fill="none" stroke-linecap="round"/>
         <circle cx="160" cy="420" r="18" fill="${ribbon}" stroke="rgba(0,0,0,.15)" stroke-width="2"/>
         <circle cx="352" cy="420" r="18" fill="${ribbon}" stroke="rgba(0,0,0,.15)" stroke-width="2"/>`
      : `<ellipse cx="256" cy="300" rx="130" ry="150" fill="${hair}"/>`
    : '';
  const hairTop = girl
    ? `<path d="M156 262 Q150 150 256 148 Q362 150 356 262 Q330 200 256 196 Q182 200 156 262Z" fill="${hair}"/>`
    : r() < 0.5
      ? `<path d="M158 250 Q150 150 256 150 Q362 150 354 250 Q340 196 290 190 Q256 214 220 192 Q172 200 158 250Z" fill="${hair}"/>`
      : `<path d="M160 240 Q160 158 256 156 Q352 158 352 240 Q300 186 256 196 Q210 186 160 240Z" fill="${hair}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <rect width="512" height="512" fill="${bg}"/>
    <g transform="translate(256 300) scale(1.22) translate(-256 -300)">
    ${hairBack}
    <path d="M96 512 Q110 400 256 392 Q402 400 416 512Z" fill="${shirt}"/>
    <path d="M220 396 L256 440 L292 396" fill="#fff" stroke="rgba(0,0,0,.12)" stroke-width="3"/>
    ${face(r, { skin, adult: false })}
    ${hairTop}
    </g>
  </svg>`;
}

function adultSvg(seed, gender) {
  const r = rng(seed);
  const skin = pick(r, SKIN);
  const hair = pick(r, HAIR);
  const bg = pick(r, BG);
  const cloth = pick(r, SAREE);
  const woman = gender === 'F';
  const back = woman ? `<ellipse cx="256" cy="186" rx="44" ry="40" fill="${hair}"/>` : '';
  const top = woman
    ? `<path d="M158 262 Q150 150 256 150 Q362 150 354 262 Q336 196 256 190 Q176 196 158 262Z" fill="${hair}"/>`
    : `<path d="M162 236 Q164 156 256 154 Q348 156 350 236 Q320 188 256 190 Q192 188 162 236Z" fill="${hair}"/>
       ${r() < 0.5 ? `<path d="M226 302 Q256 290 286 302" stroke="${hair}" stroke-width="10" fill="none" stroke-linecap="round"/>` : ''}`;
  const bindi = woman && r() < 0.6 ? `<circle cx="256" cy="226" r="6" fill="#C1121F"/>` : '';
  const glasses =
    r() < 0.35
      ? `<g stroke="#333" stroke-width="5" fill="none"><circle cx="222" cy="250" r="22"/><circle cx="290" cy="250" r="22"/><path d="M244 250 H268"/></g>`
      : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <rect width="512" height="512" fill="${bg}"/>
    <g transform="translate(256 300) scale(1.18) translate(-256 -300)">
    ${back}
    <path d="M86 512 Q100 392 256 384 Q412 392 426 512Z" fill="${cloth}"/>
    ${woman ? `<path d="M300 392 L400 512 H340 L280 400Z" fill="rgba(255,255,255,.25)"/>` : `<path d="M230 388 L256 430 L282 388" fill="#fff" opacity=".8"/>`}
    ${face(r, { skin, adult: true })}
    ${top}${bindi}${glasses}
    </g>
  </svg>`;
}

const toJpeg = (svg) => sharp(Buffer.from(svg)).jpeg({ quality: 82 }).toBuffer();

module.exports = {
  child: (seed, gender) => toJpeg(childSvg(seed, gender)),
  adult: (seed, gender) => toJpeg(adultSvg(seed, gender)),
};
