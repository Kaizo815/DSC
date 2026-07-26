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
const q = id => document.getElementById(id);
const grid = q('grid');
const PAGE_SIZE = 60;
const storageKey = 'dragon-story-offline-favourites-v1';
let favourites = new Set();
let onlyFavourites = false;
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

const dragonKey = dragon => String(dragon.gameId ?? dragon.title ?? dragon.name);
const saveFavourites = () => localStorage.setItem(storageKey, JSON.stringify([...favourites]));

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
    ? `\u2605 \u4ec5\u770b\u6536\u85cf(${favourites.size})`
    : `\u2606 \u6536\u85cf(${favourites.size})`;
}

function refreshElementPicker() {
  const selected = q('element').value;
  const toggle = q('element-toggle');
  toggle.replaceChildren();
  const icon = iconFor(selected);
  if (icon) toggle.append(icon);
  const label = document.createElement('span');
  label.textContent = selected || '\u6240\u6709\u5c5e\u6027';
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
  addChoice('', '\u6240\u6709\u5c5e\u6027');
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
  const term = q('search').value.trim().toLowerCase();
  const rarity = q('rarity').value;
  const element = q('element').value;
  return all.filter(dragon =>
    (!onlyFavourites || favourites.has(dragonKey(dragon))) &&
    (!rarity || dragon.rarity === rarity) &&
    (!element || dragon.elements.includes(element)) &&
    (!term || [dragon.name, dragon.title, dragon.rarity, ...dragon.elements].join(' ').toLowerCase().includes(term))
  );
}

function cardFor(dragon) {
  const node = q('card').content.cloneNode(true);
  node.querySelector('h2').textContent = dragon.name;
  const origin = node.querySelector('.origin');
  if (dragon.source) origin.href = dragon.source;
  else origin.hidden = true;
  origin.before(favouriteButton(dragon));
  node.querySelector('.rarity').textContent = dragon.rarity;
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
    if (dragon.forms?.[stage]) figure.append(deferredImage(dragon.forms[stage], `${dragon.name} - ${stage}`));
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
  loadMore.scrollIntoView({ block: 'nearest' });
});
grid.after(loadMore);

function draw() {
  const list = matchingDragons();
  const shown = list.slice(0, visibleCount);
  resetImageObserver();
  q('summary').textContent = `\u5171 ${all.length.toLocaleString()} \u6761\u9f99\uff1b\u5f53\u524d\u7b5b\u9009 ${list.length.toLocaleString()} \u6761\uff0c\u5df2\u663e\u793a ${shown.length.toLocaleString()} \u6761\u3002`;
  const fragment = document.createDocumentFragment();
  shown.forEach(dragon => fragment.append(cardFor(dragon)));
  grid.replaceChildren(fragment);
  const remaining = list.length - shown.length;
  loadMore.hidden = remaining <= 0;
  if (remaining > 0) loadMore.textContent = `\u52a0\u8f7d\u66f4\u591a\uff08\u8fd8\u6709 ${remaining.toLocaleString()} \u6761\uff09`;
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

buildElementPicker();
addFullscreenWatermark();
refreshFavouritesToggle();
draw();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js?v=20260726-fast1', { scope: './' }).catch(() => {}));
}
