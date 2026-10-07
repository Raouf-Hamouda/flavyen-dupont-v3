(function () {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const el = function (tag, cls, txt) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  };
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const damp = (k, dt) => 1 - Math.exp(-k * dt);
  const pad = n => String(n).padStart(2, '0');
  const EXT = document.createElement('video').canPlayType('video/mp4; codecs="avc1.42E01E"') ? '.mp4' : '.webm';
  const IPS = 24;
  const tc = function (t) {
    const f = Math.max(0, Math.floor(t * IPS)), s = Math.floor(f / IPS);
    return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}:${pad(f % IPS)}`;
  };
  const tactile = matchMedia('(hover: none)').matches;
  // French for a French browser, English for everyone else
  const EN = !/^fr\b/i.test((navigator.languages && navigator.languages[0]) || navigator.language || 'fr');
  const T = (fr, en) => EN ? en : fr;
  if (EN) {
    document.documentElement.lang = 'en';
    for (const e of document.querySelectorAll('[data-en]')) e.textContent = e.dataset.en;
  }
  const vue = () => document.body.dataset.vue;

  // ---------------------------------------------------------------- content: his 25 projects, from donnees.js
  const CATS = { pub: 'Pub', fiction: 'Fiction' };
  const FILMS = window.FILMS;
  const boucle = f => `affiches/${FILMS[f].slug}${EXT}`;
  const nette = f => FILMS[f].hd ? `affiches/${FILMS[f].slug}-hd.jpg` : affiche(f);
  const affiche = f => `affiches/${FILMS[f].slug}${FILMS[f].hd ? '-m' : ''}.jpg`;
  const etiquette = d => [CATS[d.cat], d.an].filter(Boolean).join(' · ');

  // light mode: asked for by the system (reduced motion), or switched on when frames come too slowly
  let leger = matchMedia('(prefers-reduced-motion: reduce)').matches, lent = 0;
  const econome = !!(navigator.connection && navigator.connection.saveData);
  function alleger() {
    leger = true;
    document.body.classList.add('leger');
  }
  if (leger) document.body.classList.add('leger');

  let filtre = 'tout';
  let visibles = FILMS.map((_, i) => i);
  let ouvert = false;

  // ---------------------------------------------------------------- the strip
  // On a wide screen it runs across the page. On a phone it runs down the page, with each film nearly full width.
  const bandeEl = $('#bande'), piste = $('#piste');
  let items = [], vertical = false, W = 0, S = 0, L = 0, PAS = 0, span = 0;
  let pos = 0, cible = 0, vs = 0, lean = 0, leanV = 0;
  let survol = null, dernierGeste = -1e4, luF = -1, reveil;
  const vif = el('video');
  vif.muted = true; vif.loop = true; vif.playsInline = true; vif.preload = 'auto';
  vif.addEventListener('playing', () => vif.classList.add('vivant'));

  function construireBande() {
    if (!vertical) return construireTemps();
    piste.innerHTML = '';
    items = [];
    survol = null;
    piste.classList.remove('survol');
    const vw = innerWidth, n = visibles.length;
    if (vertical) { W = vw - 32; S = W / 1.5; L = bandeEl.clientHeight; }
    else { W = clamp(vw * .156, 150, 290); S = W; L = vw; }
    PAS = S + (vertical ? 8 : 10);
    document.documentElement.style.setProperty('--w', W + 'px');
    if (!n) { span = 0; return; }
    const jeux = Math.ceil((L + PAS * 5) / (n * PAS));
    for (let j = 0; j < jeux * n; j++) {
      const f = visibles[j % n];
      const a = el('a', 'vignette' + (FILMS[f].nb ? ' nb' : ''));
      const cadre = a.appendChild(el('div', 'cadre'));
      const im = cadre.appendChild(new Image());
      im.decoding = 'async';
      im.alt = ''; im.draggable = false;
      cadre.style.setProperty('--d', Math.min(j, 14) * 55 + 'ms');
      const it = { el: a, cadre, im, f, j, n: j % n, vis: false, charge: false };
      a.addEventListener('pointerenter', function () { if (!tactile && !vertical) survoler(it); });
      a.addEventListener('pointerleave', function () { if (!vertical) quitter(it); });
      a.addEventListener('click', function () {
        if (glisse.bouge > 6) return;
        ouvrir(f, a.getBoundingClientRect(), a);
      });
      piste.appendChild(a);
      items.push(it);
    }
    span = items.length * PAS;
    luF = -1;
  }

  // the still becomes the film, from the same picture
  function survoler(it) {
    survol = it;
    piste.classList.add('survol');
    it.el.classList.add('actif');
    vif.classList.remove('vivant');
    vif.src = boucle(it.f);
    it.cadre.appendChild(vif);
    vif.play().catch(function () {});
  }
  function quitter(it) {
    if (!it || survol !== it) return;
    survol = null;
    piste.classList.remove('survol');
    it.el.classList.remove('actif');
    vif.pause();
    vif.classList.remove('vivant');
  }

  function pousser(d) {
    cible += d;
    dernierGeste = performance.now();
  }
  addEventListener('wheel', function (e) {
    // the list and the credits panel scroll by themselves; only the strip takes the wheel over
    if (ouvert || vue() !== 'bande') return;
    e.preventDefault();
    const dy = e.deltaMode === 1 ? e.deltaY * 32 : e.deltaY;
    if (!vertical && (e.ctrlKey || e.metaKey)) return viserZoom(zc * Math.exp(-clamp(dy, -50, 50) * .006));
    if (!vertical && e.altKey) return regleHauteur(hp - dy * .25);
    arret = false;
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    pousser((e.deltaMode === 1 ? d * 32 : d) * 1.15);
  }, { passive: false });

  // Safari reports a trackpad pinch with its own events, not as a wheel
  let zGeste = 1;
  const pince = () => !vertical && !ouvert && vue() === 'bande';
  addEventListener('gesturestart', function (e) { if (pince()) { e.preventDefault(); zGeste = zc; } });
  addEventListener('gesturechange', function (e) { if (pince()) { e.preventDefault(); viserZoom(zGeste * e.scale); } });

  const glisse = { on: false, p: 0, bouge: 0, v: 0, t: 0 };
  const axe = e => vertical ? e.clientY : e.clientX;
  // two fingers on a touch screen pinch the zoom; one finger drags
  const doigts = new Map();
  let ecart0 = 1, zPince = 1;
  const ecart = function () { const [a, b] = [...doigts.values()]; return Math.max(1, Math.abs(a - b)); };
  const leverDoigt = function (e) { doigts.delete(e.pointerId); };
  addEventListener('pointerup', leverDoigt);
  addEventListener('pointercancel', leverDoigt);
  bandeEl.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'touch' && !vertical) {
      doigts.set(e.pointerId, e.clientX);
      if (doigts.size === 2) { ecart0 = ecart(); zPince = zc; glisse.on = false; bandeEl.classList.remove('prise'); return; }
    }
    glisse.on = true; glisse.p = axe(e); glisse.bouge = 0; glisse.v = 0; glisse.t = performance.now();
    navette = 0; arret = false;
    bandeEl.classList.add('prise');
  });
  addEventListener('pointermove', function (e) {
    if (doigts.has(e.pointerId)) {
      doigts.set(e.pointerId, e.clientX);
      if (doigts.size === 2) return viserZoom(zPince * ecart() / ecart0);
    }
    if (!glisse.on) return;
    const d = glisse.p - axe(e), now = performance.now();
    glisse.bouge += Math.abs(d);
    glisse.v = d / Math.max(1, now - glisse.t);
    glisse.p = axe(e); glisse.t = now;
    pousser(d * (vertical ? 1.2 : 1.5));
  });
  const lacher = function () {
    if (!glisse.on) return;
    glisse.on = false;
    bandeEl.classList.remove('prise');
    pousser(glisse.v * 320);
  };
  addEventListener('pointerup', lacher);
  addEventListener('pointercancel', lacher);

  function bande(dt, now) {
    if (!span) return;
    const mi = L / 2, decale = mi - S / 2 + PAS * 2.5;
    if (!glisse.on && !ouvert) {
      if (vertical) {
        // on a phone the strip comes to rest with one film on the line
        if (now - dernierGeste > 240) cible += (Math.round((cible + decale) / PAS) * PAS - decale - cible) * damp(6, dt);
      } else if (!survol && now - dernierGeste > 2600) {
        // on a wide screen, left alone, it keeps turning slowly
        cible += 16 * dt;
      }
    }
    const avant = pos;
    pos += (cible - pos) * damp(6, dt);
    vs += ((pos - avant) / dt - vs) * damp(12, dt);

    // the lean is a spring: it overshoots a little when the hand stops
    const but = clamp(vs * .0075, -16, 16);
    leanV += ((but - lean) * 110 - leanV * 13) * dt;
    lean += leanV * dt;

    const etire = clamp(vs / 2600, -1, 1);
    let proche = null, dmin = 1e9;
    for (const it of items) {
      let p = ((it.j * PAS - pos) % span + span) % span - PAS * 2.5;
      const c = p + S / 2 - mi, xn = clamp(c / mi, -1.5, 1.5), a = Math.abs(xn);
      if (Math.abs(c) < dmin) { dmin = Math.abs(c); proche = it; }
      // the further from the line, the more a picture trails: the strip stretches like elastic
      p += etire * (vertical ? 44 : 70) * a * Math.sqrt(a);
      const creux = a * a * Math.abs(etire) * (vertical ? 9 : 24);
      it.vis = p > -S && p < L;
      // a picture well outside the screen is switched off and costs nothing
      const loin = p < -S * 1.7 || p > L + S * .7;
      if (loin !== it.loin) { it.loin = loin; it.cadre.style.visibility = loin ? 'hidden' : ''; }
      if (loin) continue;
      if (!it.charge) { it.charge = true; it.im.src = affiche(it.f); }
      // light mode (slow device, or reduced motion asked for): the pictures only slide
      it.el.style.transform = leger
        ? (vertical ? `translate3d(16px,${p.toFixed(1)}px,0)` : `translate3d(${p.toFixed(1)}px,0,0)`)
        : vertical
          ? `translate3d(${(16 + creux).toFixed(2)}px,${p.toFixed(2)}px,0) skewY(${(lean * .45).toFixed(3)}deg) rotate(${(-xn * etire * 1.5).toFixed(3)}deg)`
          : `translate3d(${p.toFixed(2)}px,${creux.toFixed(2)}px,0) skewX(${(-lean).toFixed(3)}deg) rotate(${(xn * etire * 3.4).toFixed(3)}deg)`;
    }

    // the foot of the page names the film on the line, and leans a little with the strip
    if (proche) montrerTitre(proche.f, now);
    const penche = vertical || leger ? '0' : (-lean * .22).toFixed(2);
    if (penche !== roulePenche) titres.style.transform = `skewX(${roulePenche = penche}deg)`;
    lire(proche);
  }

  // ---------------------------------------------------------------- on a wide screen the strip is an edit timeline
  // The films lie end to end like clips in an edit, each on the track of its kind (V1 pub, V2 fiction, V3 the rest),
  // a longer film making a longer clip. The playhead stands still in the middle; the wheel or the hand slides the
  // edit under it, and the film it crosses plays in the window above it, scrubbed by the playhead while it moves fast.
  // Left alone, the edit plays on by itself.
  const PISTES = ['pub', 'fiction', 'autre'], MARGE = 1500, ZMIN = .35, ZMAX = 5;
  // Like an editor's timeline it can be resized: the zoom stretches the clips around the playhead (cmd + wheel,
  // a pinch, + and -, or the slider), the track height makes them taller (alt + wheel, or the handle under the
  // tracks). J, K and L shuttle the playhead as in an edit suite: L forward 1x 2x 4x 8x, J backward, K stops.
  let z = 1, zc = 1, hp = 66, navette = 0, arret = false, nPistes = 3;
  const fenetre = document.body.appendChild(el('div'));
  fenetre.id = 'fenetre';
  const fim = fenetre.appendChild(new Image());
  fim.alt = '';
  fim.decoding = 'async';
  // Sound on the main page, off until asked for. The previews are silent files, so with the sound on the window
  // plays the film itself, from Vimeo, once the playhead rests on it: the film fades in over its preview, the
  // window takes the film's true shape, and the playhead reads the film's real timecode. Moving on cuts it.
  const sonB = $('#sonAccueil');
  let sonOn = false, vw = null, vwF = -1, vwVoulu = -1, vwT = 0, vwTemps = 0;
  function couperVimeo() {
    clearTimeout(vwT);
    const fr = $('iframe', fenetre);
    if (fr) fr.remove();
    vw = null;
    vwF = -1;
    fenetre.classList.remove('son');
    fenetre.style.removeProperty('--ratio');
  }
  function lancerVimeo(f) {
    const d = FILMS[f];
    if (!sonOn || !d.vimeo || !window.Vimeo) return;
    vwF = f;
    vwTemps = 0;
    const fr = el('iframe');
    fr.src = `https://player.vimeo.com/video/${d.vimeo}?autoplay=1&muted=0&loop=1&controls=0&title=0&byline=0&portrait=0&dnt=1&playsinline=1`;
    fr.allow = 'autoplay; fullscreen';
    fenetre.appendChild(fr);
    vw = new window.Vimeo.Player(fr);
    vw.setVolume(1).catch(function () {});
    vw.on('timeupdate', function (e) {
      if (vwF !== f) return;
      vwTemps = e.seconds;
      // the film is really playing: it takes the window over, in its own shape
      if (e.seconds > .05 && !fenetre.classList.contains('son')) {
        fenetre.style.setProperty('--ratio', clamp(d.l / d.h || 16 / 9, .5, 2.4).toFixed(4));
        fenetre.classList.add('son');
      }
    });
  }
  // called every frame with the film the window should be sounding (-1 for none)
  function sonner(f) {
    if (f === vwVoulu) return;
    vwVoulu = f;
    couperVimeo();
    if (f >= 0) vwT = setTimeout(() => lancerVimeo(f), 350);
  }
  function reglerSon(on) {
    sonOn = on;
    sonB.classList.toggle('actif', on);
    $('.mono', sonB).textContent = on ? T('Son', 'Sound') : T('Son coupé', 'Sound off');
  }
  reglerSon(false);
  sonB.addEventListener('click', () => reglerSon(!sonOn));

  // the reminder under the sliders names the keys of this machine, or the gestures of a touch screen
  const MAC = /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);
  $('#aide').textContent = tactile
    ? T('Glissez pour parcourir · pincez pour zoomer', 'Drag to browse · pinch to zoom')
    : `${MAC ? '⌘' : 'Ctrl'} + ${T('molette', 'wheel')} zoom · ${MAC ? '⌥' : 'Alt'} + ${T('molette hauteur', 'wheel height')} · J K L ${T('lecture', 'play')}`;
  // the controls of the edit: zoom and track height, as two sliders, and the handle under the tracks
  $('#zoomR').addEventListener('input', function () { viserZoom(Math.exp(+this.value)); });
  $('#hautR').addEventListener('input', function () { regleHauteur(+this.value); });
  $$('.outils [data-z]').forEach(b => b.addEventListener('click', () => viserZoom(zc * (+b.dataset.z))));
  const poignee = $('#poignee'), tire = { on: false, y: 0, h: 0 };
  poignee.addEventListener('pointerdown', function (e) {
    e.stopPropagation();
    tire.on = true; tire.y = e.clientY; tire.h = hp;
    poignee.setPointerCapture(e.pointerId);
    document.body.classList.add('tire');
  });
  poignee.addEventListener('pointermove', function (e) {
    if (tire.on) regleHauteur(tire.h + (e.clientY - tire.y) / Math.max(1, nPistes));
  });
  const lacherP = function () { tire.on = false; document.body.classList.remove('tire'); };
  poignee.addEventListener('pointerup', lacherP);
  poignee.addEventListener('pointercancel', lacherP);
  // the head of the playhead carries the timecode of the film it is reading
  const teteL = $('.axe').appendChild(el('span', 'tetel mono'));
  // a long film makes a long clip, but a short film of 15 s still has room for its name
  const longueur = f => Math.round(60 + 34 * Math.sqrt(FILMS[f].duree || 60));
  let sous = null, sousF = -1, sousFrac = 0;
  function construireTemps() {
    piste.innerHTML = '';
    items = [];
    survol = null;
    sousF = -1;
    W = clamp(innerWidth * .156, 150, 290);
    S = W;
    L = innerWidth;
    document.documentElement.style.setProperty('--w', W + 'px');
    const n = visibles.length;
    if (!n) { span = 0; return; }
    // the tracks stay in place whatever is picked, so another one can always be picked
    const pistes = PISTES.filter(c => FILMS.some(d => (d.cat || 'autre') === c));
    nPistes = pistes.length;
    document.documentElement.style.setProperty('--np', nPistes);
    regleHauteur(hp);
    // the track headers work like the filters of the list: a click keeps only that track (the others go grey
    // and can be picked in turn), a second click on it brings them all back
    pistes.forEach(function (c, k) {
      const nom = piste.appendChild(el('button', 'nompiste mono' + (filtre === c ? ' solo' : filtre === 'tout' ? '' : ' eteint'), `V${k + 1} ${CATS[c] || T('Autre', 'Other')}`));
      nom.style.top = `calc(${k} * var(--hp))`;
      nom.addEventListener('pointerdown', e => e.stopPropagation());
      nom.addEventListener('click', () => filtrer(filtre === c ? 'tout' : c));
    });
    const seq = [];
    let t = 0;
    visibles.forEach(function (f, k) {
      seq.push({ f, k, x: t, w: longueur(f), y: pistes.indexOf(FILMS[f].cat || 'autre') });
      t += longueur(f);
    });
    PAS = t / n;
    // enough copies of the edit to go round the screen even zoomed all the way out
    const jeux = Math.max(1, Math.ceil((innerWidth + MARGE * 2) / (t * ZMIN)));
    for (let j = 0; j < jeux; j++) {
      for (const s of seq) {
        const d = FILMS[s.f], a = el('a', 'clip' + (d.nb ? ' nb' : ''));
        a.style.width = s.w * z - 3 + 'px';
        a.style.top = `calc(${s.y} * var(--hp))`;
        const cadre = a.appendChild(el('div', 'cadre'));
        // the clip shows its own frames along its length, as an edit does
        cadre.style.backgroundImage = `url("affiches/${d.slug}-pellicule.jpg")`;
        // the name sits above its clip, outside the frames
        const im = a.appendChild(el('span', 'etiq'));
        im.append(el('b', '', d.g), el('i', '', d.i), el('span', 'mono', d.duree ? tc(d.duree).slice(3, 8) : ''));
        const it = { el: a, cadre, im, f: s.f, n: s.k, bx: s.x + j * t, bw: s.w, x: 0, w: 0, vis: false, loin: false };
        it.x = it.bx * z; it.w = it.bw * z;
        // a clip under the playhead opens; any other clip is first brought under the playhead
        a.addEventListener('click', function () {
          if (glisse.bouge > 6) return;
          if (sous === it) return ouvrir(it.f, fenetre.getBoundingClientRect(), fenetre);
          cible += ((it.x + it.w / 2 - pos) % span + span * 1.5) % span - span / 2;
          dernierGeste = performance.now();
        });
        piste.appendChild(a);
        items.push(it);
      }
    }
    spanB = t * jeux;
    span = spanB * z;
    posVu = NaN;
    luF = -1;
  }
  let spanB = 0, zVu = 1, posVu = NaN, zPose = 0;
  // the zoom keeps the playhead where it is: everything is stretched around it
  function zoomer(nz) {
    if (nz === zVu || !spanB) return;
    const k = nz / zVu;
    pos *= k; cible *= k;
    zVu = nz;
    span = spanB * nz;
    for (const it of items) {
      it.x = it.bx * nz; it.w = it.bw * nz;
      it.el.style.width = (it.w - 3).toFixed(1) + 'px';
    }
    $('#zoomR').value = Math.log(nz);
  }
  function regleHauteur(h) {
    // taller tracks, but the window above always keeps some room
    const max = Math.max(52, (innerHeight - 440) / Math.max(1, nPistes));
    hp = clamp(h, 52, max);
    document.body.style.setProperty('--hp', hp.toFixed(1) + 'px');
    $('#hautR').value = hp;
    $('#hautR').max = Math.round(max);
  }
  function viserZoom(nz) {
    zc = clamp(nz, ZMIN, ZMAX);
    dernierGeste = performance.now();
  }
  // the arrows step from clip to clip, from wherever the playhead is heading
  function sauter(sens) {
    if (!span || !items.length) return;
    const x = (cible % span + span) % span, i = items.findIndex(it => x >= it.x && x < it.x + it.w);
    const it = items[((i < 0 ? 0 : i) + sens + items.length) % items.length];
    cible += ((it.x + it.w / 2 - cible) % span + span * 1.5) % span - span / 2;
    navette = 0;
    arret = false;
    dernierGeste = performance.now();
  }
  function navetter(sens) {
    // L/J: start, then double; the other direction first slows down, then turns round
    if (!sens) { navette = 0; arret = true; cible = pos; return; }
    if (Math.sign(navette) === sens) navette = clamp(navette * 2, -8, 8);
    else navette = navette ? 0 : sens;
    arret = !navette;
    dernierGeste = performance.now();
  }
  fenetre.addEventListener('click', function () {
    if (sous && glisse.bouge <= 6) ouvrir(sous.f, fenetre.getBoundingClientRect(), fenetre);
  });
  // the window shows the preview of the film whole. Every preview is a 16:9 file, whatever the shape of the
  // film, so the window is 16:9: any other shape would cut into the picture.
  function cadrer(f) {
    const d = FILMS[f];
    fenetre.classList.toggle('nb', !!d.nb);
    fim.src = affiche(f);
    vif.classList.remove('vivant');
    vif.src = boucle(f);
    fenetre.appendChild(vif);
    vif.play().catch(function () {});
  }
  // put the playhead on a film, in the middle of its clip
  function placer(f) {
    const it = items.find(i => i.f === f);
    if (!it) return;
    pos = cible = it.x + it.w / 2;
    vs = 0;
  }
  function temps(dt, now) {
    if (!span) return;
    const mi = innerWidth / 2;
    z += (zc - z) * damp(10, dt);
    if (Math.abs(zc - z) < .0005) z = zc;
    zoomer(z);
    if (navette && !glisse.on && !ouvert) cible += navette * 60 * z * dt;
    else if (!arret && !sonOn && !glisse.on && !ouvert && now - dernierGeste > 2600 && vue() === 'bande') cible += 40 * dt;
    const avant = pos;
    pos += (cible - pos) * damp(6, dt);
    if (Math.abs(cible - pos) < .02) pos = cible;
    vs += ((pos - avant) / dt - vs) * damp(12, dt);
    // the edit is only laid out again when it has moved or been resized
    if (pos !== posVu || z !== zPose) {
      posVu = pos;
      zPose = z;
      sous = null;
      for (const it of items) {
        const p = ((it.x - pos + mi + MARGE) % span + span) % span - MARGE;
        it.vis = p < innerWidth && p + it.w > 0;
        const loin = !it.vis;
        if (loin !== it.loin) { it.loin = loin; it.el.style.visibility = loin ? 'hidden' : ''; }
        if (p <= mi && p + it.w > mi) { sous = it; sousFrac = (mi - p) / it.w; }
        if (!loin) it.el.style.transform = `translate3d(${p.toFixed(1)}px,0,0)`;
      }
    }
    if (!sous) return;
    if (sous.f !== sousF) {
      for (const it of items) it.el.classList.toggle('actif', it.f === sous.f);
      sousF = sous.f;
      cadrer(sous.f);
    }
    // the hand moves fast: the playhead scrubs the film; it slows down: the film plays
    const ici = vue() === 'bande' && !ouvert;
    // with the sound on, the film itself plays once the playhead rests on it
    sonner(sonOn && ici && !enPassage && !glisse.on && !navette && Math.abs(vs) < 40 ? sous.f : -1);
    const filme = fenetre.classList.contains('son');
    if (!ici || filme) { if (!vif.paused) vif.pause(); }
    else if (vif.duration) {
      if (glisse.on || Math.abs(vs) > 140) {
        if (!vif.paused) vif.pause();
        const t = sousFrac * vif.duration;
        if (!vif.seeking && Math.abs(vif.currentTime - t) > 1 / 24) vif.currentTime = t;
      } else if (vif.paused) vif.play().catch(function () {});
    }
    const d = FILMS[sous.f];
    const code = filme ? tc(vwTemps) : d.duree ? tc(sousFrac * d.duree) : tc(0);
    const vitesse = navette ? `${navette > 0 ? '▶' : '◀'} ${Math.abs(navette)}×  ` : '';
    if (vitesse + code !== luCode) { $('#luTc').textContent = code; teteL.textContent = luCode = vitesse + code; }
    if (sous.f !== luF) {
      luF = sous.f;
      $('#luNo').textContent = `${pad(sous.n + 1)} — ${pad(visibles.length)}`;
      $('#luMeta').textContent = etiquette(d) || 'Film';
    }
  }

  // ---------------------------------------------------------------- the line reads the film under it
  const lu = $('#lu');
  let luCode = '';
  function lire(it) {
    const code = tc(((pos / PAS) % visibles.length + visibles.length) % visibles.length);
    if (code !== luCode) $('#luTc').textContent = luCode = code;
    if (!it || it.f === luF) return;
    luF = it.f;
    const f = FILMS[it.f];
    $('#luNo').textContent = `${pad(it.n + 1)} — ${pad(visibles.length)}`;
    $('#luMeta').textContent = etiquette(f) || 'Film';
    // on a phone there is no hover: the film on the line starts playing by itself
    if (vertical) {
      for (const autre of items) autre.el.classList.toggle('actif', autre === it);
      piste.classList.add('survol');
    }
  }

  // ---------------------------------------------------------------- foot of the page: the title of the film on the line
  // Two layers that roll like a counter: the old title rolls out, the new one rolls in behind it. The window they
  // roll through has soft edges, so words are never cut by a hard line. A fast hand shortens the roll, and when the
  // strip is flying the titles in between are skipped, not smeared.
  const titres = $('#titres');
  let couches = [], devant = 0, titreF = -1, titreT = 0, titreTour = 0, titreAnims = [], roulePenche = '';
  function construireTitres() {
    titreAnims.forEach(function (a) { a.onfinish = null; a.cancel(); });
    titreAnims = [];
    titres.innerHTML = '';
    couches = [0, 1].map(function () {
      const t = el('div', 't cache'), tl = el('div', 'tl');
      t.appendChild(el('div', 'tp')).appendChild(tl);
      titres.appendChild(t);
      return { t, tl };
    });
    devant = 0;
    titreF = -1;
  }
  // a long title is set smaller, both halves together, so the pair always fits the width
  function ajusterTl(tl) {
    const g = $('.g', tl), i = $('.i', tl), x = $('.x', tl);
    if (!g || !i) return;
    const ecart = innerWidth * .03, style = getComputedStyle(tl);
    g.style.fontSize = i.style.fontSize = '';
    const dedans = tl.clientWidth - parseFloat(style.paddingRight);
    if (style.flexDirection === 'column') {
      // stacked (the address on a phone): each line is fitted to the width on its own
      for (const e of [g, i]) {
        if (e.offsetWidth > dedans) e.style.fontSize = parseFloat(getComputedStyle(e).fontSize) * dedans / e.offsetWidth + 'px';
      }
      return;
    }
    const place = dedans - ecart - (x ? x.offsetWidth + ecart : 0);
    const large = g.offsetWidth + i.offsetWidth;
    if (large <= place) return;
    for (const e of [g, i]) e.style.fontSize = parseFloat(getComputedStyle(e).fontSize) * place / large + 'px';
  }
  function ajusterTitres() {
    for (const tl of $$('.tl')) ajusterTl(tl);
  }
  function montrerTitre(f, now) {
    if (f === titreF || !couches.length) return;
    const vite = Math.abs(vs);
    if (titreF >= 0 && vite > 1400 && now - titreT < 110) return;
    // the direction of the hand decides which way the titles travel; a fast hand shortens the hand-over
    const sens = vs < -40 ? -1 : 1, duree = leger ? 1 : clamp(700 - vite * .2, 220, 700);
    // drop whatever was still rolling. Its end-of-roll step must never run late and hide the title that is now in front
    titreAnims.forEach(function (a) { a.onfinish = null; a.cancel(); });
    titreAnims = [];
    const tour = ++titreTour;
    const sort = couches[devant], entre = couches[devant = 1 - devant], d = FILMS[f];
    entre.tl.innerHTML = '';
    entre.tl.appendChild(el('span', 'g', d.g));
    if (d.lien) entre.tl.appendChild(el('span', 'x', d.lien));
    entre.tl.appendChild(el('span', 'i', d.i));
    entre.t.classList.remove('cache');
    ajusterTl(entre.tl);
    // the roll you liked: the old title rolls out, the new one rolls in behind it, as on a counter
    const animer = function (e, images, apres) {
      const a = e.animate(images, { duration: duree, easing: 'cubic-bezier(.3,.7,.2,1)', fill: 'both' });
      a.onfinish = function () {
        if (tour !== titreTour) return;
        if (apres) apres();
        a.cancel();
      };
      titreAnims.push(a);
    };
    sort.t.classList.remove('cache');
    if (titreF < 0) sort.t.classList.add('cache');
    if (titreF >= 0) {
      animer(sort.t, [{ transform: 'none' }, { transform: `translateY(${-100 * sens}%)` }], () => sort.t.classList.add('cache'));
      animer(entre.t, [{ transform: `translateY(${100 * sens}%)` }, { transform: 'none' }]);
    }
    titreF = f;
    titreT = now;
  }

  // ---------------------------------------------------------------- ruler along the strip
  const regle = $('#regle'), rc = regle.getContext('2d');
  let rw = 0, rh = 0, regleVue = NaN;
  function tailleRegle() {
    const d = Math.min(devicePixelRatio || 1, 2);
    rw = regle.clientWidth; rh = regle.clientHeight;
    regle.width = Math.round(rw * d);
    regle.height = Math.round(rh * d);
    rc.setTransform(d, 0, 0, d, 0, 0);
    regleVue = NaN;
  }
  let pasVu = 0;
  function dessinerRegle() {
    // on the timeline the ruler stretches with the zoom, around the playhead; when its marks would crowd, it
    // counts in bigger steps
    const zz = vertical ? 1 : z, mult = [.5, 1, 2, 5, 10].find(m => 8 * zz * m >= 6) || 10;
    const PASR = 8 * zz * mult, long = vertical ? rh : rw, mi = vertical ? 0 : rw / 2;
    // nothing moved since the last frame: nothing to redraw
    if (Math.abs(pos - regleVue) < .05 && PASR === pasVu) return;
    regleVue = pos;
    pasVu = PASR;
    rc.clearRect(0, 0, rw, rh);
    rc.fillStyle = '#0c0c0c';
    rc.font = '8.5px "IBM Plex Mono", monospace';
    for (let k = Math.floor((pos - mi) / PASR); (k * PASR - pos + mi) < long; k++) {
      const p = Math.round(k * PASR - pos + mi) + .5, dix = k % 10 === 0, cinq = k % 5 === 0;
      const trait = dix ? 9 : cinq ? 6 : 3;
      rc.globalAlpha = dix ? .9 : cinq ? .5 : .22;
      if (vertical) { rc.fillRect(0, p, trait, 1); continue; }
      rc.fillRect(p, 0, 1, trait);
      if (dix) {
        rc.globalAlpha = .45;
        rc.fillText(String(((k * mult * .8) % 1000 + 1000) % 1000 | 0).padStart(3, '0'), p + 3, 22);
      }
    }
    rc.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- filters and views
  function construireFiltres() {
    const cats = $('#cats');
    cats.innerHTML = '';
    for (const [id, nom] of [['tout', T('Tout', 'All')], ...Object.entries(CATS)]) {
      const b = el('button', id === filtre ? 'actif' : '');
      const combien = id === 'tout' ? FILMS.length : FILMS.filter(f => f.cat === id).length;
      b.append(el('span', '', nom), el('sup', 'mono', pad(combien)));
      b.onclick = function () { filtrer(id); };
      b.dataset.cat = id;
      cats.appendChild(b);
    }
    compter();
  }
  function compter() {
    $('#compte').textContent = `(${pad(visibles.length)})`;
  }
  function filtrer(id) {
    if (vue() === 'apropos' || vue() === 'contact') voir('bande');
    if (id === filtre) return;
    filtre = id;
    visibles = FILMS.map((_, i) => i).filter(i => id === 'tout' || FILMS[i].cat === id);
    $$('#cats button').forEach(b => b.classList.toggle('actif', b.dataset.cat === id));
    compter();
    construireBande();
    construireTitres();
    construireListe();
  }
  function voir(v) {
    document.body.dataset.vue = v;
    $$('.vues button').forEach(b => b.classList.toggle('actif', b.dataset.vue === v));
    $$('.menu .btn').forEach(b => b.classList.toggle('actif', b.dataset.vue === v || (b.dataset.vue === 'bande' && v === 'liste')));
    flottant.classList.remove('on');
    trainee.innerHTML = '';
    if (window.logoFD) window.logoFD.jouer($('#' + v));
    if (v !== 'bande') quitter(survol);
    luF = -1;
  }
  $$('.vues button, .menu .btn').forEach(function (b) {
    b.onclick = function () {
      const de = vue(), a = b.dataset.vue;
      if ((de === 'bande' && a === 'liste') || (de === 'liste' && a === 'bande')) passer(a);
      else voir(a);
    };
  });

  // ---------------------------------------------------------------- strip <-> list: a film is the same object in both views
  // To the list: every film of the strip lies down. Its picture (on a wide screen, the frames of its clip) closes
  // into a line at its foot, the line travels to the film's row and stretches into the rule of that row. Its name
  // travels with it and grows into the title of the row; on a phone, where pictures carry no name, the title comes
  // out of the line. The window closes into a line the same way. Films nearest the playhead leave first.
  // Back to the strip is the same film played backwards.
  const passage = document.body.appendChild(el('div'));
  passage.id = 'passage';
  let enPassage = false;
  function passer(vers) {
    if (enPassage) return;
    if (leger) return voir(vers);
    enPassage = true;
    const versListe = vers === 'liste';
    const DOUX = 'cubic-bezier(.65,0,.35,1)', SORTIE = 'cubic-bezier(.22,1,.36,1)';
    const ENCRE = 'rgb(12,12,12)', GRIS = 'rgb(155,155,155)';
    const FOND = vertical ? 'rgb(236,236,236)' : 'rgba(12,12,12,0)', FORT = 'rgba(12,12,12,.4)', FIN = 'rgba(12,12,12,.16)';
    const anims = [];
    const anime = function (e, images, options) {
      const a = e.animate(images, Object.assign({ fill: 'both' }, options));
      anims.push(a);
      return a;
    };
    const boiteP = r => ({ left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
    document.body.classList.add('net');
    // the strip holds still while it is being laid down; on a phone it first sits exactly on a film
    const mi = vertical ? L / 2 : innerWidth / 2, hautB = bandeEl.offsetTop, rangs = $$('.rang', liste);
    if (vertical && span) {
      const decale = mi - S / 2 + PAS * 2.5;
      cible = Math.round((cible + decale) / PAS) * PAS - decale;
    }
    pos = cible;
    navette = 0;

    // going to the list, the row of the film under the playhead is brought into view
    const filmCourant = vertical ? luF : sous ? sous.f : -1;
    const nCourant = Math.max(0, visibles.indexOf(filmCourant));
    // ... and the list always starts on a whole row, never on a row cut by its top edge
    if (versListe && rangs[nCourant]) {
      const voulu = clamp(rangs[nCourant].offsetTop - liste.clientHeight / 2, 0, liste.scrollHeight - liste.clientHeight);
      let debut = 0;
      for (const r of rangs) if (r.offsetTop <= voulu + 1) debut = r.offsetTop;
      liste.scrollTop = debut;
    }
    const haut = liste.offsetTop - liste.scrollTop, gauche = liste.offsetLeft, large = liste.clientWidth;
    const bas = liste.offsetTop + liste.clientHeight;
    // where a film stands in the strip: the copy of it nearest the playhead, as a picture box and its foot line
    const source = function (f) {
      let it = null, p = 0, dm = 1e12;
      for (const i of items) {
        if (i.f !== f) continue;
        const q = vertical ? ((i.j * PAS - pos) % span + span) % span - PAS * 2.5 : ((i.x - pos + mi + MARGE) % span + span) % span - MARGE;
        const d = Math.abs(q + (vertical ? S : i.w) / 2 - mi);
        if (d < dm) { dm = d; it = i; p = q; }
      }
      if (!it) return null;
      const d = FILMS[f], actif = f === filmCourant;
      if (vertical) {
        // the travelling picture is cut by the edges of the strip exactly as the real one is; a picture that is
        // outside the strip is a line that comes from beyond the screen
        const y0 = hautB + p, y1 = y0 + S, a = clamp(y0, hautB, hautB + L), b = clamp(y1, hautB, hautB + L);
        if (b - a < 1) {
          const y = y1 <= hautB + 1 ? -30 : innerHeight + 30, ligne = { x: 16, y, w: W, h: 1 };
          return { actif, h: S, coupe: 0, o0: 0, gris: false, photo: true, image: affiche(f), S: ligne, F: ligne };
        }
        return { actif, h: S, coupe: y1 - b, o0: actif ? 1 : .35, gris: !!d.nb, photo: true, image: affiche(f),
          S: { x: 16, y: a, w: W, h: b - a }, F: { x: 16, y: b - 1, w: W, h: 1 } };
      }
      const x = clamp(p, -it.w - 80, innerWidth + 80), y = hautB + it.el.offsetTop, h = hp - 30;
      return { actif, h, coupe: 0, ecran: p + it.w > 40 && p < innerWidth - 40, o0: actif ? 1 : .38, gris: !actif || !!d.nb, photo: false, image: `affiches/${d.slug}-pellicule.jpg`,
        S: { x, y: y + 22, w: it.w - 3, h }, F: { x, y: y + 22 + h - 1, w: it.w - 3, h: 1 },
        petit: { transform: `translate(${x.toFixed(1)}px,${y}px) scale(.56)`, color: actif ? ENCRE : GRIS, opacity: 1 } };
    };
    // every row that can be seen travels, even one cut by the edge of the list: a row left behind would read as
    // the list hanging on. The row nearest the current film leaves first.
    const vues = [];
    rangs.forEach(function (r, n) {
      const y = haut + r.offsetTop;
      if (y + r.offsetHeight > liste.offsetTop && y < bas) vues.push({ r, n, y, h: r.offsetHeight });
    });
    const centre = vues.length ? vues.reduce((m, o) => Math.abs(o.n - nCourant) < Math.abs(m.n - nCourant) ? o : m).n : 0;
    let loin = 0;
    for (const o of vues) loin = Math.max(loin, Math.abs(o.n - centre));
    const PAS_T = 22, VOL = 950;
    const DUREE_P = (versListe ? 140 : 0) + loin * PAS_T + VOL + 160;

    for (const o of vues) {
      const c = source(visibles[o.n]);
      if (!c) continue;
      const rang = Math.abs(o.n - centre), titre = $('.titre', o.r);
      const R = { x: gauche, y: o.y, w: large, h: 1 };
      // the name of the film <-> the title of the row, for the clips that are on screen. A film whose clip is
      // out of sight (and, on a phone, every film: the pictures carry no name) keeps its title in its row, where
      // it only rises or leaves: titles flying in from beyond the screen pile up on the way.
      let nom = null, grand = null;
      if (c.ecran) {
        nom = passage.appendChild(el('div', 'rang vol'));
        nom.appendChild(titre.cloneNode(true)).style.width = titre.offsetWidth + 'px';
        grand = { transform: `translate(${gauche + titre.offsetLeft}px,${haut + titre.offsetTop}px) scale(1)`, color: ENCRE, opacity: 1 };
        anime(titre, [{ opacity: 0 }, { opacity: 0 }], { duration: DUREE_P });
      }
      // the picture of the film <-> the rule of the row
      const trait = passage.appendChild(el('i', 'trait-v' + (c.gris ? ' gris' : '') + (c.photo ? ' photo' : '')));
      const im = trait.appendChild(el('b'));
      im.style.backgroundImage = `url("${c.image}")`;
      im.style.height = c.h + 'px';
      im.style.bottom = -c.coupe + 'px';
      const autres = [...o.r.children].filter(e => e !== titre || !nom);
      if (versListe) {
        const t0 = 140 + rang * PAS_T;
        if (nom) anime(nom, [c.petit, grand], { duration: VOL, delay: t0, easing: DOUX });
        // the picture closes into its foot line, still showing its image until it is nearly shut
        anime(trait, [
          Object.assign(boiteP(c.S), { backgroundColor: FOND, easing: DOUX }),
          Object.assign(boiteP(c.F), { backgroundColor: FORT, offset: .36, easing: DOUX }),
          Object.assign(boiteP(R), { backgroundColor: FIN }),
        ], { duration: VOL + 60, delay: t0 - 140 });
        anime(im, [{ opacity: c.o0 }, { opacity: c.o0, offset: .24 }, { opacity: 0, offset: .36 }, { opacity: 0 }], { duration: VOL + 60, delay: t0 - 140 });
        for (const e of autres) anime(e, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 520, delay: t0 + VOL - 420, easing: SORTIE });
      } else {
        const t0 = rang * PAS_T;
        if (nom) anime(nom, [grand, c.petit], { duration: VOL, delay: t0, easing: DOUX });
        // ... and opens from it with its image there from the first moment
        anime(trait, [
          Object.assign(boiteP(R), { backgroundColor: FIN, easing: DOUX }),
          Object.assign(boiteP(c.F), { backgroundColor: FORT, offset: .64, easing: SORTIE }),
          Object.assign(boiteP(c.S), { backgroundColor: FOND }),
        ], { duration: VOL + 60, delay: t0 });
        anime(im, [{ opacity: 0 }, { opacity: 0, offset: .64 }, { opacity: c.o0, offset: .74 }, { opacity: c.o0 }], { duration: VOL + 60, delay: t0 });
        for (const e of autres) anime(e, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-6px)' }], { duration: 160 });
      }
    }
    // the last rule of the list has no film of its own
    const dernier = vues.find(o => o.n === rangs.length - 1);
    if (dernier) {
      const l = passage.appendChild(el('i', 'trait-v'));
      Object.assign(l.style, boiteP({ x: gauche, y: dernier.y + dernier.h, w: large, h: 1 }));
      anime(l, versListe ? [{ opacity: 0 }, { opacity: 0, offset: .7 }, { opacity: 1 }] : [{ opacity: 1 }, { opacity: 0, offset: .25 }, { opacity: 0 }], { duration: DUREE_P });
    }

    // the real pictures are replaced by the travelling ones for the whole passage
    for (const it of items) if (!it.loin) anime(it.el, [{ opacity: 0 }, { opacity: 0 }], { duration: DUREE_P });
    const noms = $$('.nompiste', piste), meubles = [$('.axe'), lu, regle, $('#outils'), $('#poignee'), sonB];
    const FERME = 'translateX(-50%) scaleY(0)', OUVERT = 'translateX(-50%) scaleY(1)';
    // on a wide screen the filters belong to the list only: they come and go with it, inside the passage
    if (!vertical) {
      anime($('.filtres'), versListe ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 1 }, { opacity: 0 }],
        versListe ? { duration: 420, delay: DUREE_P - 520 } : { duration: 1 });
    }
    if (versListe) {
      anime(liste, [{ opacity: 1 }, { opacity: 1 }], { duration: DUREE_P });
      for (const e of [...noms, ...meubles]) anime(e, [{ opacity: 1 }, { opacity: 0 }], { duration: 260 });
      // the big title of the phone strip sinks away
      anime(titres, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(26px)' }], { duration: 420, easing: DOUX });
      // the window closes into a line, as the clips do
      anime(fenetre, [{ transform: OUVERT }, { transform: FERME }], { duration: 560, easing: DOUX });
    } else {
      anime(bandeEl, [{ opacity: 1, transform: 'none' }, { opacity: 1, transform: 'none' }], { duration: DUREE_P });
      for (const e of noms) anime(e, [{ opacity: 0 }, { opacity: 1 }], { duration: 420, delay: DUREE_P - 520 });
      for (const e of meubles) anime(e, [{ opacity: 0, transform: 'none' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: DUREE_P - 520 });
      anime(titres, [{ opacity: 0, transform: 'translateY(26px)' }, { opacity: 1, transform: 'none' }], { duration: 620, delay: DUREE_P - 700, easing: SORTIE });
      anime(fenetre, [{ opacity: 1, transform: FERME }, { opacity: 1, transform: OUVERT }], { duration: 700, delay: Math.max(0, DUREE_P - 860), easing: SORTIE });
    }
    setTimeout(() => finir(vers, anims), DUREE_P);
  }
  function finir(vers, anims) {
    voir(vers);
    anims.forEach(a => a.cancel());
    passage.innerHTML = '';
    roulePenche = '';
    // the browser must take in the final state now, while transitions are still off: otherwise the view that
    // has just left is seen once more, fading out, when they come back on
    void getComputedStyle(liste).opacity;
    void getComputedStyle(bandeEl).opacity;
    // the views are in their final state; give them their own transitions back two frames later
    requestAnimationFrame(() => requestAnimationFrame(function () {
      document.body.classList.remove('net');
      enPassage = false;
      dernierGeste = performance.now();
    }));
  }
  $('#accueil').onclick = () => voir('bande');

  // ---------------------------------------------------------------- list
  const liste = $('#liste'), flottant = $('#flottant');
  const flot = { x: 0, y: 0, tx: 0, ty: 0, r: 0, f: -1 };
  function construireListe() {
    liste.innerHTML = '';
    visibles.forEach(function (f, n) {
      const d = FILMS[f], r = el('a', 'rang');
      const titre = el('span', 'titre');
      titre.appendChild(el('span', 'g', d.g));
      if (d.lien) titre.appendChild(el('span', 'x', d.lien));
      titre.appendChild(el('span', 'i', d.i));
      r.append(el('span', 'no mono', pad(n + 1)), titre, el('span', 'role mono', d.role),
        el('span', 'cat mono', CATS[d.cat] || ''), el('span', 'an mono', d.an || ''));
      r.addEventListener('pointerenter', function (e) {
        if (tactile) return;
        flot.f = f;
        $('img', flottant).src = affiche(f);
        flot.x = flot.tx = e.clientX; flot.y = flot.ty = e.clientY;
        flottant.classList.add('on');
      });
      r.addEventListener('pointerleave', () => flottant.classList.remove('on'));
      r.addEventListener('click', function (e) {
        const rect = flottant.classList.contains('on') ? flottant.getBoundingClientRect()
          : { left: e.clientX - 60, top: e.clientY - 40, width: 120, height: 80 };
        ouvrir(f, rect);
      });
      liste.appendChild(r);
    });
  }
  addEventListener('pointermove', function (e) { flot.tx = e.clientX; flot.ty = e.clientY; });
  function flotter(dt) {
    if (!flottant.classList.contains('on')) return;
    const ax = flot.x, fw = flottant.offsetWidth, fh = flottant.offsetHeight;
    flot.x += (flot.tx - flot.x) * damp(9, dt);
    flot.y += (flot.ty - flot.y) * damp(9, dt);
    // the picture leans with the speed of the hand
    flot.r += (clamp((flot.x - ax) / dt * .012, -14, 14) - flot.r) * damp(8, dt);
    const x = vertical ? innerWidth - fw - 12 : clamp(flot.x + 24, 8, innerWidth - fw - 8);
    const y = clamp(flot.y - fh / 2, 60, innerHeight - fh - 8);
    flottant.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) skewX(${(-flot.r).toFixed(2)}deg)`;
  }

  // ---------------------------------------------------------------- about: stills are laid down along the path of the hand
  const trainee = $('#trainee');
  const pose = { x: -999, y: -999, n: 0 };
  function poser(x, y, dx) {
    const f = pose.n++ % FILMS.length, im = new Image();
    im.src = affiche(f);
    im.alt = '';
    im.className = 'pose' + (FILMS[f].nb ? ' nb' : '');
    im.style.left = x + 'px';
    im.style.top = y + 'px';
    // each still leans the way the hand was going
    im.style.setProperty('--r', clamp(dx * .12, -14, 14).toFixed(2) + 'deg');
    im.addEventListener('animationend', () => im.remove());
    trainee.appendChild(im);
    if (trainee.children.length > 6) trainee.firstChild.remove();
  }
  addEventListener('pointermove', function (e) {
    if (vue() !== 'apropos' || ouvert) return;
    const dx = e.clientX - pose.x, dy = e.clientY - pose.y;
    if (Math.hypot(dx, dy) < (vertical ? 90 : 150)) return;
    poser(e.clientX, e.clientY, Math.abs(dx) > 400 ? 0 : dx);
    pose.x = e.clientX; pose.y = e.clientY;
  });
  addEventListener('pointerdown', function (e) {
    if (vue() !== 'apropos' || ouvert || e.target.closest('.tete')) return;
    poser(e.clientX, e.clientY, 0);
    pose.x = e.clientX; pose.y = e.clientY;
  });
  $('#geste').textContent = tactile ? T('Touchez, glissez', 'Touch, drag') : T('Bougez le curseur', 'Move the cursor');

  // ---------------------------------------------------------------- the film, full frame
  const film = $('#film'), fv = $('#fv');
  let courant = 0, origine = null, repos, prise = false, affichee = 0, tTexte = '', tPause = false;
  const COURBE = 'cubic-bezier(.7,0,.15,1)';
  const boite = r => ({ left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  const ecran = () => ({ left: '0px', top: '0px', width: innerWidth + 'px', height: innerHeight + 'px' });

  // The cover loop fills the screen first; the real film (Vimeo) fades in over it once it is playing.
  const cadreV = $('#vimeo');
  let joueur = null, vt = 0, vd = 0, vpause = false, vmuet = true, qualites = [], qualite = 'auto';
  const fa = $('#fa');
  function monter(id) {
    demonter();
    if (!id) return;
    const fr = el('iframe');
    fr.src = `https://player.vimeo.com/video/${id}?autoplay=1&muted=1&controls=0&title=0&byline=0&portrait=0&dnt=1&playsinline=1`;
    fr.allow = 'autoplay; fullscreen; picture-in-picture';
    cadreV.appendChild(fr);
    if (!window.Vimeo) { fr.onload = () => cadreV.classList.add('on'); return; }
    joueur = new window.Vimeo.Player(fr);
    joueur.on('timeupdate', function (e) {
      vt = e.seconds; vd = e.duration;
      if (vt > .05) cadreV.classList.add('on');
    });
    joueur.on('play', function () { vpause = false; });
    joueur.on('pause', function () { vpause = true; });
    joueur.on('ended', () => voisin(1));
    // always start at the best quality the film has; the 화질 button then lets the viewer step down
    joueur.ready().then(() => joueur.getQualities()).then(function (qs) {
      qualites = qs.map(q => q.id).filter(q => q !== 'auto').sort((a, b) => parseInt(b, 10) - parseInt(a, 10));
      if (!qualites.length) return;
      qualites.push('auto');
      return regler(qualites[0]);
    }).catch(function () {});
  }
  function regler(q) {
    if (!joueur) return;
    return joueur.setQuality(q).then(function () {
      qualite = q;
      $('#qualiteTxt').textContent = q === 'auto' ? 'Auto' : q;
      $('#qualite').classList.add('dispo');
    }).catch(function () {
      // Vimeo only allows this on some accounts: without it, the control stays hidden and Vimeo picks by itself
      $('#qualite').classList.remove('dispo');
    });
  }
  function qualiteSuivante() {
    if (qualites.length) regler(qualites[(qualites.indexOf(qualite) + 1) % qualites.length]);
  }
  // the full-HD still of the film: shown sharp while the film itself gets ready
  // How a film sits on the screen. It is shown whole, with one exception: when the screen is only a little wider
  // than the film, the thin black bands left and right read as a mistake, so the film is enlarged to the full
  // width and loses a sliver at the top and the foot (never more than REMPLIR of its height). The sides of a
  // film are never cut, and a film much narrower than the screen (square, vertical) keeps its bands.
  const REMPLIR = .12;
  function echelle(f) {
    const d = FILMS[f], k = (innerWidth / innerHeight) / (d.l / d.h || 16 / 9);
    return k > 1 && 1 - 1 / k <= REMPLIR ? k : 1;
  }
  const ajuster = (image, f) => { image.style.objectFit = echelle(f) > 1 ? 'cover' : 'contain'; };
  function recadrer() {
    film.style.setProperty('--ky', echelle(courant).toFixed(4));
    ajuster(fa, courant);
  }
  function nettete(f) {
    fa.classList.remove('on');
    const im = new Image();
    im.onload = function () {
      if (!ouvert || courant !== f) return;
      fa.src = im.src;
      fa.classList.add('on');
    };
    im.src = nette(f);
  }
  function demonter() {
    cadreV.classList.remove('on');
    cadreV.innerHTML = '';
    joueur = null;
    vt = vd = 0; vpause = false; vmuet = true;
    qualites = []; qualite = 'auto';
    $('#qualite').classList.remove('dispo');
    $('#sonTxt').textContent = T('Son coupé', 'Muted');
    $('#son').classList.remove('actif');
  }

  function charger(f, attendre) {
    courant = f;
    recadrer();
    const d = FILMS[f], n = visibles.indexOf(f);
    fv.src = boucle(f);
    fv.loop = true;
    fv.play().catch(function () {});
    $('#fNo').textContent = `${pad(n + 1)} — ${pad(visibles.length)}`;
    construireTuiles();
    ecrireTitre(d);
    fiche(f, n);
    affichee = 0;
    if (attendre) demonter(); else { monter(d.vimeo); nettete(f); }
  }
  // a command in the site's own form: squares holding a Korean word, captioned in French
  function carres(ko, fr, tag) {
    const b = el(tag || 'button', 'btn'), k = el('span', 'k');
    for (const ch of ko) k.appendChild(el('b', '', ch));
    b.append(k, el('span', 'mono', fr));
    return b;
  }
  // The credits are a générique: they hang on a centre line, roles on the left, names on the right,
  // and they roll up over the film like the end credits of a film.
  const roule = $('#fiche');
  const gen = { y: 0, vu: 0, pause: 0, prise: false, p: 0 };
  function fiche(f, n) {
    const d = FILMS[f];
    roule.innerHTML = '';
    const ligne = function (gauche, droite, cls) {
      const r = el('div', 'gl' + (cls ? ' ' + cls : ''));
      r.append(el('div', 'ga mono', gauche), droite);
      roule.appendChild(r);
    };
    const titre = el('div', 'gd');
    titre.append(el('h2', '', d.g), el('h3', '', (d.lien ? d.lien + ' ' : '') + d.i));
    ligne([`${T('N°', 'No.')} ${pad(n + 1)} / ${pad(visibles.length)}`, etiquette(d)].filter(Boolean).join(' · '), titre, 'gtitre');
    if (d.texte.length) {
      const t = el('div', 'gd gtexte');
      for (const p of d.texte) t.appendChild(el('p', '', p));
      ligne('Note', t, 'gnote');
    }
    for (const [role, noms] of d.credits) {
      const dd = el('div', 'gd');
      for (const nom of noms) dd.appendChild(el('span', '', nom));
      ligne(role, dd);
    }
    if (d.vimeo) {
      const v = carres('보기', T('Voir sur Vimeo ↗', 'Watch on Vimeo ↗'), 'a'), dd = el('div', 'gd');
      v.href = `https://vimeo.com/${d.vimeo}`;
      v.target = '_blank';
      v.rel = 'noopener';
      dd.appendChild(v);
      ligne('Vimeo', dd, 'gfin');
    }
    gen.y = gen.vu = innerHeight * .78;
  }
  function info(on) {
    film.classList.toggle('info', on);
    $('#info').classList.toggle('actif', on);
    if (on) { gen.y = gen.vu = innerHeight * .78; gen.pause = 0; }
  }
  // it rolls by itself; the wheel or a drag takes it over for a moment
  function rouleGenerique(dt) {
    if (!film.classList.contains('info')) return;
    if (!gen.prise && performance.now() > gen.pause) gen.y -= 44 * dt;
    gen.y = clamp(gen.y, innerHeight * .5 - roule.offsetHeight, innerHeight * .78);
    gen.vu += (gen.y - gen.vu) * damp(10, dt);
    roule.style.transform = `translate3d(0,${gen.vu.toFixed(1)}px,0)`;
  }

  // the picture you clicked grows until it is the screen
  const leve = r => ({ left: r.left - r.width * .07, top: r.top - r.height * .14 - 46, width: r.width * 1.14, height: r.height * 1.14 });
  let choisie = null;
  // the picture that is in flight is hidden in the strip, so it is never seen twice
  function cacher(e) {
    if (choisie) choisie.style.visibility = '';
    choisie = e || null;
    if (choisie) choisie.style.visibility = 'hidden';
  }
  function ouvrir(f, rect, depuis) {
    if (ouvert) return;
    ouvert = true;
    origine = rect;
    clearTimeout(reveil);
    quitter(survol);
    cacher(depuis);
    document.body.classList.add('film', 'sorti');
    charger(f, true);
    const a = fv.animate([
      Object.assign(boite(rect), { easing: 'cubic-bezier(.2,.8,.2,1)' }),
      Object.assign(boite(leve(rect)), { offset: .3, easing: COURBE }),
      ecran(),
    ], { duration: 1300, fill: 'both' });
    a.onfinish = function () { a.cancel(); };
    setTimeout(function () { if (ouvert) film.classList.add('sombre'); }, 330);
    setTimeout(function () {
      if (!ouvert) return;
      film.classList.add('pret');
      eveil();
      if (courant === f) { monter(FILMS[f].vimeo); nettete(f); }
    }, 1050);
  }
  function fermer() {
    if (!ouvert) return;
    info(false);
    atterrir();
    fa.classList.remove('on');
    film.classList.remove('pret', 'repos', 'sombre');
    clearTimeout(repos);
    demonter();
    // go back to where that film is now, if it is on screen
    let rect = origine, place = null;
    if (vue() === 'bande' && !vertical) {
      placer(courant);
      temps(0.016, performance.now());
      rect = fenetre.getBoundingClientRect();
      place = fenetre;
    } else if (vue() === 'bande') {
      const it = items.find(i => i.f === courant && i.vis);
      if (it) { rect = it.el.getBoundingClientRect(); place = it.el; }
    }
    cacher(place);
    const a = fv.animate([
      Object.assign(ecran(), { easing: COURBE }),
      Object.assign(boite(leve(rect)), { offset: .7, easing: 'cubic-bezier(.3,1.5,.5,1)' }),
      boite(rect),
    ], { duration: 1150, fill: 'both' });
    setTimeout(() => document.body.classList.remove('sorti'), 520);
    a.onfinish = function () {
      a.cancel();
      fv.pause();
      cacher(null);
      document.body.classList.remove('film');
      ouvert = false;
      dernierGeste = performance.now();
      luF = -1;
    };
  }
  // Between two films, a swipe: the film you were watching slides out to one side as the next one slides in from
  // the other (from the right for the next film, from the left for the previous one), both as their sharp stills.
  const dessous = film.insertBefore(el('img'), cadreV), arrive = film.insertBefore(el('img'), cadreV);
  dessous.className = arrive.className = 'glisse';
  dessous.alt = arrive.alt = '';
  let enVol = false, vol = [];
  function atterrir() {
    vol.forEach(a => a.cancel());
    vol = [];
    dessous.classList.remove('on');
    arrive.classList.remove('on');
    enVol = false;
  }
  function voisin(sens) {
    if (enVol) return;
    const n = Math.max(0, visibles.indexOf(courant)), suivant = visibles[(n + sens + visibles.length) % visibles.length];
    if (leger) return charger(suivant);
    enVol = true;
    dessous.src = nette(courant);
    ajuster(dessous, courant);
    dessous.classList.add('on');
    fa.style.transition = 'none';
    fa.classList.remove('on');
    charger(suivant, true);
    const im = new Image();
    im.src = nette(suivant);
    const partir = function () {
      if (!enVol || courant !== suivant) return;
      arrive.src = im.src;
      ajuster(arrive, suivant);
      arrive.classList.add('on');
      const o = { duration: 950, easing: COURBE, fill: 'both' };
      vol = [
        dessous.animate([{ transform: 'none' }, { transform: `translateX(${-sens * 100}%)` }], o),
        arrive.animate([{ transform: `translateX(${sens * 100}%)` }, { transform: 'none' }], o),
      ];
      vol[1].onfinish = function () {
        // the sharp still stays in place under the film, which fades in over it once it plays
        fa.src = im.src;
        fa.classList.add('on');
        void fa.offsetWidth;
        fa.style.transition = '';
        atterrir();
        if (ouvert) monter(FILMS[suivant].vimeo);
      };
    };
    im.decode ? im.decode().then(partir, partir) : (im.onload = im.onerror = partir);
  }
  function basculer() {
    if (joueur) vpause ? joueur.play().catch(function () {}) : joueur.pause().catch(function () {});
  }
  function son() {
    if (!joueur) return;
    vmuet = !vmuet;
    joueur.setMuted(vmuet).catch(function () {});
    if (!vmuet) joueur.setVolume(1).catch(function () {});
    $('#sonTxt').textContent = vmuet ? T('Son coupé', 'Muted') : T('Son', 'Sound');
    $('#son').classList.toggle('actif', !vmuet);
  }
  function aller(t) {
    if (joueur && vd) joueur.setCurrentTime(clamp(t, 0, vd - .2)).catch(function () {});
  }
  function eveil() {
    film.classList.remove('repos');
    clearTimeout(repos);
    repos = setTimeout(function () {
      if (ouvert && !vpause && !prise && !film.classList.contains('info')) film.classList.add('repos');
    }, 1800);
  }
  // ---- the bar: two rows of manuscript tiles. The title is written in the top row, two letters to a tile;
  // the bottom row is the film: its tiles fill with grey-blue ink as it plays.
  const tTitre = $('#tTitre'), tRegle = $('#tRegle'), tTemps = $('#tTemps');
  let NT = 0, tEncres = [], tCases = [], tCourante = -1, tDuree = -1, tEcrit = 0;
  function construireTuiles() {
    const n = innerWidth < 700 ? 20 : 40;
    if (n !== NT) {
      NT = n;
      film.style.setProperty('--nt', n);
      tTitre.innerHTML = tRegle.innerHTML = tTemps.innerHTML = '';
      tEncres = []; tCases = []; tCourante = -1; tDuree = -1;
      for (let i = 0; i < n; i++) {
        tTitre.appendChild(el('div', 'tu'));
        const t = tRegle.appendChild(el('div', 'tk' + (i % 5 ? '' : ' maj')));
        if (i % 5 === 0) t.appendChild(el('span'));
        const c = tTemps.appendChild(el('div', 'tu'));
        tEncres.push(c.appendChild(el('div', 'enc')));
        tCases.push(c);
      }
      if (ouvert) ecrireTitre(FILMS[courant]);
    }
    film.style.setProperty('--ct', tTemps.getBoundingClientRect().width / NT + 'px');
  }
  // two letters to a tile, an empty tile between words: the rule of Korean manuscript paper for Latin text
  function ecrireTitre(d) {
    const jetons = [];
    const mots = function (texte, cls) {
      texte.split(' ').forEach(function (mot) {
        if (jetons.length) jetons.push({ t: '' });
        for (let i = 0; i < mot.length; i += 2) jetons.push({ t: mot.slice(i, i + 2), cls });
      });
    };
    mots(d.g, 'g');
    if (d.lien) jetons.push({ t: '' }, { t: d.lien, cls: 'x' });
    if (d.i) mots(d.i, 'i');
    const cases = [...tTitre.children], tour = ++tEcrit;
    cases.forEach(function (c) { c.textContent = ''; c.className = 'tu'; });
    jetons.slice(0, cases.length).forEach(function (j, k) {
      setTimeout(function () {
        if (tour !== tEcrit) return;
        cases[k].textContent = j.t;
        if (j.cls) cases[k].classList.add(j.cls);
      }, 260 + k * 38);
    });
  }
  function viser(e) {
    const r = tTemps.getBoundingClientRect(), fr = clamp((e.clientX - r.left) / r.width, 0, .9999), i = Math.floor(fr * NT);
    tCases.forEach((c, j) => c.classList.toggle('hov', j === i));
    if (prise) aller(fr * vd);
  }
  tTemps.addEventListener('pointerdown', function (e) { prise = true; tTemps.setPointerCapture(e.pointerId); viser(e); });
  tTemps.addEventListener('pointermove', viser);
  tTemps.addEventListener('pointerup', function () { prise = false; });
  tTemps.addEventListener('pointerleave', function () { if (!prise) tCases.forEach(c => c.classList.remove('hov')); });
  $('#pause').onclick = basculer;
  $('#voile').addEventListener('click', basculer);
  $('#retour').onclick = fermer;
  $('#son').onclick = son;
  $('#qualite').onclick = qualiteSuivante;
  $('#info').onclick = () => info(!film.classList.contains('info'));
  const generique = $('#generique');
  generique.addEventListener('wheel', function (e) {
    e.preventDefault();
    gen.y -= e.deltaMode === 1 ? e.deltaY * 32 : e.deltaY;
    gen.pause = performance.now() + 1800;
  }, { passive: false });
  generique.addEventListener('pointerdown', function (e) { gen.prise = true; gen.p = e.clientY; generique.setPointerCapture(e.pointerId); });
  generique.addEventListener('pointermove', function (e) {
    if (!gen.prise) return;
    gen.y += e.clientY - gen.p;
    gen.p = e.clientY;
  });
  const lacherGen = function () { gen.prise = false; gen.pause = performance.now() + 1800; };
  generique.addEventListener('pointerup', lacherGen);
  generique.addEventListener('pointercancel', lacherGen);
  $('#prec').onclick = () => voisin(-1);
  $('#suiv').onclick = () => voisin(1);
  film.addEventListener('pointermove', eveil);
  film.addEventListener('pointerdown', eveil);

  function lecteur(dt) {
    if (!ouvert) return;
    rouleGenerique(dt);
    // the film's own time once it plays; until then, the loop that is on screen
    const duree = vd || fv.duration || 0, temps = vd ? vt : fv.currentTime || 0;
    const reel = duree ? temps / duree * NT : 0;
    affichee += (reel - affichee) * damp(12, dt);
    if (Math.abs(reel - affichee) < .002) affichee = reel;
    const i = Math.min(NT - 1, Math.floor(affichee));
    for (let j = 0; j < NT; j++) {
      const v = j < i ? 1 : j === i ? affichee - i : 0;
      if (tEncres[j]._v !== v) tEncres[j].style.transform = `scaleX(${tEncres[j]._v = v})`;
    }
    if (i !== tCourante) {
      if (tCases[tCourante]) tCases[tCourante].classList.remove('cur');
      tCases[i].classList.add('cur');
      tCourante = i;
    }
    if (duree !== tDuree) {
      tDuree = duree;
      $$('.tk span', tRegle).forEach(function (s, j) { s.textContent = duree ? tc(j * 5 / NT * duree).slice(3) : ''; });
    }
    const texte = duree ? `${tc(temps)} / ${tc(duree)}` : '';
    if (texte !== tTexte) $('#fTc').textContent = tTexte = texte;
    if (vpause !== tPause) {
      tPause = vpause;
      $('#pauseTxt').textContent = vpause ? T('Lecture', 'Play') : 'Pause';
      $('#pause').classList.toggle('actif', vpause);
      $$('#pause .k b').forEach((b, k) => { b.textContent = (vpause ? '재생' : '멈춤')[k]; });
    }
  }

  addEventListener('keydown', function (e) {
    if (ouvert) {
      if (e.key === 'Escape') film.classList.contains('info') ? info(false) : fermer();
      else if (e.key === ' ') { e.preventDefault(); basculer(); }
      else if (e.key === 'ArrowRight') e.shiftKey ? voisin(1) : aller(vt + 5);
      else if (e.key === 'ArrowLeft') e.shiftKey ? voisin(-1) : aller(vt - 5);
      else if (e.key === 'm') son();
      else if (e.key === 'i') info(!film.classList.contains('info'));
      eveil();
      return;
    }
    if (e.key === 'Escape' && vue() !== 'bande') voir('bande');
    else if (!vertical && vue() === 'bande' && 'jklJKL'.includes(e.key) && e.key.length === 1) navetter({ j: -1, k: 0, l: 1 }[e.key.toLowerCase()]);
    else if (!vertical && vue() === 'bande' && (e.key === '+' || e.key === '=')) viserZoom(zc * 1.4);
    else if (!vertical && vue() === 'bande' && (e.key === '-' || e.key === '_')) viserZoom(zc / 1.4);
    else if (!vertical && vue() === 'bande' && e.key === '0') viserZoom(1);
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') vertical ? pousser(PAS) : sauter(1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') vertical ? pousser(-PAS) : sauter(-1);
  });

  // ---------------------------------------------------------------- about: the greeting turns through his four languages
  const tour = $('#tour');
  let salut = 0;
  setInterval(function () {
    if (vue() !== 'apropos') return;
    salut++;
    tour.style.transform = `translateY(${-salut * tour.firstElementChild.offsetHeight}px)`;
    if (salut < tour.children.length - 1) return;
    // the last line is the first one again: jump back unseen
    setTimeout(function () {
      tour.style.transition = 'none';
      salut = 0;
      tour.style.transform = '';
      void tour.offsetWidth;
      tour.style.transition = '';
    }, 1000);
  }, 2400);

  // ---------------------------------------------------------------- contact: a click on the address copies it
  $('#courriel').onclick = function () {
    const f = $('.f', this), adresse = this.dataset.copie;
    const ecrire = function () { location.href = 'mailto:' + adresse; };
    if (!navigator.clipboard) return ecrire();
    navigator.clipboard.writeText(adresse).then(function () {
      f.textContent = T('Copié', 'Copied');
      setTimeout(function () { f.textContent = T('Copier', 'Copy'); }, 1600);
    }, ecrire);
  };

  // ---------------------------------------------------------------- the cursor: a red square that frames a command when it is over one
  const curseur = $('#curseur');
  const cz = { x: 0, y: 0, w: 26, h: 26, tx: 0, ty: 0, tw: 26, th: 26, vu: false };
  if (!tactile) addEventListener('pointermove', function (e) {
    const b = e.target.closest ? e.target.closest('.btn') : null;
    const tu = e.target.closest ? e.target.closest('#tTemps .tu') : null;
    if (tu) {
      // over the time bar it sticks to the tile under it and takes its size
      const r = tu.getBoundingClientRect();
      cz.tx = r.left; cz.ty = r.top; cz.tw = r.width; cz.th = r.height;
    } else if (b) {
      const r = $('.k', b).getBoundingClientRect();
      cz.tx = r.left - 4; cz.ty = r.top - 4; cz.tw = r.width + 8; cz.th = r.height + 8;
    } else {
      cz.tx = e.clientX - 13; cz.ty = e.clientY - 13; cz.tw = cz.th = 26;
    }
    if (cz.vu) return;
    cz.vu = true;
    cz.x = cz.tx; cz.y = cz.ty;
    curseur.style.opacity = 1;
  });
  function curser(dt) {
    if (!cz.vu) return;
    const k = damp(20, dt);
    cz.x += (cz.tx - cz.x) * k; cz.y += (cz.ty - cz.y) * k;
    cz.w += (cz.tw - cz.w) * k; cz.h += (cz.th - cz.h) * k;
    curseur.style.transform = `translate3d(${cz.x.toFixed(1)}px,${cz.y.toFixed(1)}px,0)`;
    curseur.style.width = cz.w.toFixed(1) + 'px';
    curseur.style.height = cz.h.toFixed(1) + 'px';
  }

  // ---------------------------------------------------------------- two clocks: where he is from, where he works
  const fmt = zone => new Intl.DateTimeFormat('fr-FR', { timeZone: zone, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const fS = fmt('Asia/Seoul'), fP = fmt('Europe/Paris');
  function horloge() {
    const d = new Date();
    $('#heures').textContent = $('#heures2').textContent = `Paris ${fP.format(d)} · ${T('Séoul', 'Seoul')} ${fS.format(d)}`;
  }

  // ---------------------------------------------------------------- start
  let largeurVue = 0;
  function taille() {
    vertical = innerWidth < 700;
    document.body.classList.toggle('temps', !vertical);
    tailleRegle();
    // a shorter window leaves less room for tall tracks
    if (!vertical) regleHauteur(hp);
    if (innerWidth !== largeurVue) {
      largeurVue = innerWidth;
      construireBande();
      construireTitres();
      ajusterTitres();
    } else {
      if (vertical) L = bandeEl.clientHeight;
      ajusterTitres();
    }
    if (ouvert) { construireTuiles(); recadrer(); }
  }
  document.addEventListener('visibilitychange', function () { if (document.hidden) vif.pause(); });
  let avant = 0;
  function image(ms) {
    const brut = (ms - avant) / 1000, dt = clamp(brut, .001, .05);
    avant = ms;
    if (!leger && brut < .5) {
      lent = brut > .034 ? lent + brut : Math.max(0, lent - brut * .5);
      if (lent > 1.6) alleger();
    }
    vertical ? bande(dt, ms) : temps(dt, ms);
    dessinerRegle();
    flotter(dt);
    lecteur(dt);
    curser(dt);
    requestAnimationFrame(image);
  }
  construireFiltres();
  construireListe();
  voir('bande');
  taille();
  horloge();
  setInterval(horloge, 1000);
  addEventListener('resize', taille);
  if (document.fonts) document.fonts.ready.then(ajusterTitres);
  requestAnimationFrame(function (ms) { avant = ms; image(ms); });
})();
