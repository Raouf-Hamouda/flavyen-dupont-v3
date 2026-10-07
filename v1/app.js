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
  const vue = () => document.body.dataset.vue;

  // ---------------------------------------------------------------- content: his 25 projects, from donnees.js
  const CATS = { pub: 'Pub', fiction: 'Fiction' };
  const FILMS = window.FILMS;
  const boucle = f => `../affiches/${FILMS[f].slug}${EXT}`;
  const nette = f => FILMS[f].hd ? `../affiches/${FILMS[f].slug}-hd.jpg` : affiche(f);
  const affiche = f => `../affiches/${FILMS[f].slug}${FILMS[f].hd ? '-m' : ''}.jpg`;
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
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    pousser((e.deltaMode === 1 ? d * 32 : d) * 1.15);
  }, { passive: false });

  const glisse = { on: false, p: 0, bouge: 0, v: 0, t: 0 };
  const axe = e => vertical ? e.clientY : e.clientX;
  bandeEl.addEventListener('pointerdown', function (e) {
    glisse.on = true; glisse.p = axe(e); glisse.bouge = 0; glisse.v = 0; glisse.t = performance.now();
    bandeEl.classList.add('prise');
  });
  addEventListener('pointermove', function (e) {
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
  function dessinerRegle() {
    const PASR = 8, long = vertical ? rh : rw;
    // nothing moved since the last frame: nothing to redraw
    if (Math.abs(pos - regleVue) < .05) return;
    regleVue = pos;
    rc.clearRect(0, 0, rw, rh);
    rc.fillStyle = '#0c0c0c';
    rc.font = '8.5px "IBM Plex Mono", monospace';
    for (let k = Math.floor(pos / PASR); (k * PASR - pos) < long; k++) {
      const p = Math.round(k * PASR - pos) + .5, dix = k % 10 === 0, cinq = k % 5 === 0;
      const trait = dix ? 9 : cinq ? 6 : 3;
      rc.globalAlpha = dix ? .9 : cinq ? .5 : .22;
      if (vertical) { rc.fillRect(0, p, trait, 1); continue; }
      rc.fillRect(p, 0, 1, trait);
      if (dix) {
        rc.globalAlpha = .45;
        rc.fillText(String(((k * PASR / 10) % 1000 + 1000) % 1000 | 0).padStart(3, '0'), p + 3, 22);
      }
    }
    rc.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- filters and views
  function construireFiltres() {
    const cats = $('#cats');
    cats.innerHTML = '';
    for (const [id, nom] of [['tout', 'Tout'], ...Object.entries(CATS)]) {
      const b = el('button', id === filtre ? 'actif' : '', nom);
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

  // ---------------------------------------------------------------- strip <-> list: everything passes through the ruler
  // To the list: the pictures fold down into the ruler line; the line then splits into as many lines as there are
  // films, which travel to their places and become the rules of the list; the titles come in on them.
  // Back to the strip: the titles leave, the rules gather into one line again, and the pictures stand up out of it.
  const passage = document.body.appendChild(el('div'));
  passage.id = 'passage';
  let enPassage = false;
  const COURBE_P = 'cubic-bezier(.7,0,.2,1)';
  function lignesDeListe() {
    const rangs = $$('.rang', liste), haut = liste.offsetTop - liste.scrollTop, bas = liste.offsetTop + liste.clientHeight;
    const ys = rangs.map(r => haut + r.offsetTop);
    if (rangs.length) ys.push(haut + rangs[rangs.length - 1].offsetTop + rangs[rangs.length - 1].offsetHeight);
    return ys.filter(y => y >= liste.offsetTop - 1 && y <= bas + 1);
  }
  // One continuous movement: every part starts before the one before it has finished, so nothing waits and
  // nothing cuts. Both views are on screen for the whole passage; the view only changes name at the very end.
  function passer(vers) {
    if (enPassage) return;
    if (vertical || leger) return voir(vers);
    enPassage = true;
    quitter(survol);
    const versListe = vers === 'liste', mi = innerWidth / 2, yRegle = regle.offsetTop;
    const DOUX = 'cubic-bezier(.65,0,.35,1)', SORTIE = 'cubic-bezier(.22,1,.36,1)';
    const anims = [];
    const anime = function (e, images, options) {
      const a = e.animate(images, Object.assign({ fill: 'both' }, options));
      anims.push(a);
      return a;
    };
    const tenir = (e, T) => anime(e, [{ opacity: 1, transform: 'none' }, { opacity: 1, transform: 'none' }], { duration: T });
    document.body.classList.add('net');

    // the rules of the list, and how far each one is from the ruler
    const rangs = $$('.rang', liste), ys = lignesDeListe();
    const ordre = ys.map((y, k) => k).sort((p, q) => Math.abs(ys[p] - yRegle) - Math.abs(ys[q] - yRegle));
    const rang = [];
    ordre.forEach((k, n) => { rang[k] = n; });
    const vus = items.filter(it => !it.loin);
    const ecart = it => Math.min(1, Math.abs(it.el.getBoundingClientRect().left + W / 2 - mi) / mi);
    const PLEIN = 'inset(0% 0% 0% 0%)', PLIE = 'inset(100% 0% 0% 0%)';

    if (versListe) {
      const T = 300 + ys.length * 12 + 820 + 520;
      tenir(liste, T);
      // the pictures sink into the ruler, the middle ones first; each picture slides a little inside its frame as it goes
      for (const it of vus) {
        const d = ecart(it) * 190;
        anime(it.cadre, [{ clipPath: PLEIN }, { clipPath: PLIE }], { duration: 640, delay: d, easing: DOUX });
        anime(it.im, [{ transform: 'none' }, { transform: 'translateY(9%) scale(1.06)' }], { duration: 640, delay: d, easing: DOUX });
      }
      for (const e of [$('.axe'), lu]) anime(e, [{ opacity: 1 }, { opacity: 0 }], { duration: 260 });
      anime(titres, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(26px)' }], { duration: 460, easing: DOUX });
      anime(regle, [{ opacity: 1 }, { opacity: 0 }], { duration: 420, delay: 300 });
      // the ruler line opens into the rules of the list, the nearest ones leaving first, darker on the way and
      // settling to the exact grey of a list rule
      ys.forEach(function (y, k) {
        const l = passage.appendChild(el('i', 'trait-p'));
        anime(l, [{ transform: `translateY(${yRegle}px)`, opacity: 0 }, { transform: `translateY(${yRegle}px)`, opacity: .5, offset: .12 }, { transform: `translateY(${y}px)`, opacity: .16 }],
          { duration: 820, delay: 240 + rang[k] * 12, easing: DOUX });
      });
      // each title arrives as its own rule is settling
      rangs.forEach(function (r, k) {
        const d = 240 + (rang[k] === undefined ? ys.length : rang[k]) * 12 + 470;
        anime(r, [{ opacity: 0, transform: 'translateY(20px)' }, { opacity: 1, transform: 'none' }], { duration: 760, delay: d, easing: SORTIE });
      });
      setTimeout(() => finir('liste', anims), T);
    } else {
      const T = 140 + ys.length * 11 + 820 + 760;
      // the titles leave upward, the last row first
      rangs.forEach(function (r, k) {
        anime(r, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-14px)' }], { duration: 420, delay: (rangs.length - 1 - k) * 9, easing: DOUX });
      });
      // the rules gather into the ruler, the farthest ones leaving first so they all arrive together
      const loin = ys.length - 1;
      ys.forEach(function (y, k) {
        const l = passage.appendChild(el('i', 'trait-p'));
        anime(l, [{ transform: `translateY(${y}px)`, opacity: .16 }, { transform: `translateY(${yRegle}px)`, opacity: .5, offset: .88 }, { transform: `translateY(${yRegle}px)`, opacity: 0 }],
          { duration: 820, delay: 140 + (loin - rang[k]) * 11, easing: DOUX });
      });
      const arrive = 140 + loin * 11 + 560;
      tenir(bandeEl, T);
      anime(regle, [{ opacity: 0, transform: 'none' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: arrive - 120 });
      // the pictures rise out of the ruler, the middle ones first
      for (const it of vus) {
        const d = arrive + ecart(it) * 190;
        anime(it.cadre, [{ clipPath: PLIE }, { clipPath: PLEIN }], { duration: 760, delay: d, easing: SORTIE });
        anime(it.im, [{ transform: 'translateY(9%) scale(1.06)' }, { transform: 'none' }], { duration: 760, delay: d, easing: SORTIE });
      }
      for (const e of [$('.axe'), lu]) anime(e, [{ opacity: 0, transform: 'none' }, { opacity: 1, transform: 'none' }], { duration: 400, delay: arrive + 260 });
      anime(titres, [{ opacity: 0, transform: 'translateY(26px)' }, { opacity: 1, transform: 'none' }], { duration: 700, delay: arrive + 160, easing: SORTIE });
      setTimeout(() => finir('bande', anims), T);
    }
  }
  function finir(vers, anims) {
    voir(vers);
    anims.forEach(a => a.cancel());
    passage.innerHTML = '';
    roulePenche = '';
    // the views are in their final state; give them their own transitions back on the next frame
    requestAnimationFrame(function () {
      document.body.classList.remove('net');
      enPassage = false;
      dernierGeste = performance.now();
    });
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
    if (trainee.children.length > 18) trainee.firstChild.remove();
  }
  addEventListener('pointermove', function (e) {
    if (vue() !== 'apropos' || ouvert) return;
    const dx = e.clientX - pose.x, dy = e.clientY - pose.y;
    if (Math.hypot(dx, dy) < (vertical ? 70 : 110)) return;
    poser(e.clientX, e.clientY, Math.abs(dx) > 400 ? 0 : dx);
    pose.x = e.clientX; pose.y = e.clientY;
  });
  addEventListener('pointerdown', function (e) {
    if (vue() !== 'apropos' || ouvert || e.target.closest('.tete')) return;
    poser(e.clientX, e.clientY, 0);
    pose.x = e.clientX; pose.y = e.clientY;
  });
  $('#geste').textContent = tactile ? 'Touchez, glissez' : 'Bougez le curseur';

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
    $('#sonTxt').textContent = 'Son coupé';
    $('#son').classList.remove('actif');
  }

  function charger(f, attendre) {
    courant = f;
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
    ligne([`N° ${pad(n + 1)} / ${pad(visibles.length)}`, etiquette(d)].filter(Boolean).join(' · '), titre, 'gtitre');
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
      const v = carres('보기', 'Voir sur Vimeo ↗', 'a'), dd = el('div', 'gd');
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
    fa.classList.remove('on');
    film.classList.remove('pret', 'repos', 'sombre');
    clearTimeout(repos);
    demonter();
    // go back to where that film is now, if it is on screen
    let rect = origine, place = null;
    if (vue() === 'bande') {
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
  function voisin(sens) {
    const n = Math.max(0, visibles.indexOf(courant));
    eclater(courant, sens);
    charger(visibles[(n + sens + visibles.length) % visibles.length]);
  }
  // Between two films: the picture on screen breaks into manuscript tiles, and a wave blows them off the screen
  // in the direction of travel (left for the next film, right for the previous one). The new film is already
  // underneath, settling into place as the tiles clear.
  const eclats = film.insertBefore(el('div'), $('.ui', film));
  eclats.id = 'eclats';
  function eclater(f, sens) {
    if (leger) return;
    const vw = innerWidth, vh = innerHeight, cols = vw < 700 ? 6 : 12, rows = Math.max(4, Math.round(vh / (vw / cols)));
    const cw = vw / cols, ch = vh / rows, src = nette(f), im = new Image();
    im.src = src;
    // each tile carries its own piece of the outgoing picture, framed the way the film was framed
    let fond = '', ox = 0, oy = 0;
    if (im.complete && im.naturalWidth) {
      const k = Math.min(vw / im.naturalWidth, vh / im.naturalHeight), w = im.naturalWidth * k, h = im.naturalHeight * k;
      fond = `background-image:url("${src}");background-size:${w}px ${h}px;`;
      ox = (vw - w) / 2; oy = (vh - h) / 2;
    }
    eclats.innerHTML = '';
    let fin = 0;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const t = eclats.appendChild(el('i'));
        t.style.cssText = `left:${i * cw}px;top:${j * ch}px;width:${cw + 1}px;height:${ch + 1}px;${fond}background-position:${ox - i * cw}px ${oy - j * ch}px;`;
        // the wave runs across the screen from the side the tiles fly toward
        const d = (sens > 0 ? i : cols - 1 - i) * 34 + j * 14 + Math.random() * 70;
        const dx = -sens * (160 + Math.random() * 300), dy = (Math.random() - .5) * 220, r = (Math.random() - .5) * 60;
        t.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${dx}px,${dy}px) rotate(${r}deg) scale(.45)`, opacity: 0 }],
          { duration: 680, delay: d, easing: 'cubic-bezier(.6,0,.3,1)', fill: 'both' });
        fin = Math.max(fin, d + 680);
      }
    }
    // underneath, the new picture eases back from slightly too close
    for (const e of [fv, fa]) e.animate([{ transform: 'scale(1.14)' }, { transform: 'none' }], { duration: fin, easing: 'cubic-bezier(.2,.7,.2,1)' });
    setTimeout(function () { eclats.innerHTML = ''; }, fin + 60);
  }
  function basculer() {
    if (joueur) vpause ? joueur.play().catch(function () {}) : joueur.pause().catch(function () {});
  }
  function son() {
    if (!joueur) return;
    vmuet = !vmuet;
    joueur.setMuted(vmuet).catch(function () {});
    if (!vmuet) joueur.setVolume(1).catch(function () {});
    $('#sonTxt').textContent = vmuet ? 'Son coupé' : 'Son';
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
      $('#pauseTxt').textContent = vpause ? 'Lecture' : 'Pause';
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
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') pousser(PAS);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') pousser(-PAS);
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
      f.textContent = 'Copié';
      setTimeout(function () { f.textContent = 'Copier'; }, 1600);
    }, ecrire);
  };

  // ---------------------------------------------------------------- the cursor: a red square that frames a command when it is over one
  const curseur = $('#curseur');
  const cz = { x: 0, y: 0, w: 26, h: 26, tx: 0, ty: 0, tw: 26, th: 26, vu: false };
  if (!tactile) addEventListener('pointermove', function (e) {
    const b = e.target.closest ? e.target.closest('.btn') : null;
    if (b) {
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
    $('#heures').textContent = $('#heures2').textContent = `Paris ${fP.format(d)} · Séoul ${fS.format(d)}`;
  }

  // ---------------------------------------------------------------- start
  let largeurVue = 0;
  function taille() {
    vertical = innerWidth < 700;
    tailleRegle();
    if (innerWidth !== largeurVue) {
      largeurVue = innerWidth;
      construireBande();
      construireTitres();
      ajusterTitres();
    } else {
      if (vertical) L = bandeEl.clientHeight;
      ajusterTitres();
    }
    if (ouvert) construireTuiles();
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
    bande(dt, ms);
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
