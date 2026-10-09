const X = '<i>x</i>';
const Y = '<i>y</i>';
export const DIFFICULTIES = ['FACILE', 'MEDIA', 'DIFFICILE', 'FOLLE'];
export const FAMILIES_PER_DIFFICULTY = 5;

const fmt = value => String(Number(value.toFixed(2))).replace('-', '−').replace('.', ',');
const coefficient = value => value === 1 ? '' : value === -1 ? '−' : fmt(value);
const plus = value => value === 0 ? '' : value < 0 ? ` − ${fmt(-value)}` : ` + ${fmt(value)}`;
const term = (value, suffix) => value === 0 ? '' : `${plus(value)}${suffix}`;
const shifted = (symbol, value) => value === 0 ? symbol : value < 0 ? `(${symbol} + ${fmt(-value)})` : `(${symbol} − ${fmt(value)})`;
const signed = (magnitude, sign) => sign < 0 ? -magnitude : magnitude;
const title = (name, prompt, formula, fn, breaks = []) => ({ name, prompt, formula, fn, breaks });

function prng(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function choices(seed) {
  const random = prng(seed);
  const pick = (min, max, step = .1) => Number((min + Math.floor(random() * (Math.round((max - min) / step) + 1)) * step).toFixed(2));
  const sign = () => random() < .5 ? -1 : 1;
  return { pick, sign };
}

const families = {
  FACILE: [
    ({ pick, sign }) => {
      const m = signed(pick(.5, 1, .5), sign()), b = pick(-1, 1, .5);
      return title('Linea obliqua', 'Una pendenza e uno spostamento.', `${Y} = ${coefficient(m)}${X}${plus(b)}`, x => m * x + b);
    },
    ({ pick, sign }) => {
      const a = signed(pick(.25, .5, .25), sign()), h = pick(-1, 1, 1), k = pick(-1, 1, 1);
      return title('Parabola', 'Cerca il vertice e segui i due lati.', `${Y} = ${fmt(a)}${shifted(X, h)}<sup>2</sup>${plus(k)}`, x => a * (x - h) ** 2 + k);
    },
    ({ pick, sign }) => {
      const a = signed(pick(.5, 1, .5), sign()), h = pick(-1, 1, 1), k = pick(-1, 1, 1);
      return title('Spigolo', 'Un punto cambia la direzione della curva.', `${Y} = ${coefficient(a)}|${X}${plus(-h)}|${plus(k)}`, x => a * Math.abs(x - h) + k);
    },
    ({ pick }) => {
      const a = pick(1, 2, .5), h = pick(-1, 1, 1), k = pick(-1, 1, 1);
      return title('Onda', 'La curva sale e scende con un ritmo regolare.', `${Y} = ${coefficient(a)}sin(${shifted(X,h)})${plus(k)}`, x => a * Math.sin(x-h)+k);
    },
    ({ pick, sign }) => {
      const a = signed(.1, sign()), k = pick(-1, 1, .5);
      return title('Curva a S', 'Un cambio di curvatura morbido al centro.', `${Y} = ${fmt(a)}${X}<sup>3</sup>${plus(k)}`, x => a * x ** 3 + k);
    }
  ],
  MEDIA: [
    ({ pick, sign }) => {
      const a = signed(.1, sign()), r1 = pick(-3, -2, 1), r2 = 0, r3 = pick(2, 3, 1);
      return title('Tre attraversamenti', 'Tre zeri possono creare due svolte.', `${Y} = ${fmt(a)}${shifted(X, r1)}${shifted(X, r2)}${shifted(X, r3)}`, x => a * (x-r1) * (x-r2) * (x-r3));
    },
    ({ pick, sign }) => {
      const a = pick(1, 1.5, .5), w = 1, p = 0, m = signed(pick(.1, .2, .1), sign());
      return title('Onda inclinata', 'Un’onda che sale o scende nel complesso.', `${Y} = ${coefficient(a)}sin(${X})${term(m,X)}`, x => a * Math.sin(w*x+p) + m*x);
    },
    ({ pick, sign }) => {
      const a = signed(pick(2, 3, 1), sign()), h = pick(-1, 1, 1), k = pick(-.5, .5, .5);
      return title('Gobba o valle', 'Una sola svolta, poi la curva si appiattisce.', `${Y} = ${fmt(a)} / (1 + ${shifted(X,h)}<sup>2</sup>)${plus(k)}`, x => a / (1 + (x-h)**2) + k);
    },
    ({ pick }) => {
      const a = .1, b = pick(.5, 1, .5), k = pick(-1, 1, 1);
      return title('Due valli', 'Due svolte esterne e una al centro.', `${Y} = ${fmt(a)}${X}<sup>4</sup> − ${coefficient(b)}${X}<sup>2</sup>${plus(k)}`, x => a*x**4-b*x*x+k);
    },
    ({ pick, sign }) => {
      const a = signed(1, sign()), h = pick(-2, 0, 1), k = pick(-1, 1, 1);
      return title('Radice', 'La curva comincia da un punto preciso.', `${Y} = ${coefficient(a)}√${shifted(X,h)}${plus(k)}`, x => x < h ? NaN : a*Math.sqrt(x-h)+k, [h]);
    }
  ],
  DIFFICILE: [
    ({ pick, sign }) => {
      const a = signed(pick(1, 2, .5), sign()), h = pick(-2, 2, .5), k = pick(-1, 1, 1);
      return title('Due rami', 'Un asintoto divide il piano.', `${Y} = ${fmt(a)} / ${shifted(X,h)}${plus(k)}`, x => a/(x-h)+k, [h]);
    },
    ({ pick, sign }) => {
      const a = signed(pick(1, 2, .5), sign()), h1 = pick(-2, -1, 1), h2 = pick(1, 2, 1);
      return title('Due asintoti', 'Tre zone del piano, due muri invisibili.', `${Y} = ${fmt(a)} / (${shifted(X,h1)}${shifted(X,h2)})`, x => a/((x-h1)*(x-h2)), [h1,h2]);
    },
    ({ pick }) => {
      const a = pick(.05, .1, .05), b = pick(.5, 1, .5), m = pick(-.25, .25, .25), k = pick(-1, 1, 1);
      return title('Doppio fondo', 'Due minimi e una gobba, ma non simmetrici.', `${Y} = ${fmt(a)}${X}<sup>4</sup> − ${fmt(b)}${X}<sup>2</sup>${term(m,X)}${plus(k)}`, x => a*x**4-b*x*x+m*x+k);
    },
    ({ pick }) => {
      const a = pick(1, 2, .5), w = pick(1.5, 2, .5), p = pick(-1, 1, 1), b = pick(-.25, .25, .25), k = pick(-1, 1, 1);
      return title('Onda e parabola', 'Le oscillazioni seguono una curva più lenta.', `${Y} = ${fmt(a)} sin(${fmt(w)}${X}${plus(p)})${term(b,`${X}<sup>2</sup>`)}${plus(k)}`, x => a*Math.sin(w*x+p)+b*x*x+k);
    },
    ({ pick }) => {
      const a = pick(2, 3, 1), d = pick(.25, .5, .25), w = pick(2, 3, 1), p = pick(-1, 1, 1);
      return title('Battito', 'L’onda è forte al centro e si spegne ai lati.', `${Y} = ${fmt(a)}e<sup>−${fmt(d)}|${X}|</sup> sin(${fmt(w)}${X}${plus(p)})`, x => a*Math.exp(-d*Math.abs(x))*Math.sin(w*x+p));
    }
  ],
  FOLLE: [
    ({ pick }) => {
      const a = pick(1.4, 2.4, .2), b = pick(.4, .8, .2), h = pick(-.8, .8, .2), p = pick(-1, 1, .2), c = pick(.1, .3, .05);
      return title('Onde accelerate', 'Le oscillazioni cambiano passo.', `${Y} = ${fmt(a)} sin(${fmt(b)}${shifted(X,h)}²${plus(p)}) / (1 + ${fmt(c)}|${X}|)`, x => a*Math.sin(b*(x-h)**2+p)/(1+c*Math.abs(x)));
    },
    ({ pick }) => {
      const a = pick(1.2, 2), b = pick(1.6, 2.8, .2), c = pick(1.1, 2.1, .2), d = pick(2, 3, .5), p = pick(-1, 1, .2), m = pick(-.2, .2, .05);
      return title('Onda nell’onda', 'Un’oscillazione distorce il ritmo di un’altra.', `${Y} = ${fmt(a)} sin(${fmt(b)}${X} + ${fmt(c)} sin(${fmt(d)}${X}${plus(p)}))${term(m,X)}`, x => a*Math.sin(b*x+c*Math.sin(d*x+p))+m*x);
    },
    ({ pick }) => {
      const a = pick(4.5, 6.5, .5), b = pick(15, 30, 1), h = pick(-.9, .9, .1), period = pick(1, 1.6, .2), k = pick(-3, -2, .2), wobble = pick(.15, .4, .05);
      const breaks = Array.from({length:16},(_,i)=>(i-8)*period-h).filter(x=>x>-5&&x<5);
      return title('Denti irregolari', 'Picchi improvvisi tornano a intervalli regolari.', `<span class="boss-variables"><i>u</i> = mod(${X}${plus(h)}; ${fmt(period)})</span>${Y} = ${fmt(k)} + ${fmt(a)} / (1 + ${fmt(b)}<i>u</i>)<br />+ ${fmt(wobble)} sin(18π<i>u</i>)`, x => {const u=((x+h)%period+period)%period;return k+a/(1+b*u)+wobble*Math.sin(18*Math.PI*u)}, breaks);
    },
    ({ pick }) => {
      const a = pick(2.2, 3.2, .2), b = pick(2.5, 4.5, .5), h1 = pick(-2.8, -1.3, .25), h2 = pick(1.3, 2.8, .25), c = pick(.2, .6, .1), w = pick(2, 3.5, .25);
      return title('Picchi gemelli', 'Due picchi stretti sopra una piccola onda.', `${Y} = ${fmt(a)}e<sup>−${fmt(b)}${shifted(X,h1)}²</sup> + ${fmt(a)}e<sup>−${fmt(b)}${shifted(X,h2)}²</sup><br />+ ${fmt(c)} sin(${fmt(w)}${X}) − 1`, x => a*Math.exp(-b*(x-h1)**2)+a*Math.exp(-b*(x-h2)**2)+c*Math.sin(w*x)-1);
    },
    ({ pick }) => {
      const a = pick(1.2, 2.2, .2), b = pick(.5, .8, .1), c = pick(.1, .3, .05), d = pick(1.5, 3, .25), e = pick(2, 5, .5), h = pick(-2, 2, .25), k = pick(-1, 1, .2);
      return title('Forma impossibile', 'Onde accelerate e un picco nascosto.', `${Y} = ${fmt(a)} sin(${fmt(b)}${X}²) / (1 + ${fmt(c)}|${X}|)<br />+ ${fmt(d)} / (1 + ${fmt(e)}${shifted(X,h)}²)${plus(k)}`, x => a*Math.sin(b*x*x)/(1+c*Math.abs(x))+d/(1+e*(x-h)**2)+k);
    }
  ]
};

const explanations = {
  FACILE: [
    'Il numero davanti a x decide se la retta sale o scende e quanto è inclinata. Il numero finale sposta tutta la retta in alto o in basso.',
    'La parentesi al quadrato crea una U; un coefficiente negativo la capovolge. Il valore nella parentesi sposta il vertice a sinistra o a destra, quello finale in verticale.',
    'Il valore assoluto crea una V con uno spigolo. Trova dove ciò che è tra le barre diventa zero: lì cambia direzione. Il segno davanti capovolge la V.',
    'Il seno disegna un’onda regolare. Il numero davanti ne cambia l’altezza; quello nella parentesi la sposta a destra o sinistra e quello finale in alto o in basso.',
    'La terza potenza disegna una S che cambia curvatura sull’asse y. Il segno davanti decide se sale o scende; il numero finale la sposta in verticale.'
  ],
  MEDIA: [
    'La curva attraversa l’asse x nei tre punti in cui uno dei fattori diventa zero. Tra questi attraversamenti compaiono due svolte.',
    'Immagina prima il seno ordinario. Il piccolo termine lineare inclina la sua linea centrale, ma i picchi restano facili da riconoscere.',
    'Il denominatore è più piccolo nel punto indicato dalla parentesi: lì compare una cima, o una valle se il numero davanti è negativo. Ai lati la curva si appiattisce.',
    'Il termine con x⁴ rialza le estremità mentre quello con x² abbassa i lati del centro. Ne escono due valli con una piccola gobba fra loro.',
    'La radice comincia dove la parentesi diventa zero. Da lì cresce velocemente e poi si appiattisce; un segno negativo la riflette.'
  ],
  DIFFICILE: [
    'Il denominatore si annulla dove x raggiunge il valore nella parentesi: lì c’è un asintoto e il tratto va separato in due rami. L’ultimo numero sposta la linea verso cui i rami si avvicinano.',
    'I due fattori al denominatore si annullano in due punti diversi. Segna prima questi due muri verticali: dividono il grafico in tre zone da disegnare separatamente.',
    'La quarta potenza domina ai bordi, mentre il termine quadratico negativo spinge in basso vicino al centro. Il piccolo termine lineare rompe la simmetria fra le due valli.',
    'Somma mentalmente due forme: l’onda veloce del seno e la parabola lenta. La parabola alza o abbassa la linea su cui oscillano picchi e valli.',
    'Il seno crea i battiti; l’esponenziale che contiene |x| riduce la loro ampiezza allontanandosi dal centro. Cerca tante oscillazioni strette vicino a zero, sempre più piccole ai lati.'
  ],
  FOLLE: [
    'L’argomento del seno contiene x²: lontano dal centro cambia sempre più in fretta, quindi le onde si stringono. Il denominatore con |x| attenua l’altezza ai lati.',
    'Un seno è dentro un altro seno: l’onda interna sposta continuamente la fase di quella esterna. Cerca tratti in cui i picchi si addensano e altri in cui si allargano.',
    'mod(A; P) è il resto della divisione di A per P: ogni P unità u torna a zero. Disegna prima i picchi equidistanti e la discesa tra loro. Le piccole onde sono un dettaglio.',
    'Le due esponenziali creano due picchi stretti nei punti indicati dalle parentesi. Lontano dai picchi resta soprattutto la piccola onda del seno, spostata verso il basso.',
    'Il primo pezzo è un’onda che accelera ai lati. Il rapporto aggiunto crea un picco localizzato dove la sua parentesi si annulla: immagina le due forme sovrapposte.'
  ]
};

export function explanationForSpec(spec) {
  levelFromSpec(spec);
  return explanations[spec.difficulty][spec.family];
}

export function levelFromSpec(spec) {
  if (!spec || !DIFFICULTIES.includes(spec.difficulty) || !Number.isInteger(spec.family) ||
      spec.family < 0 || spec.family >= FAMILIES_PER_DIFFICULTY ||
      !Number.isInteger(spec.seed) || spec.seed < 0 || spec.seed > 0xffffffff) throw new Error('Sfida non valida.');
  return { ...families[spec.difficulty][spec.family](choices(spec.seed)), difficulty: spec.difficulty, spec };
}

export function generateSpecs(bands, random = Math.random) {
  const pools = Object.fromEntries(DIFFICULTIES.map(difficulty => [difficulty, []]));
  const usedFormulas = new Set();
  return bands.map((difficulty, index) => {
    if (!DIFFICULTIES.includes(difficulty)) throw new Error('Difficoltà non valida.');
    const pool = pools[difficulty];
    if (!pool.length) {
      pool.push(0, 1, 2, 3, 4);
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
    }
    const family = pool.pop();
    const initialSeed = (Math.floor(random() * 4294967296) + Math.imul(index + 1, 0x9e3779b9)) >>> 0;
    for (let attempt = 0; attempt < 2048; attempt++) {
      const spec = { difficulty, family, seed: (initialSeed + Math.imul(attempt, 0x9e3779b9)) >>> 0 };
      const formula = levelFromSpec(spec).formula;
      if (!usedFormulas.has(formula)) {
        usedFormulas.add(formula);
        return spec;
      }
    }
    throw new Error('Non ci sono abbastanza varianti per questa partita.');
  });
}
