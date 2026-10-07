// The flavyen dupont logo. The word is set in Inter Tight; the f and the l are redrawn as one shape whose
// measurements are read from the typeface itself, so the join keeps the weight of the other letters.
(function () {
  const T = 1000, LS = -.062, NS = 'http://www.w3.org/2000/svg';
  // the settings of the f: size of the corner, thickness of the hook, reach of the crossbar (0 to 1)
  const COURBE = .30, EPAIS = .10, BARRE = 1;
  let M = null;

  function mesurer() {
    const OX = 300, OY = 1150, cv = document.createElement('canvas');
    cv.width = 1500; cv.height = 1500;
    const g = cv.getContext('2d', { willReadFrequently: true });
    g.font = `800 ${T}px "Inter Tight"`;
    g.textBaseline = 'alphabetic';
    const mf = g.measureText('f'), ml = g.measureText('l');
    g.fillText('f', OX, OY);
    const px = g.getImageData(0, 0, cv.width, cv.height).data;
    const plein = (x, y) => px[(y * cv.width + x) * 4 + 3] > 128;
    const gauche = y => { let x = OX - 200; while (x < OX + 900 && !plein(x, y)) x++; return x; };
    const droite = y => { let x = OX + 900; while (x > OX - 200 && !plein(x, y)) x--; return x + 1; };
    const fs0 = gauche(OY - 60) - OX, fs1 = droite(OY - 60) - OX;
    const haut = Math.round(OY - mf.actualBoundingBoxAscent);
    let y0 = -1, y1 = -1, cbL = fs0, cbR = fs1;
    for (let y = haut; y < OY; y++) {
      if (gauche(y) - OX < fs0 - 4) {
        if (y0 < 0) y0 = y;
        y1 = y;
        cbL = Math.min(cbL, gauche(y) - OX);
        cbR = Math.max(cbR, droite(y) - OX);
      }
    }
    const lO = mf.width + LS * T;
    return {
      fs0, fs1, cbL, cbR, cb1: OY - y0, cb0: OY - y1 - 1,
      ls0: lO - ml.actualBoundingBoxLeft, ls1: lO + ml.actualBoundingBoxRight,
      A: ml.actualBoundingBoxAscent, avance: mf.width + ml.width + 2 * LS * T,
    };
  }
  function tracer() {
    const m = M, R = (m.ls0 + 2 - m.fs0) * COURBE;
    const trait = m.cb1 - m.cb0, t = trait * (.8 + 1.4 * EPAIS);
    const cbR = m.cbR + (m.ls0 + 2 - m.cbR) * BARRE;
    const dehors = R > .5 ? `V${-(m.A - R)}A${R} ${R} 0 0 1 ${m.fs0 + R} ${-m.A}` : `V${-m.A}`;
    const ri = Math.max(0, Math.min(R * .7, (m.ls0 - m.fs1) * .9, (m.A - t - m.cb1) * .9));
    const dedans = ri > .5 ? `H${m.fs1 + ri}A${ri} ${ri} 0 0 0 ${m.fs1} ${-(m.A - t - ri)}` : `H${m.fs1}`;
    return `M${m.fs0} 0${dehors}H${m.ls1}V0H${m.ls0}V${-(m.A - t)}${dedans}V0Z` +
      `M${m.cbL} ${-m.cb1}H${cbR}V${-m.cb0}H${m.cbL}Z`;
  }

  function construire(logo) {
    logo.classList.add('logo');
    const svg = document.createElementNS(NS, 'svg'), path = document.createElementNS(NS, 'path');
    const fl = document.createElement('span');
    fl.className = 'fl';
    svg.appendChild(path);
    fl.appendChild(svg);
    logo.appendChild(fl);
    let n = 2, mot = 1, avant = 'l';
    for (const ch of 'avyen dupont') {
      if (ch === ' ') {
        logo.appendChild(document.createElement('span')).className = 'esp';
        mot++;
      } else {
        const c = document.createElement('span'), s = document.createElement('span');
        c.className = 'c w' + mot + (ch === 'n' && avant === 'e' ? ' apres-e' : '');
        s.textContent = ch;
        s.style.setProperty('--n', n++);
        c.appendChild(s);
        logo.appendChild(c);
      }
      avant = ch;
    }
    logo.appendChild(document.createElement('span')).className = 'pt';
    const x0 = Math.min(0, M.cbL), h = M.A + 2;
    path.setAttribute('d', tracer());
    svg.setAttribute('viewBox', `${x0} ${-h} ${M.avance - x0} ${h}`);
    svg.style.width = (M.avance - x0) / T + 'em';
    svg.style.height = h / T + 'em';
    svg.style.marginLeft = x0 / T + 'em';
  }

  const api = window.logoFD = {
    pret: false,
    // replay every logo inside a page (or do nothing if that page has none)
    jouer: function (page) {
      if (!api.pret || !page) return;
      page.querySelectorAll('[data-logo]').forEach(function (l) {
        l.classList.remove('joue');
        void l.offsetWidth;
        l.classList.add('joue');
      });
    },
  };
  const lancer = function () {
    M = mesurer();
    document.querySelectorAll('[data-logo]').forEach(construire);
    api.pret = true;
  };
  (document.fonts ? document.fonts.load('800 100px "Inter Tight"', 'flavyen dupont').catch(function () {}) : Promise.resolve()).then(lancer);
})();
