// Intro: his name huge over silent extracts of his work. Sound = a heavy riser (WebAudio, only after a tap). Enter by button, swipe up or scroll.
(() => {
  const el = document.getElementById('intro'); if (!el) return;
  const DIR = innerWidth < 700 ? 'intro/s/' : 'intro/'; // phones decode 720p, wide screens 1080p
  const BASE = ['copie-de-kcorp-jersey-worlds-2025', 'samyang-habanero-lime', 'copie-de-redbull-helydia-annonce-1', 'ds4-reveal', 'dcmj-x-lena-situation', 'showreel-2024', 'copie-de-poppie-short-film'];
  // a different order every visit, and never two extracts of the same film back to back
  const film = c => c.replace(/_[ab]$/, '');
  const melange = (l) => {
    const a = l.slice();
    for (let i = a.length - 1; i > 0; i--) { const k = Math.floor(Math.random() * (i + 1)); [a[i], a[k]] = [a[k], a[i]]; }
    for (let i = 1; i < a.length; i++) if (film(a[i]) === film(a[i - 1])) { const k = a.findIndex((x, m) => m > i && film(x) !== film(a[i - 1]) && film(x) !== film(a[i + 1] || '')); if (k > 0) [a[i], a[k]] = [a[k], a[i]]; }
    return a;
  };
  let CLIPS = melange(BASE);
  fetch('intro/list.json').then(r => r.json()).then(l => { if (Array.isArray(l) && l.length > 7) { const dejaVus = CLIPS.slice(0, n); CLIPS = dejaVus.concat(melange(l.filter(c => !dejaVus.includes(c)))); } }).catch(() => {});
  // two stacked players: the next extract starts under the current one and they cross-fade, picture and sound together
  const v0 = el.querySelector('video'), v1 = v0.cloneNode(); v0.after(v1);
  const vs = [v0, v1]; let cur = 0, n = 0, passe = false, mode = 0;
  const XF = 320; // ms of overlap; each clip also carries a short fade in and out of its own sound
  vs.forEach(v => { v.muted = true; v.playsInline = true; v.style.opacity = 0; });
  const lance = (i) => { const v = vs[i]; v.src = `${DIR}${CLIPS[n++ % CLIPS.length]}.mp4`; v.currentTime = 0; return v.play().catch(() => {}); };
  // first clip, then every clip hands over XF ms before its end
  const prochain = () => { const b = vs[1 - cur]; b.src = `${DIR}${CLIPS[n % CLIPS.length]}.mp4`; b.load(); };
  setInterval(() => {
    const a = vs[cur]; if (!a.duration || document.hidden) return;
    if (a.duration - a.currentTime < XF / 1000 + .05 && !a.dataset.passe) {
      a.dataset.passe = '1'; const b = vs[1 - cur]; n++;
      b.currentTime = 0; b.muted = mode !== 1; b.volume = 1; b.play().catch(() => {});
      b.animate([{ opacity: 0 }, { opacity: 1 }], { duration: XF, fill: 'forwards', easing: 'ease-in-out' });
      a.animate([{ opacity: 1 }, { opacity: 0 }], { duration: XF, fill: 'forwards', easing: 'ease-in-out' });
      cur = 1 - cur; b.dataset.passe = '';
      setTimeout(() => { a.pause(); a.dataset.passe = ''; const c = vs[1 - cur]; c.src = `${DIR}${CLIPS[n % CLIPS.length]}.mp4`; c.load(); }, XF + 80);
    }
  }, 60);
  const demarre = () => { lance(0).then(() => { vs[0].style.opacity = 1; }); prochain(); };
  document.body.classList.add('intro-on');

  // the extracts keep their own sound, with the heavy low Dunkirk-style bed very faint underneath
  const bed = new Audio('riser.m4a'); bed.preload = 'auto'; bed.loop = true; bed.volume = .16;
  const NOMS = ['Sound', 'Sound on'];
  const son = el.querySelector('#introSon');
  son.addEventListener('click', () => {
    mode = (mode + 1) % 2;
    vs.forEach(v => { v.muted = mode !== 1; v.volume = 1; });
    if (mode === 1) { bed.currentTime = 0; bed.volume = .16; bed.play().catch(() => {}); } else bed.pause();
    son.classList.toggle('actif', mode > 0);
    son.querySelector('.mono').textContent = NOMS[mode];
  });

  // the name is fitted to the width, line by line, so it can never be cropped
  const lignes = [...el.querySelectorAll('h1 span')];
  const ajuste = () => {
    const L = el.clientWidth - 32;
    lignes.forEach(l => { l.style.fontSize = '100px'; l.style.fontSize = (100 * L / l.getBoundingClientRect().width * .985) + 'px'; });
    if (innerWidth < 700) lignes.forEach(l => l.style.fontSize = parseFloat(l.style.fontSize) * .86 + 'px');
    if (innerWidth >= 700) { const m = Math.min(...lignes.map(l => parseFloat(l.style.fontSize))); const k = Math.min(1, (innerHeight * .46) / (m * 1.9)); lignes.forEach(l => l.style.fontSize = parseFloat(l.style.fontSize) * k + 'px'); }
  };
  // no question: it starts at once, silent (a browser only lets sound start from a tap: the Sound button does it)
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => { ajuste(); choisir(false); });
  addEventListener('resize', ajuste); ajuste();

  // first the question: sound on or not (the tap is also what lets the browser play sound); the title card starts after the answer
  let started = false;
  const choisir = (oui) => {
    if (started) return; started = true;
    mode = oui ? 1 : 0;
    vs.forEach(v => { v.muted = !oui; v.volume = 1; });
    son.classList.toggle('actif', oui); son.querySelector('.mono').textContent = NOMS[mode];
    if (oui) { bed.currentTime = 0; bed.volume = .16; bed.play().catch(() => {}); }
        demarre(); el.classList.add('in');
  };

  // leaving = the strip->list passage idiom: the picture closes into its foot line (still showing until nearly shut),
  // the name sinks away, the site opens behind with its own entrance (strip fades up, title rises, window opens)
  let out = false;
  const enter = () => {
    if (out) return; out = true;
    const fondu = setInterval(() => { vs.forEach(x => x.volume = Math.max(0, x.volume - .06)); bed.volume = Math.max(0, bed.volume - .02); if (vs[0].volume <= 0) { clearInterval(fondu); bed.pause(); } }, 50);
    const DOUX = 'cubic-bezier(.65,0,.35,1)', SORTIE = 'cubic-bezier(.22,1,.36,1)', cadre = el.querySelector('.cadre');
    const mine = [];
    const a = (e, f, o) => { if (!e) return; const x = e.animate(f, Object.assign({ fill: 'both' }, o)); mine.push(x); return x; };
    // the picture closes onto the line the strip already draws: horizontal on a phone, the vertical playhead on a wide screen
    const ax = (document.querySelector('.axe') || { getBoundingClientRect: () => ({ left: innerWidth / 2, top: innerHeight / 2, width: 1, height: 1 }) }).getBoundingClientRect();
    const horiz = ax.height <= 3;
    const fin = horiz ? `inset(${Math.round(ax.top)}px 0 ${Math.max(0, Math.round(innerHeight - ax.top - 1))}px 0)` : `inset(0 ${Math.max(0, Math.round(innerWidth - ax.left - 1))}px 0 ${Math.round(ax.left)}px)`;
    const D = 1000;
    a(el.querySelector('h1'), [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(26px)' }], { duration: 420, easing: DOUX });
    [el.querySelector('.role'), el.querySelector('#introSon'), el.querySelector('#introEntrer')].forEach(e => a(e, [{ opacity: 1 }, { opacity: 0 }], { duration: 260 }));
    a(cadre, [{ clipPath: 'inset(0 0 0 0)', backgroundColor: 'rgba(0,0,0,0)' }, { clipPath: fin, offset: .62, easing: DOUX }, { clipPath: fin, offset: .8 }, { clipPath: fin }], { duration: D });
    vs.forEach(x => a(x, [{ opacity: +getComputedStyle(x).opacity }, { opacity: +getComputedStyle(x).opacity, offset: .36 }, { opacity: 0, offset: .6 }, { opacity: 0 }], { duration: D }));
    a(el.querySelector('.voile'), [{ opacity: 1 }, { opacity: 0, offset: .6 }, { opacity: 0 }], { duration: D });
    a(cadre, [{ backgroundColor: 'rgb(0,0,0)' }, { backgroundColor: 'rgba(12,12,12,.4)', offset: .62 }, { backgroundColor: 'rgba(12,12,12,0)', offset: 1 }], { duration: D, composite: 'replace' });
    // the site's own entrance, same curves and timings as the passage
    const site = document.body;
    site.classList.remove('intro-on'); el.style.background = 'transparent';
    const fond = document.getElementById('bande'), titres = document.getElementById('titres'), fen = document.getElementById('fenetre');
    a(fond, [{ opacity: 0 }, { opacity: 1 }], { duration: 420, delay: D - 520 });
    ['.axe', '#lu', '#regle', '.tete'].forEach(q => document.querySelectorAll(q).forEach(e => a(e, [{ opacity: 0 }, { opacity: 1 }], { duration: 420, delay: D - 520 })));
    a(titres, [{ opacity: 0, transform: 'translateY(26px)' }, { opacity: 1, transform: 'none' }], { duration: 620, delay: D - 700, easing: SORTIE });
    a(fen, [{ opacity: 1, transform: 'translateX(-50%) scaleY(0)' }, { opacity: 1, transform: 'translateX(-50%) scaleY(1)' }], { duration: 700, delay: D - 860, easing: SORTIE });
    setTimeout(() => { el.hidden = true; vs.forEach(x => { x.pause(); x.removeAttribute('src'); x.load(); }); bed.pause(); mine.forEach(x => x.cancel()); }, D + 100);
  };
  el.querySelector('#introEntrer').addEventListener('click', enter);
  addEventListener('keydown', e => {
    if (el.hidden) return;
    if (!started) return;
    if (e.key === 'Enter') { e.preventDefault(); enter(); }
  });
  let y0 = null;
  el.addEventListener('touchstart', e => { y0 = e.touches[0].clientY; }, { passive: true });
  el.addEventListener('touchmove', e => { if (y0 !== null && y0 - e.touches[0].clientY > 60) enter(); }, { passive: true });
  el.addEventListener('wheel', e => { if (e.deltaY > 20) enter(); }, { passive: true });
})();
