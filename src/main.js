import './style.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';
import { Cinema } from './gl/scene.js';

gsap.registerPlugin(ScrollTrigger, SplitText);
if (import.meta.env.DEV) window.__st = ScrollTrigger;

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = window.matchMedia('(max-width: 900px), (pointer: coarse)').matches;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/* ---------------- Contactos ---------------- */
const PHONE = '244933050192';
const wa = (text) => `https://wa.me/${PHONE}?text=${encodeURIComponent(text)}`;
let occasion = null;
function refreshLinks() {
  $$('[data-wa="reserva"]').forEach((a) => {
    a.href = wa('Olá! Quero reservar uma mesa no Moan Night Club.');
    a.target = '_blank'; a.rel = 'noopener';
  });
  $$('[data-wa="evento"]').forEach((a) => {
    a.href = wa(occasion
      ? `Olá! Quero alugar o Moan Night Club para ${occasion}. Podem enviar-me um orçamento?`
      : 'Olá! Quero alugar o Moan Night Club para uma festa. Podem enviar-me um orçamento?');
    a.target = '_blank'; a.rel = 'noopener';
  });
}
refreshLinks();
$$('#occasions button').forEach((b) => {
  b.setAttribute('aria-pressed', 'false');
  b.addEventListener('click', () => {
    const on = b.getAttribute('aria-pressed') !== 'true';
    $$('#occasions button').forEach((x) => x.setAttribute('aria-pressed', 'false'));
    b.setAttribute('aria-pressed', String(on));
    occasion = on ? b.dataset.occ : null;
    refreshLinks();
  });
});
$('#year').textContent = new Date().getFullYear();

/* ---------------- Esta noite (hora de Luanda) ---------------- */
const NIGHTS = { 4: 'Noite de Semba', 5: 'Noite de Pagode', 6: 'Festa Latina', 0: 'Matinée da Ressaca' };
const DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
(() => {
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Luanda', weekday: 'short' }).format(new Date());
  const today = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(wd);
  const box = $('#tonight');
  if (today < 0) return;
  if (NIGHTS[today] !== undefined) {
    $('.hero__tonight-text', box).textContent = `Hoje: ${NIGHTS[today]}`;
    const card = $(`.night[data-day="${today}"] .night__name`);
    if (card) card.insertAdjacentHTML('beforeend', '<span class="night__today"><span class="live"></span>Hoje</span>');
  } else {
    $('.hero__tonight-text', box).textContent = `Próxima noite: ${DAYS[4]}, ${NIGHTS[4]}`;
    $('.live', box).remove();
  }
  box.hidden = false;
})();

/* ---------------- Menu ---------------- */
const menu = $('#menu');
const menuBtn = $('.nav__menu');
function setMenu(open) {
  menuBtn.setAttribute('aria-expanded', String(open));
  if (open) {
    menu.hidden = false;
    requestAnimationFrame(() => menu.classList.add('is-open'));
    lenis?.stop();
  } else {
    menu.classList.remove('is-open');
    setTimeout(() => { if (!menu.classList.contains('is-open')) menu.hidden = true; }, 600);
    lenis?.start();
  }
}
menuBtn.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
$$('a', menu).forEach((a) => a.addEventListener('click', () => setMenu(false)));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) setMenu(false); });

/* ---------------- Scroll suave ---------------- */
let lenis = null;
if (!reduced) {
  lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9 });
  lenis.on('scroll', ScrollTrigger.update);
  $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    e.preventDefault();
    lenis.scrollTo(id === '#topo' ? 0 : id, { duration: 1.6 });
  }));
}

/* ---------------- WebGL ---------------- */
const TEX = {
  fachada: '/img/fachada-noite.webp',
  salao: '/img/salao.webp',
  cubana: '/img/noite-cubana.webp',
  rua: '/img/fachada-rua.webp',
};
let cinema = null;
try {
  cinema = new Cinema($('#gl'), { mobile });
} catch (err) {
  console.warn('WebGL indisponível, a usar fundo estático.', err);
}
const ready = cinema
  ? cinema.load(TEX).then(() => cinema.setShot('fachada', 'salao')).catch((e) => { console.warn(e); cinema = null; })
  : Promise.resolve();

function fallbackBackgrounds() {
  document.body.classList.add('no-gl');
  $('#gl').style.display = 'none';
  const map = [['.hero', 'fachada'], ['.enter', 'salao'], ['.cuba', 'cubana'], ['.events', 'salao'], ['.place', 'rua']];
  map.forEach(([sel, k]) => {
    const el = $(sel);
    el.style.background = `linear-gradient(rgba(11,7,8,.55), rgba(11,7,8,.75)), url(${TEX[k].replace('.webp', '.jpg')}) center/cover`;
  });
}

/* ---------------- Cenas ligadas ao scroll ---------------- */
const DOOR = { x: 0.875, y: 0.44 }; // porta da fachada, em coordenadas da imagem
const sceneState = { hero: 0, transitions: [] };

function buildScroll() {
  // Herói: travelling até à porta e passagem para o salão (um só pin)
  const heroTl = gsap.timeline({
    scrollTrigger: {
      trigger: '.hero', start: 'top top', end: () => `+=${window.innerHeight * (mobile ? 1.1 : 1.5)}`,
      pin: true, scrub: true,
      onUpdate: (st) => { sceneState.hero = st.progress; },
    },
  });
  if (!reduced) {
    heroTl.to('.hero__inner', { scale: 0.86, yPercent: -8, opacity: 0, filter: 'blur(14px)', ease: 'none', duration: 0.45 }, 0)
      .to('.hero__tonight', { opacity: 0, ease: 'none', duration: 0.3 }, 0)
      .to('.hero__scrim', { opacity: 0, ease: 'none', duration: 0.4 }, 0)
      .to({}, { duration: 0.55 });
  }

  // Entra: palavra a palavra
  const enter = new SplitText('.enter__line', { type: 'words', wordsClass: 'word' });
  if (!reduced) {
    gsap.to(enter.words, {
      opacity: 1, stagger: 0.08, ease: 'none',
      scrollTrigger: { trigger: '.enter', start: 'top 70%', end: 'bottom 75%', scrub: true },
    });
  }

  // A semana: travelling horizontal
  const track = $('.week__track');
  const nights = $$('.night');
  const dist = () => track.scrollWidth - window.innerWidth + parseFloat(getComputedStyle(track).paddingLeft);
  gsap.to(track, {
    x: () => -dist(), ease: 'none',
    scrollTrigger: {
      trigger: '.week', pin: '.week__pin', start: 'top top', end: () => `+=${dist() * 1.15}`,
      scrub: reduced ? true : 0.8, invalidateOnRefresh: true,
      onUpdate: (st) => {
        $('.week__progress span').style.transform = `scaleX(${st.progress})`;
        const i = clamp(Math.round(st.progress * (nights.length - 1)), 0, nights.length - 1);
        nights.forEach((n, j) => n.classList.toggle('is-active', j === i));
      },
    },
  });
  nights[0].classList.add('is-active');

  // Cortes entre planos
  let prev = 'salao';
  $$('[data-scene]').forEach((el) => {
    const tr = { from: prev, to: el.dataset.scene, p: 0 };
    sceneState.transitions.push(tr);
    prev = tr.to;
    ScrollTrigger.create({
      trigger: el, start: 'top 95%', end: 'top 25%', scrub: true,
      onUpdate: (st) => { tr.p = st.progress; },
    });
  });

  // Escurecimento por secção (legibilidade)
  $$('[data-dim]').forEach((el) => {
    ScrollTrigger.create({
      trigger: el, start: 'top 55%', end: 'bottom 55%',
      onToggle: (st) => { if (st.isActive && cinema) cinema.target.dim = parseFloat(el.dataset.dim); },
    });
  });

  // Títulos em máscara
  $$('.line').forEach((l) => { l.innerHTML = `<span>${l.innerHTML}</span>`; });
  if (!reduced) {
    $$('.cuba__title, .events__title, .place__title').forEach((h) => {
      gsap.from($$('.line > span', h), {
        yPercent: 110, duration: 1.3, stagger: 0.12, ease: 'expo.out',
        scrollTrigger: { trigger: h, start: 'top 80%' },
      });
    });
    $$('[data-split]:not(.enter__line), .events__text, .place__text').forEach((p) => {
      const s = new SplitText(p, { type: 'lines', mask: 'lines' });
      gsap.from(s.lines, {
        yPercent: 100, duration: 1.1, stagger: 0.08, ease: 'expo.out',
        scrollTrigger: { trigger: p, start: 'top 85%' },
      });
    });
    $$('.cuba__list li, .events__list li, .events__cta, .place__actions .btn').forEach((el) => {
      gsap.from(el, { opacity: 0, y: 16, duration: 0.9, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 92%' } });
    });

    // Ofertas: entram de lado e derivam com o scroll
    $$('.offer').forEach((o, i) => {
      gsap.from(o, {
        clipPath: 'inset(0 0 100% 0)', y: 40, duration: 1.2, ease: 'expo.out',
        scrollTrigger: { trigger: o, start: 'top 88%' },
      });
      gsap.fromTo($('.offer__big', o), { xPercent: i % 2 ? 6 : -6 }, {
        xPercent: i % 2 ? -4 : 4, ease: 'none',
        scrollTrigger: { trigger: o, start: 'top bottom', end: 'bottom top', scrub: true },
      });
    });

    gsap.from('.foot__word', {
      yPercent: 45, opacity: 0.2, ease: 'none',
      scrollTrigger: { trigger: '.foot', start: 'top bottom', end: 'bottom bottom', scrub: true },
    });
  }

  // Navegação: some ao descer, volta ao subir
  const nav = $('#nav');
  ScrollTrigger.create({
    start: 80, end: 'max',
    onUpdate: (st) => {
      nav.classList.toggle('is-solid', st.scroll() > 80);
      nav.classList.toggle('is-hidden', st.direction === 1 && st.scroll() > window.innerHeight * 1.2 && menu.hidden);
    },
  });
}

function applyScene() {
  if (!cinema) return;
  const p = sceneState.hero;
  if (p < 0.999) {
    cinema.setShot('fachada', 'salao');
    cinema.u.uFocus.value.set(DOOR.x, 1 - DOOR.y);
    cinema.u.uZoom.value = reduced ? 0 : Math.pow(smooth(0, 1, p), 1.6) * 2.6;
    cinema.u.uMix.value = smooth(0.42, 0.95, p);
    cinema.target.dim = 0.12 + smooth(0.0, 0.5, p) * 0.15;
    return;
  }
  cinema.u.uZoom.value = 0;
  let cur = 'salao';
  let active = null;
  for (const tr of sceneState.transitions) {
    if (tr.p >= 1) cur = tr.to;
    else { if (tr.p > 0) active = tr; break; }
  }
  if (active) { cinema.setShot(active.from, active.to); cinema.u.uMix.value = active.p; }
  else { cinema.setShot(cur, cur); cinema.u.uMix.value = 0; }
}

/* ---------------- Ponteiro ---------------- */
window.addEventListener('pointermove', (e) => {
  if (!cinema) return;
  cinema.target.mouse.set(e.clientX / window.innerWidth, 1 - e.clientY / window.innerHeight);
}, { passive: true });
window.addEventListener('pointerdown', (e) => {
  if (!cinema || reduced) return;
  cinema.shock(e.clientX / window.innerWidth, 1 - e.clientY / window.innerHeight);
}, { passive: true });

/* ---------------- Loop ---------------- */
let last = performance.now();
gsap.ticker.add((t) => {
  const now = performance.now();
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  lenis?.raf(now);
  if (cinema) {
    cinema.target.vel = lenis ? clamp(lenis.velocity / 40, -1, 1) : 0;
    applyScene();
    cinema.tick(t, dt);
  }
});
gsap.ticker.lagSmoothing(0);
window.addEventListener('resize', () => { cinema?.resize(); });

/* ---------------- Abertura ---------------- */
function heroIn() {
  const word = new SplitText('.hero__word', { type: 'chars', mask: 'chars' });
  return gsap.timeline()
    .from('.hero__crown', { yPercent: -60, opacity: 0, duration: 1.2, ease: 'expo.out' }, 0)
    .from(word.chars, { yPercent: 105, duration: 1.4, stagger: 0.07, ease: 'expo.out' }, 0.05)
    .from('.hero__club', { opacity: 0, letterSpacing: '1.2em', duration: 1.6, ease: 'expo.out' }, 0.3)
    .from('.hero__lede, .hero__actions, .hero__tonight', { opacity: 0, y: 18, duration: 1, stagger: 0.08, ease: 'expo.out' }, 0.55)
    .from('#nav', { yPercent: -100, opacity: 0, duration: 1, ease: 'expo.out' }, 0.6);
}

async function start() {
  const intro = $('#intro');
  if (reduced) {
    intro.remove();
    await ready;
    if (!cinema) fallbackBackgrounds(); else cinema.u.uReveal.value = 1;
    buildScroll();
    return;
  }

  document.body.classList.add('is-locked');
  lenis?.stop();
  window.scrollTo(0, 0);

  const lines = $$('.crown-line', intro);
  lines.forEach((l) => {
    const len = l.getTotalLength();
    l.style.strokeDasharray = len;
    l.style.strokeDashoffset = len;
  });
  const letters = $$('.intro__word span', intro);
  const flicker = [0, 1, 0.15, 1, 0.4, 0.9, 1];

  const tl = gsap.timeline();
  tl.to(lines, { strokeDashoffset: 0, duration: 1.3, ease: 'power2.inOut', stagger: 0.15 })
    .to(lines, { keyframes: { opacity: flicker }, duration: 0.5, ease: 'none' }, '-=0.1')
    .to(letters, { keyframes: { opacity: flicker }, duration: 0.55, stagger: 0.09, ease: 'none' }, '-=0.35')
    .to('.intro__sub', { opacity: 1, duration: 0.8, ease: 'power2.out' }, '-=0.2');

  const minTime = new Promise((r) => tl.eventCallback('onComplete', r));
  $('.intro__skip').addEventListener('click', () => tl.timeScale(8), { once: true });
  await Promise.all([ready, minTime]);
  if (!cinema) fallbackBackgrounds();

  buildScroll();
  const out = gsap.timeline({
    onComplete: () => {
      intro.remove();
      document.body.classList.remove('is-locked');
      lenis?.start();
      ScrollTrigger.refresh();
    },
  });
  out.to('.intro__stage', { scale: 1.9, opacity: 0, filter: 'blur(18px)', duration: 1.1, ease: 'power3.in' }, 0)
    .to('.intro__skip', { opacity: 0, duration: 0.3 }, 0)
    .to('.intro__bar--top', { scaleY: 0, duration: 1.4, ease: 'expo.inOut' }, 0.55)
    .to('.intro__bar--bottom', { scaleY: 0, duration: 1.4, ease: 'expo.inOut' }, 0.55);
  if (cinema) {
    out.fromTo(cinema.u.uReveal, { value: 0 }, { value: 1, duration: 2.2, ease: 'power2.inOut' }, 0.5);
    out.call(() => cinema.shock(0.5, 0.5), null, 0.9);
  }
  out.add(heroIn(), 1.25);
}

start();
