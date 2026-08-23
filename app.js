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
const favouriteGroupsStorageKey = 'dragon-story-favourite-groups-v1';
const languageStorageKey = 'dragon-story-language-v2';
let favourites = new Set();
let favouriteGroups = [];
let onlyFavourites = false;
let activeFavouriteGroupId = null;
let groupDialogDragon = null;
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
  const savedGroups = JSON.parse(localStorage.getItem(favouriteGroupsStorageKey) || '[]');
  if (Array.isArray(savedGroups)) {
    favouriteGroups = savedGroups
      .filter(group => group && typeof group.id === 'string' && typeof group.name === 'string' && group.name.trim())
      .map(group => ({
        id: group.id,
        name: group.name.trim().slice(0, 30),
        members: new Set((Array.isArray(group.members) ? group.members : []).map(String).filter(key => favourites.has(key))),
      }));
  }
} catch {
  favouriteGroups = [];
}
try {
  const savedLanguage = localStorage.getItem(languageStorageKey);
  language = savedLanguage === 'zh' || savedLanguage === 'en' ? savedLanguage : 'en';
} catch {}

const dragonKey = dragon => String(dragon.gameId ?? dragon.title ?? dragon.name);
const saveFavourites = () => localStorage.setItem(storageKey, JSON.stringify([...favourites]));
const saveFavouriteGroups = () => localStorage.setItem(favouriteGroupsStorageKey, JSON.stringify(
  favouriteGroups.map(group => ({ id: group.id, name: group.name, members: [...group.members] }))
));
const favouriteGroupById = id => favouriteGroups.find(group => group.id === id);
const groupsForDragonKey = key => favouriteGroups.filter(group => group.members.has(key));
const removeDragonFromFavouriteGroups = key => {
  let changed = false;
  favouriteGroups.forEach(group => {
    if (group.members.delete(key)) changed = true;
  });
  return changed;
};
const makeFavouriteGroupId = () => globalThis.crypto?.randomUUID?.() || `group-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const cleanFavouriteGroupName = value => String(value || '').trim().replace(/\s+/g, ' ').slice(0, 30);
const favouriteGroupNameError = (name, exceptId = null) => {
  if (!name) return '\u8bf7\u8f93\u5165\u5206\u7ec4\u540d\u3002';
  if (favouriteGroups.some(group => group.id !== exceptId && group.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
    return '\u5df2\u6709\u540c\u540d\u5206\u7ec4\u3002';
  }
  return '';
};
function createFavouriteGroup(rawName, memberKey = null) {
  const name = cleanFavouriteGroupName(rawName);
  const error = favouriteGroupNameError(name);
  if (error) return { group: null, error };
  const group = { id: makeFavouriteGroupId(), name, members: new Set() };
  if (memberKey) {
    group.members.add(memberKey);
    favourites.add(memberKey);
    saveFavourites();
  }
  favouriteGroups.push(group);
  saveFavouriteGroups();
  return { group, error: '' };
}
function setFavouriteGroupStatus(id, message, error = false) {
  const status = q(id);
  status.textContent = message;
  status.classList.toggle('error', error);
}
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
  const active = onlyFavourites && !activeFavouriteGroupId;
  button.classList.toggle('active', active);
  button.setAttribute('aria-pressed', String(active));
  button.textContent = active ? `\u2605 \u4ec5\u770b\u6536\u85cf(${favourites.size})` : `\u2606 \u6536\u85cf(${favourites.size})`;
}

function refreshFavouriteGroupPicker() {
  const toggle = q('favourite-group-toggle');
  const list = q('favourite-group-list');
  const activeGroup = onlyFavourites && activeFavouriteGroupId ? favouriteGroupById(activeFavouriteGroupId) : null;
  const label = document.createElement('span');
  label.textContent = activeGroup ? `${activeGroup.name}(${activeGroup.members.size})` : '\u6536\u85cf\u5206\u7ec4';
  const arrow = document.createElement('span');
  arrow.textContent = ' \u25be';
  toggle.replaceChildren(label, arrow);
  toggle.classList.toggle('active', Boolean(activeGroup));
  toggle.title = activeGroup?.name || '\u521b\u5efa\u3001\u7b5b\u9009\u548c\u7ba1\u7406\u6536\u85cf\u5206\u7ec4';
  list.replaceChildren();

  const allRow = document.createElement('div');
  allRow.className = 'favourite-group-row';
  const allButton = document.createElement('button');
  allButton.type = 'button';
  allButton.className = 'filter-choice favourite-group-choice favourite-group-all';
  const allActive = onlyFavourites && !activeFavouriteGroupId;
  allButton.classList.toggle('selected', allActive);
  allButton.setAttribute('aria-pressed', String(allActive));
  const allLabel = document.createElement('span');
  allLabel.textContent = `\u5168\u90e8\u6536\u85cf(${favourites.size})`;
  allButton.append(allLabel);
  allButton.addEventListener('click', () => {
    onlyFavourites = !allActive;
    activeFavouriteGroupId = null;
    setPickerOpen('favourite-group-options', 'favourite-group-toggle', false);
    refreshFavouritesToggle();
    refreshFavouriteGroupPicker();
    resetAndDraw();
  });
  allRow.append(allButton);
  list.append(allRow);

  if (favouriteGroups.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'favourite-group-empty';
    empty.textContent = '\u8fd8\u6ca1\u6709\u5206\u7ec4\uff0c\u53ef\u5728\u4e0b\u65b9\u65b0\u5efa\u3002';
    list.append(empty);
  }

  favouriteGroups.forEach(group => {
    const row = document.createElement('div');
    row.className = 'favourite-group-row';
    const choice = document.createElement('button');
    choice.type = 'button';
    choice.className = 'filter-choice favourite-group-choice';
    const selected = onlyFavourites && activeFavouriteGroupId === group.id;
    choice.classList.toggle('selected', selected);
    choice.setAttribute('aria-pressed', String(selected));
    const text = document.createElement('span');
    text.textContent = `${group.name}(${group.members.size})`;
    choice.append(text);
    choice.addEventListener('click', () => {
      onlyFavourites = !selected;
      activeFavouriteGroupId = selected ? null : group.id;
      setPickerOpen('favourite-group-options', 'favourite-group-toggle', false);
      refreshFavouritesToggle();
      refreshFavouriteGroupPicker();
      resetAndDraw();
    });

    const rename = document.createElement('button');
    rename.type = 'button';
    rename.className = 'favourite-group-action';
    rename.textContent = '\u270e';
    rename.title = '\u6539\u540d';
    rename.setAttribute('aria-label', `\u91cd\u547d\u540d${group.name}`);
    rename.addEventListener('click', event => {
      event.stopPropagation();
      const nextName = window.prompt('\u8bf7\u8f93\u5165\u65b0\u5206\u7ec4\u540d\uff1a', group.name);
      if (nextName === null) return;
      const name = cleanFavouriteGroupName(nextName);
      const error = favouriteGroupNameError(name, group.id);
      if (error) {
        setFavouriteGroupStatus('favourite-group-status', error, true);
        return;
      }
      group.name = name;
      saveFavouriteGroups();
      setFavouriteGroupStatus('favourite-group-status', '\u5206\u7ec4\u5df2\u6539\u540d\u3002');
      refreshFavouriteGroupPicker();
    });

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'favourite-group-action';
    remove.textContent = '\u00d7';
    remove.title = '\u5220\u9664';
    remove.setAttribute('aria-label', `\u5220\u9664${group.name}`);
    remove.addEventListener('click', event => {
      event.stopPropagation();
      if (!window.confirm(`\u5220\u9664\u5206\u7ec4\u201c${group.name}\u201d\uff1f\u9f99\u4ecd\u4f1a\u4fdd\u7559\u5728\u6536\u85cf\u4e2d\u3002`)) return;
      favouriteGroups = favouriteGroups.filter(item => item.id !== group.id);
      if (activeFavouriteGroupId === group.id) {
        activeFavouriteGroupId = null;
        onlyFavourites = true;
      }
      saveFavouriteGroups();
      setFavouriteGroupStatus('favourite-group-status', '\u5206\u7ec4\u5df2\u5220\u9664\uff0c\u6536\u85cf\u672a\u5220\u9664\u3002');
      refreshFavouritesToggle();
      refreshFavouriteGroupPicker();
      resetAndDraw();
    });

    row.append(choice, rename, remove);
    list.append(row);
  });
}

function buildFavouriteGroupPicker() {
  const panel = q('favourite-group-options');
  const input = q('favourite-group-name');
  q('favourite-group-toggle').addEventListener('click', () => {
    const open = panel.hidden;
    setPickerOpen('rarity-options', 'rarity-toggle', false);
    setPickerOpen('element-options', 'element-toggle', false);
    setPickerOpen('favourite-group-options', 'favourite-group-toggle', open);
  });
  q('favourite-group-add').addEventListener('click', () => {
    const result = createFavouriteGroup(input.value);
    if (result.error) {
      setFavouriteGroupStatus('favourite-group-status', result.error, true);
      return;
    }
    input.value = '';
    setFavouriteGroupStatus('favourite-group-status', `\u5df2\u65b0\u5efa\u201c${result.group.name}\u201d\u3002`);
    refreshFavouriteGroupPicker();
  });
  input.addEventListener('keydown', event => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    q('favourite-group-add').click();
  });
  refreshFavouriteGroupPicker();
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
  refreshFavouriteGroupPicker();
  refreshRarityPicker();
  refreshElementPicker();
  if (q('favourite-group-dialog').open) refreshFavouriteGroupDialog();
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
    setPickerOpen('favourite-group-options', 'favourite-group-toggle', false);
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
    setPickerOpen('favourite-group-options', 'favourite-group-toggle', false);
    setPickerOpen('element-options', 'element-toggle', open);
  });
  refreshElementPicker();
}

function refreshFavouriteGroupDialog() {
  if (!groupDialogDragon) return;
  const key = dragonKey(groupDialogDragon);
  const options = q('favourite-group-dialog-options');
  q('favourite-group-dialog-dragon').textContent = `${nameFor(groupDialogDragon)}\uff1a\u9009\u62e9\u8981\u52a0\u5165\u7684\u5206\u7ec4`;
  options.replaceChildren();
  if (favouriteGroups.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'favourite-group-empty';
    empty.textContent = '\u8fd8\u6ca1\u6709\u5206\u7ec4\uff0c\u53ef\u5728\u4e0b\u65b9\u65b0\u5efa\u5e76\u52a0\u5165\u3002';
    options.append(empty);
    return;
  }
  favouriteGroups.forEach(group => {
    const label = document.createElement('label');
    label.className = 'favourite-group-dialog-option';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = group.members.has(key);
    const name = document.createElement('span');
    name.textContent = group.name;
    const count = document.createElement('small');
    count.textContent = `${group.members.size}\u6761`;
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        group.members.add(key);
        favourites.add(key);
      } else {
        group.members.delete(key);
      }
      saveFavourites();
      saveFavouriteGroups();
      setFavouriteGroupStatus('favourite-group-dialog-status', checkbox.checked ? `\u5df2\u52a0\u5165\u201c${group.name}\u201d\u3002` : `\u5df2\u79fb\u51fa\u201c${group.name}\u201d\u3002`);
      refreshFavouritesToggle();
      refreshFavouriteGroupPicker();
      refreshFavouriteGroupDialog();
      draw();
    });
    label.append(checkbox, name, count);
    options.append(label);
  });
}

function openFavouriteGroupDialog(dragon) {
  groupDialogDragon = dragon;
  setFavouriteGroupStatus('favourite-group-dialog-status', '');
  q('favourite-group-dialog-name').value = '';
  refreshFavouriteGroupDialog();
  q('favourite-group-dialog').showModal();
}

function buildFavouriteGroupDialog() {
  const dialog = q('favourite-group-dialog');
  const input = q('favourite-group-dialog-name');
  q('favourite-group-dialog-close').addEventListener('click', () => dialog.close());
  q('favourite-group-dialog-add').addEventListener('click', () => {
    if (!groupDialogDragon) return;
    const result = createFavouriteGroup(input.value, dragonKey(groupDialogDragon));
    if (result.error) {
      setFavouriteGroupStatus('favourite-group-dialog-status', result.error, true);
      return;
    }
    input.value = '';
    setFavouriteGroupStatus('favourite-group-dialog-status', `\u5df2\u65b0\u5efa\u5e76\u52a0\u5165\u201c${result.group.name}\u201d\u3002`);
    refreshFavouritesToggle();
    refreshFavouriteGroupPicker();
    refreshFavouriteGroupDialog();
    draw();
  });
  input.addEventListener('keydown', event => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    q('favourite-group-dialog-add').click();
  });
  dialog.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
  });
}

function favouriteGroupButton(dragon) {
  const key = dragonKey(dragon);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'favorite-group-button';
  const count = groupsForDragonKey(key).length;
  button.classList.toggle('active', count > 0);
  button.textContent = count ? `\u5206\u7ec4(${count})` : '\u5206\u7ec4';
  button.setAttribute('aria-haspopup', 'dialog');
  button.setAttribute('aria-label', `\u7ba1\u7406${nameFor(dragon)}\u7684\u6536\u85cf\u5206\u7ec4`);
  button.addEventListener('click', () => openFavouriteGroupDialog(dragon));
  return button;
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
    if (favourites.has(key)) {
      favourites.delete(key);
      if (removeDragonFromFavouriteGroups(key)) saveFavouriteGroups();
    } else {
      favourites.add(key);
    }
    saveFavourites();
    refreshFavouritesToggle();
    refreshFavouriteGroupPicker();
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
  const activeGroup = activeFavouriteGroupId ? favouriteGroupById(activeFavouriteGroupId) : null;
  return catalogue.filter(dragon => {
    const key = dragonKey(dragon);
    return (!onlyFavourites || (activeGroup ? activeGroup.members.has(key) : favourites.has(key))) &&
      (selectedRarities.size === 0 || selectedRarities.has(dragon.rarity)) &&
      [...selectedElements].every(element => dragon.elements.includes(element)) &&
      (!term || [dragon.name, dragon.nameZh, dragon.title, dragon.rarity, dragon.rarityZh, ...dragon.elements].join(' ').toLowerCase().includes(term));
  });
}

function cardFor(dragon) {
  const node = q('card').content.cloneNode(true);
  const ticketNumber = catalogueMode === 'ticket' ? ticketDragons.indexOf(dragon) + 1 : 0;
  node.querySelector('h2').textContent = ticketNumber ? `${ticketNumber}. ${nameFor(dragon)}` : nameFor(dragon);
  const origin = node.querySelector('.origin');
  origin.textContent = 'Fandom \u9875\u9762 \u2197';
  if (dragon.source) origin.href = dragon.source;
  else origin.hidden = true;
  origin.before(favouriteButton(dragon), favouriteGroupButton(dragon));
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
  const allActive = onlyFavourites && !activeFavouriteGroupId;
  onlyFavourites = !allActive;
  activeFavouriteGroupId = null;
  refreshFavouritesToggle();
  refreshFavouriteGroupPicker();
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
    setPickerOpen('favourite-group-options', 'favourite-group-toggle', false);
  }
});
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  setPickerOpen('rarity-options', 'rarity-toggle', false);
  setPickerOpen('element-options', 'element-toggle', false);
  setPickerOpen('favourite-group-options', 'favourite-group-toggle', false);
});

buildFavouriteGroupPicker();
buildFavouriteGroupDialog();
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
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js?v=20260824-favourite-groups1', { scope: './' }).catch(() => {}));
}
