function addFullscreenWatermark() {
  const overlay = document.createElement('div');
  overlay.className = 'watermark-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 42; i += 1) {
    const item = document.createElement('span');
    item.textContent = '@\u9f99\u65cf\u7269\u8bed\u4ea4\u6d41Q\u7fa4 140614920';
    overlay.append(item);
  }
  document.body.append(overlay);
}

const all = window.DRAGONS;
const ticketNames = window.TICKET_DRAGON_NAMES || [];
const dragonsByExactName = new Map(all.map(dragon => [dragon.name, dragon]));
const ticketDragons = ticketNames.map(name => dragonsByExactName.get(name)).filter(Boolean);
if (ticketDragons.length !== ticketNames.length) console.error('Ticket Temple dragon mapping is incomplete.');
const q = id => document.getElementById(id);
const grid = q('grid');
const PAGE_SIZE = 60;
const storageKey = 'dragon-story-offline-favourites-v1';
const languageStorageKey = 'dragon-story-language-v1';
let favourites = new Set();
let onlyFavourites = false;
let catalogueMode = 'all';
let language = 'zh';
let visibleCount = PAGE_SIZE;
let imageObserver = null;

const eyebrow = document.querySelector('.eyebrow');
if (eyebrow) {
  const notice = document.createElement('span');
  notice.textContent = ' \u00b7 \u4ec5\u4f9b\u67e5\u9605 \u00b7 \u7981\u6b62\u5546\u4e1a\u7528\u9014';
  notice.style.cssText = 'font-weight:700;letter-spacing:.45px;opacity:1';
  eyebrow.append(notice);
}

try {
  favourites = new Set(JSON.parse(localStorage.getItem(storageKey) || '[]'));
} catch {
  favourites = new Set();
}
try {
  language = localStorage.getItem(languageStorageKey) === 'en' ? 'en' : 'zh';
} catch {}

const dragonKey = dragon => String(dragon.gameId ?? dragon.title ?? dragon.name);
const saveFavourites = () => localStorage.setItem(storageKey, JSON.stringify([...favourites]));
const nameFor = dragon => language === 'zh' ? dragon.nameZh : dragon.name;
const rarityFor = dragon => language === 'zh' ? dragon.rarityZh : dragon.rarity;
const isChinese = () => language === 'zh';

function options(id, values) {
  for (const value of [...values].sort()) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    q(id).append(option);
  }
}

options('rarity', new Set(all.map(dragon => dragon.rarity)));
const elementValues = [...new Set(all.flatMap(dragon => dragon.elements))].sort();
options('element', elementValues);

const elementIcons = new Map();
for (const dragon of all) {
  dragon.elements.forEach((element, index) => {
    if (!elementIcons.has(element) && dragon.elementImages?.[index]) elementIcons.set(element, dragon.elementImages[index]);
  });
}

function iconFor(element) {
  const path = elementIcons.get(element);
  if (!path) return null;
  const image = document.createElement('img');
  image.src = path;
  image.alt = '';
  image.loading = 'lazy';
  return image;
}

function refreshFavouritesToggle() {
  const button = q('favorites-toggle');
  button.classList.toggle('active', onlyFavourites);
  button.setAttribute('aria-pressed', String(onlyFavourites));
  button.textContent = onlyFavourites
    ? (isChinese() ? `\u2605 \u4ec5\u770b\u6536\u85cf(${favourites.size})` : `\u2605 Favorites only (${favourites.size})`)
    : (isChinese() ? `\u2606 \u6536\u85cf(${favourites.size})` : `\u2606 Favorites (${favourites.size})`);
}

function refreshLanguageUi() {
  const chinese = isChinese();
  q('lang-zh').classList.toggle('active', chinese);
  q('lang-en').classList.toggle('active', !chinese);
  q('lang-zh').setAttribute('aria-pressed', String(chinese));
  q('lang-en').setAttribute('aria-pressed', String(!chinese));
  q('machine-translation-note').hidden = !chinese;
  q('search').placeholder = chinese ? '\u641c\u7d22\u4e2d\u82f1\u6587\u9f99\u540d\u3001\u5c5e\u6027\u6216\u7a00\u6709\u5ea6\u2026' : 'Search Chinese/English dragon names, elements, or rarity...';
  q('rarity').options[0].textContent = chinese ? '\u6240\u6709\u7a00\u6709\u5ea6' : 'All rarities';
  [...q('rarity').options].slice(1).forEach(option => {
    const dragon = all.find(item => item.rarity === option.value);
    option.textContent = chinese ? dragon?.rarityZh || option.value : option.value;
  });
  q('all-catalog-toggle').textContent = chinese ? '\u5168\u90e8\u56fe\u9274' : 'All dragons';
  q('ticket-catalog-toggle').textContent = 'Ticket Temple \u00b7 105';
  backToTop.textContent = chinese ? '\u2191 \u8fd4\u56de\u9876\u90e8' : '\u2191 Back to top';
  backToTop.setAttribute('aria-label', chinese ? '\u8fd4\u56de\u9876\u90e8' : 'Back to top');
  const allElementChoice = q('element-options').querySelector('.element-choice[data-value=""] span');
  if (allElementChoice) allElementChoice.textContent = chinese ? '\u6240\u6709\u5c5e\u6027' : 'All elements';
  refreshFavouritesToggle();
  refreshElementPicker();
}

function refreshCatalogueTabs() {
  const allButton = q('all-catalog-toggle');
  const ticketButton = q('ticket-catalog-toggle');
  const ticketActive = catalogueMode === 'ticket';
  allButton.classList.toggle('active', !ticketActive);
  ticketButton.classList.toggle('active', ticketActive);
  allButton.setAttribute('aria-pressed', String(!ticketActive));
  ticketButton.setAttribute('aria-pressed', String(ticketActive));
}

function refreshElementPicker() {
  const selected = q('element').value;
  const toggle = q('element-toggle');
  toggle.replaceChildren();
  const icon = iconFor(selected);
  if (icon) toggle.append(icon);
  const label = document.createElement('span');
  label.textContent = selected || (isChinese() ? '\u6240\u6709\u5c5e\u6027' : 'All elements');
  toggle.append(label);
  const arrow = document.createElement('span');
  arrow.textContent = ' \u25be';
  toggle.append(arrow);
  q('element-options').querySelectorAll('.element-choice').forEach(button => {
    button.classList.toggle('selected', button.dataset.value === selected);
  });
}

function resetAndDraw() {
  visibleCount = PAGE_SIZE;
  draw();
}

function buildElementPicker() {
  const panel = q('element-options');
  const addChoice = (value, label) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'element-choice';
    button.dataset.value = value;
    const icon = iconFor(value);
    if (icon) button.append(icon);
    const text = document.createElement('span');
    text.textContent = label;
    button.append(text);
    button.addEventListener('click', () => {
      q('element').value = value;
      panel.hidden = true;
      q('element-toggle').setAttribute('aria-expanded', 'false');
      refreshElementPicker();
      resetAndDraw();
    });
    panel.append(button);
  };
  addChoice('', isChinese() ? '\u6240\u6709\u5c5e\u6027' : 'All elements');
  elementValues.forEach(value => addChoice(value, value));
  q('element-toggle').addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    q('element-toggle').setAttribute('aria-expanded', String(!panel.hidden));
  });
  refreshElementPicker();
}

function favouriteButton(dragon) {
  const key = dragonKey(dragon);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'favorite';
  const active = favourites.has(key);
  button.classList.toggle('active', active);
  button.setAttribute('aria-pressed', String(active));
  button.textContent = active
    ? (isChinese() ? '\u2605 \u5df2\u6536\u85cf' : '\u2605 Saved')
    : (isChinese() ? '\u2606 \u6536\u85cf' : '\u2606 Save');
  button.addEventListener('click', () => {
    if (favourites.has(key)) favourites.delete(key);
    else favourites.add(key);
    saveFavourites();
    refreshFavouritesToggle();
    draw();
  });
  return button;
}

function resetImageObserver() {
  imageObserver?.disconnect();
  if (!('IntersectionObserver' in window)) {
    imageObserver = null;
    return;
  }
  imageObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const image = entry.target;
      image.src = image.dataset.src;
      delete image.dataset.src;
      imageObserver.unobserve(image);
    });
  }, { rootMargin: '900px 0px' });
}

function deferredImage(src, alt) {
  const image = document.createElement('img');
  image.alt = alt;
  image.loading = 'lazy';
  image.decoding = 'async';
  if (imageObserver) {
    image.dataset.src = src;
    imageObserver.observe(image);
  } else {
    image.src = src;
  }
  return image;
}

function matchingDragons() {
  const catalogue = catalogueMode === 'ticket' ? ticketDragons : all;
  const term = q('search').value.trim().toLowerCase();
  const rarity = q('rarity').value;
  const element = q('element').value;
  return catalogue.filter(dragon =>
    (!onlyFavourites || favourites.has(dragonKey(dragon))) &&
    (!rarity || dragon.rarity === rarity) &&
    (!element || dragon.elements.includes(element)) &&
    (!term || [dragon.name, dragon.nameZh, dragon.title, dragon.rarity, dragon.rarityZh, ...dragon.elements].join(' ').toLowerCase().includes(term))
  );
}

function cardFor(dragon) {
  const node = q('card').content.cloneNode(true);
  const ticketNumber = catalogueMode === 'ticket' ? ticketDragons.indexOf(dragon) + 1 : 0;
  node.querySelector('h2').textContent = ticketNumber ? `${ticketNumber}. ${nameFor(dragon)}` : nameFor(dragon);
  const origin = node.querySelector('.origin');
  origin.textContent = isChinese() ? 'Fandom \u9875\u9762 \u2197' : 'Fandom Page \u2197';
  if (dragon.source) origin.href = dragon.source;
  else origin.hidden = true;
  origin.before(favouriteButton(dragon));
  const factLabels = node.querySelectorAll('.facts span');
  factLabels[0].textContent = isChinese() ? '\u5c5e\u6027' : 'Elements';
  factLabels[1].textContent = isChinese() ? '\u7a00\u6709\u5ea6' : 'Rarity';
  node.querySelector('.rarity').textContent = rarityFor(dragon);
  const elements = node.querySelector('.elements');
  dragon.elements.forEach((name, index) => {
    const span = document.createElement('span');
    span.className = 'element';
    const icon = dragon.elementImages?.[index];
    if (icon) {
      const image = document.createElement('img');
      image.src = icon;
      image.alt = '';
      image.loading = 'lazy';
      span.append(image);
    }
    span.append(name);
    elements.append(span);
  });
  const forms = node.querySelector('.forms');
  for (const stage of ['Baby', 'Juvenile', 'Adult', 'Epic']) {
    const figure = document.createElement('figure');
    figure.className = 'form';
    if (dragon.forms?.[stage]) figure.append(deferredImage(dragon.forms[stage], `${nameFor(dragon)} - ${stage}`));
    else {
      const missing = document.createElement('div');
      missing.className = 'missing';
      missing.textContent = isChinese() ? '\u65e0\u56fe\u7247' : 'No image';
      figure.append(missing);
    }
    const caption = document.createElement('figcaption');
    caption.textContent = stage;
    figure.append(caption);
    forms.append(figure);
  }
  return node;
}

const loadMore = document.createElement('button');
loadMore.type = 'button';
loadMore.className = 'load-more';
loadMore.style.cssText = 'display:block;margin:4px auto 8px;padding:12px 20px;border:1px solid #b88acb;border-radius:8px;background:#f0e7f5;color:#673e7a;font:inherit;font-weight:700;cursor:pointer';
loadMore.addEventListener('click', () => {
  visibleCount += PAGE_SIZE;
  draw();
});
grid.after(loadMore);

const backToTop = document.createElement('button');
backToTop.type = 'button';
backToTop.textContent = '\u2191 \u8fd4\u56de\u9876\u90e8';
backToTop.setAttribute('aria-label', '\u8fd4\u56de\u9876\u90e8');
backToTop.hidden = true;
backToTop.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:10000;padding:10px 13px;border:1px solid #b88acb;border-radius:999px;background:#fff;color:#673e7a;font:inherit;font-size:13px;font-weight:700;box-shadow:0 4px 14px #1720332b;cursor:pointer';
backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
window.addEventListener('scroll', () => { backToTop.hidden = window.scrollY < 420; }, { passive: true });
document.body.append(backToTop);

function draw() {
  const list = matchingDragons();
  const shown = list.slice(0, visibleCount);
  const catalogueCount = catalogueMode === 'ticket' ? ticketDragons.length : all.length;
  const catalogueLabel = catalogueMode === 'ticket'
    ? `Ticket Temple \u00b7 ${catalogueCount}`
    : (isChinese() ? `\u5168\u90e8\u56fe\u9274 \u00b7 ${catalogueCount}` : `All dragons \u00b7 ${catalogueCount}`);
  resetImageObserver();
  q('summary').textContent = isChinese()
    ? `${catalogueLabel}\uff1b\u5f53\u524d\u7b5b\u9009 ${list.length.toLocaleString()} \u6761\uff0c\u5df2\u663e\u793a ${shown.length.toLocaleString()} \u6761\u3002`
    : `${catalogueLabel}; ${list.length.toLocaleString()} matched, ${shown.length.toLocaleString()} shown.`;
  const fragment = document.createDocumentFragment();
  shown.forEach(dragon => fragment.append(cardFor(dragon)));
  grid.replaceChildren(fragment);
  const remaining = list.length - shown.length;
  loadMore.hidden = remaining <= 0;
  loadMore.style.display = remaining > 0 ? 'block' : 'none';
  if (remaining > 0) loadMore.textContent = isChinese()
    ? `\u52a0\u8f7d\u66f4\u591a\uff08\u8fd8\u6709 ${remaining.toLocaleString()} \u6761\uff09`
    : `Load more (${remaining.toLocaleString()} remaining)`;
}

let searchTimer;
q('search').addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(resetAndDraw, 120);
});
q('rarity').addEventListener('change', resetAndDraw);
q('element').addEventListener('change', () => {
  refreshElementPicker();
  resetAndDraw();
});
q('favorites-toggle').addEventListener('click', () => {
  onlyFavourites = !onlyFavourites;
  refreshFavouritesToggle();
  resetAndDraw();
});
q('all-catalog-toggle').addEventListener('click', () => {
  catalogueMode = 'all';
  refreshCatalogueTabs();
  resetAndDraw();
});
q('ticket-catalog-toggle').addEventListener('click', () => {
  catalogueMode = 'ticket';
  refreshCatalogueTabs();
  resetAndDraw();
});
q('lang-zh').addEventListener('click', () => {
  language = 'zh';
  localStorage.setItem(languageStorageKey, language);
  refreshLanguageUi();
  draw();
});
q('lang-en').addEventListener('click', () => {
  language = 'en';
  localStorage.setItem(languageStorageKey, language);
  refreshLanguageUi();
  draw();
});

buildElementPicker();
addFullscreenWatermark();
document.querySelectorAll('.watermark-overlay span').forEach(item => {
  item.style.opacity = window.innerWidth <= 650 ? '.18' : '.19';
});
refreshFavouritesToggle();
refreshCatalogueTabs();
refreshLanguageUi();
draw();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js?v=20260727-polish3', { scope: './' }).catch(() => {}));
}
