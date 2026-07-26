function addFullscreenWatermark() {
  const overlay = document.createElement('div');
  overlay.className = 'watermark-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 42; i += 1) {
    const item = document.createElement('span');
    item.textContent = '@龙族物语交流Q群 140614920';
    overlay.append(item);
  }
  document.body.append(overlay);
}

const all = window.DRAGONS;
const q = id => document.getElementById(id);
const grid = q('grid');
const storageKey = 'dragon-story-offline-favourites-v1';
let favourites = new Set();
let onlyFavourites = false;

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
    if (!elementIcons.has(element) && dragon.elementImages?.[index]) {
      elementIcons.set(element, dragon.elementImages[index]);
    }
  });
}

function iconFor(element) {
  const path = elementIcons.get(element);
  if (!path) return null;
  const image = document.createElement('img');
  image.src = path;
  image.alt = '';
  return image;
}

function refreshFavouritesToggle() {
  const button = q('favorites-toggle');
  button.classList.toggle('active', onlyFavourites);
  button.setAttribute('aria-pressed', String(onlyFavourites));
  button.textContent = onlyFavourites
    ? `★ 仅看收藏（${favourites.size}）`
    : `☆ 收藏（${favourites.size}）`;
}

function refreshElementPicker() {
  const selected = q('element').value;
  const toggle = q('element-toggle');
  toggle.replaceChildren();
  const icon = iconFor(selected);
  if (icon) toggle.append(icon);
  const label = document.createElement('span');
  label.textContent = selected || '所有属性';
  toggle.append(label);
  const arrow = document.createElement('span');
  arrow.textContent = ' ▾';
  toggle.append(arrow);
  q('element-options').querySelectorAll('.element-choice').forEach(button => {
    button.classList.toggle('selected', button.dataset.value === selected);
  });
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
      draw();
    });
    panel.append(button);
  };
  addChoice('', '所有属性');
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
  button.textContent = active ? '★ 已收藏' : '☆ 收藏';
  button.addEventListener('click', () => {
    if (favourites.has(key)) favourites.delete(key);
    else favourites.add(key);
    saveFavourites();
    refreshFavouritesToggle();
    draw();
  });
  return button;
}

function draw() {
  const term = q('search').value.trim().toLowerCase();
  const rarity = q('rarity').value;
  const element = q('element').value;
  const list = all.filter(dragon =>
    (!onlyFavourites || favourites.has(dragonKey(dragon))) &&
    (!rarity || dragon.rarity === rarity) &&
    (!element || dragon.elements.includes(element)) &&
    (!term || [dragon.name, dragon.title, dragon.rarity, ...dragon.elements].join(' ').toLowerCase().includes(term))
  );
  q('summary').textContent = `共 ${all.length.toLocaleString()} 条龙；当前显示 ${list.length.toLocaleString()} 条。`;
  grid.replaceChildren(...list.map(dragon => {
    const node = q('card').content.cloneNode(true);
    node.querySelector('h2').textContent = dragon.name;
    const origin = node.querySelector('.origin');
    if (dragon.source) origin.href = dragon.source;
    else origin.hidden = true;
    origin.before(favouriteButton(dragon));
    const rarityNode = node.querySelector('.rarity');
    rarityNode.textContent = dragon.rarity;
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
      if (dragon.forms?.[stage]) {
        const image = document.createElement('img');
        image.src = dragon.forms[stage];
        image.alt = `${dragon.name} - ${stage}`;
        image.loading = 'lazy';
        image.decoding = 'async';
        figure.append(image);
      } else {
        const missing = document.createElement('div');
        missing.className = 'missing';
        missing.textContent = '无图片';
        figure.append(missing);
      }
      const caption = document.createElement('figcaption');
      caption.textContent = stage;
      figure.append(caption);
      forms.append(figure);
    }
    return node;
  }));
}

buildElementPicker();
addFullscreenWatermark();
q('search').addEventListener('input', draw);
q('rarity').addEventListener('change', draw);
q('element').addEventListener('change', () => {
  refreshElementPicker();
  draw();
});
q('favorites-toggle').addEventListener('click', () => {
  onlyFavourites = !onlyFavourites;
  refreshFavouritesToggle();
  draw();
});
refreshFavouritesToggle();
draw();
