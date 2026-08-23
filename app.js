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
const languageStorageKey = 'dragon-story-language-v2';
let favourites = new Set();
let onlyFavourites = false;
let catalogueMode = 'all';
let language = 'en';
const selectedRarities = new Set();
const selectedElements = new Set();
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
  const savedLanguage = localStorage.getItem(languageStorageKey);
  language = savedLanguage === 'zh' || savedLanguage === 'en' ? savedLanguage : 'en';
} catch {}

const dragonKey = dragon => String(dragon.gameId ?? dragon.title ?? dragon.name);
const saveFavourites = () => localStorage.setItem(storageKey, JSON.stringify([...favourites]));
const nameFor = dragon => language === 'zh' ? dragon.nameZh : dragon.name;
const rarityFor = dragon => language === 'zh' ? dragon.rarityZh : dragon.rarity;
const isChinese = () => language === 'zh';

const rarityValues = [...new Set(all.map(dragon => dragon.rarity))].sort();
const elementValues = [...new Set(all.flatMap(dragon => dragon.elements))].sort();

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
  button.textContent = onlyFavourites ? `\u2605 \u4ec5\u770b\u6536\u85cf(${favourites.size})` : `\u2606 \u6536\u85cf(${favourites.size})`;
}

function rarityLabel(value) {
  if (!value) return '\u6240\u6709\u7a00\u6709\u5ea6';
  const dragon = all.find(item => item.rarity === value);
  return isChinese() ? dragon?.rarityZh || value : value;
}

function refreshLanguageUi() {
  const chinese = isChinese();
  q('lang-zh').classList.toggle('active', chinese);
  q('lang-en').classList.toggle('active', !chinese);
  q('lang-zh').setAttribute('aria-pressed', String(chinese));
  q('lang-en').setAttribute('aria-pressed', String(!chinese));
  q('machine-translation-note').hidden = !chinese;
  q('search').placeholder = '\u641c\u7d22\u4e2d\u82f1\u6587\u9f99\u540d\u3001\u5c5e\u6027\u6216\u7a00\u6709\u5ea6\u2026';
  q('all-catalog-toggle').textContent = '\u5168\u90e8\u56fe\u9274';
  q('ticket-catalog-toggle').textContent = 'Ticket Temple \u00b7 105';
  backToTop.textContent = '\u2191 \u8fd4\u56de\u9876\u90e8';
  backToTop.setAttribute('aria-label', '\u8fd4\u56de\u9876\u90e8');
  refreshFavouritesToggle();
  refreshRarityPicker();
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

function refreshRarityPicker() {
  const toggle = q('rarity-toggle');
  const label = document.createElement('span');
  if (selectedRarities.size === 0) label.textContent = '\u6240\u6709\u7a00\u6709\u5ea6';
  else if (selectedRarities.size === 1) label.textContent = rarityLabel([...selectedRarities][0]);
  else label.textContent = `\u5df2\u9009 ${selectedRarities.size} \u4e2a\u7a00\u6709\u5ea6`;
  const arrow = document.createElement('span');
  arrow.textContent = ' \u25be';
  toggle.replaceChildren(label, arrow);
  toggle.title = selectedRarities.size ? [...selectedRarities].map(rarityLabel).join('\u3001') : '\u53ef\u591a\u9009';
  q('rarity-options').querySelectorAll('.rarity-choice').forEach(button => {
    const selected = button.dataset.value ? selectedRarities.has(button.dataset.value) : selectedRarities.size === 0;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
    button.querySelector('span').textContent = rarityLabel(button.dataset.value);
  });
}

function refreshElementPicker() {
  const toggle = q('element-toggle');
  toggle.replaceChildren();
  [...selectedElements].slice(0, 3).forEach(value => {
    const icon = iconFor(value);
    if (icon) toggle.append(icon);
  });
  const label = document.createElement('span');
  if (selectedElements.size === 0) label.textContent = '\u6240\u6709\u5c5e\u6027';
  else if (selectedElements.size === 1) label.textContent = [...selectedElements][0];
  else label.textContent = `\u5df2\u9009 ${selectedElements.size} \u4e2a\u5c5e\u6027`;
  toggle.append(label);
  const arrow = document.createElement('span');
  arrow.textContent = ' \u25be';
  toggle.append(arrow);
  toggle.title = selectedElements.size ? [...selectedElements].join('\u3001') : '\u53ef\u591a\u9009';
  q('element-options').querySelectorAll('.element-choice').forEach(button => {
    const selected = button.dataset.value ? selectedElements.has(button.dataset.value) : selectedElements.size === 0;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
}

function resetAndDraw() {
  visibleCount = PAGE_SIZE;
  draw();
}

function setPickerOpen(panelId, toggleId, open) {
  q(panelId).hidden = !open;
  q(toggleId).setAttribute('aria-expanded', String(open));
}

function buildRarityPicker() {
  const panel = q('rarity-options');
  const addChoice = value => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'filter-choice rarity-choice';
    button.dataset.value = value;
    const text = document.createElement('span');
    text.textContent = rarityLabel(value);
    button.append(text);
    button.addEventListener('click', () => {
      if (!value) selectedRarities.clear();
      else if (selectedRarities.has(value)) selectedRarities.delete(value);
      else selectedRarities.add(value);
      refreshRarityPicker();
      resetAndDraw();
    });
    panel.append(button);
  };
  addChoice('');
  rarityValues.forEach(addChoice);
  q('rarity-toggle').addEventListener('click', () => {
    const open = panel.hidden;
    setPickerOpen('element-options', 'element-toggle', false);
    setPickerOpen('rarity-options', 'rarity-toggle', open);
  });
  refreshRarityPicker();
}

function buildElementPicker() {
  const panel = q('element-options');
  const addChoice = (value, label) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'filter-choice element-choice';
    button.dataset.value = value;
    const icon = iconFor(value);
    if (icon) button.append(icon);
    const text = document.createElement('span');
    text.textContent = label;
    button.append(text);
    button.addEventListener('click', () => {
      if (!value) selectedElements.clear();
      else if (selectedElements.has(value)) selectedElements.delete(value);
      else selectedElements.add(value);
      refreshElementPicker();
      resetAndDraw();
    });
    panel.append(button);
  };
  addChoice('', '\u6240\u6709\u5c5e\u6027');
  elementValues.forEach(value => addChoice(value, value));
  q('element-toggle').addEventListener('click', () => {
    const open = panel.hidden;
    setPickerOpen('rarity-options', 'rarity-toggle', false);
    setPickerOpen('element-options', 'element-toggle', open);
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
  button.textContent = active ? '\u2605 \u5df2\u6536\u85cf' : '\u2606 \u6536\u85cf';
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
  return catalogue.filter(dragon =>
    (!onlyFavourites || favourites.has(dragonKey(dragon))) &&
    (selectedRarities.size === 0 || selectedRarities.has(dragon.rarity)) &&
    [...selectedElements].every(element => dragon.elements.includes(element)) &&
    (!term || [dragon.name, dragon.nameZh, dragon.title, dragon.rarity, dragon.rarityZh, ...dragon.elements].join(' ').toLowerCase().includes(term))
  );
}

function cardFor(dragon) {
  const node = q('card').content.cloneNode(true);
  const ticketNumber = catalogueMode === 'ticket' ? ticketDragons.indexOf(dragon) + 1 : 0;
  node.querySelector('h2').textContent = ticketNumber ? `${ticketNumber}. ${nameFor(dragon)}` : nameFor(dragon);
  const origin = node.querySelector('.origin');
  origin.textContent = 'Fandom \u9875\u9762 \u2197';
  if (dragon.source) origin.href = dragon.source;
  else origin.hidden = true;
  origin.before(favouriteButton(dragon));
  const factLabels = node.querySelectorAll('.facts span');
  factLabels[0].textContent = '\u5c5e\u6027';
  factLabels[1].textContent = '\u7a00\u6709\u5ea6';
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
      missing.textContent = '\u65e0\u56fe\u7247';
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
    : `\u5168\u90e8\u56fe\u9274 \u00b7 ${catalogueCount}`;
  resetImageObserver();
  q('summary').textContent = `${catalogueLabel}\uff1b\u5f53\u524d\u7b5b\u9009 ${list.length.toLocaleString()} \u6761\uff0c\u5df2\u663e\u793a ${shown.length.toLocaleString()} \u6761\u3002`;
  const fragment = document.createDocumentFragment();
  shown.forEach(dragon => fragment.append(cardFor(dragon)));
  grid.replaceChildren(fragment);
  const remaining = list.length - shown.length;
  loadMore.hidden = remaining <= 0;
  loadMore.style.display = remaining > 0 ? 'block' : 'none';
  if (remaining > 0) loadMore.textContent = `\u52a0\u8f7d\u66f4\u591a\uff08\u8fd8\u6709 ${remaining.toLocaleString()} \u6761\uff09`;
}

let searchTimer;
q('search').addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(resetAndDraw, 120);
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

document.addEventListener('click', event => {
  if (!event.target.closest('.filter-picker')) {
    setPickerOpen('rarity-options', 'rarity-toggle', false);
    setPickerOpen('element-options', 'element-toggle', false);
  }
});
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  setPickerOpen('rarity-options', 'rarity-toggle', false);
  setPickerOpen('element-options', 'element-toggle', false);
});

buildRarityPicker();
buildElementPicker();
addFullscreenWatermark();
document.querySelectorAll('.watermark-overlay span').forEach(item => {
  item.style.opacity = window.innerWidth <= 650 ? '.15' : '.16';
});
refreshFavouritesToggle();
refreshCatalogueTabs();
refreshLanguageUi();
draw();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js?v=20260824-multi-filter1', { scope: './' }).catch(() => {}));
}
