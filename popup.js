/* AccountHop – popup. Shows names and pictures only; it never sees session values. */

const LOGIN_URL = 'https://www.roblox.com/login';
const $ = (id) => document.getElementById(id);
const t = (key, subs) => chrome.i18n.getMessage(key, subs) || key;

let busy = false;

/* ---------- helpers ---------- */

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function hueFor(id) {
  let h = 0;
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) % 100003;
  return Math.round((h * 137.508) % 360); // golden angle spreads similar ids apart
}

function avatar(account, big) {
  const wrap = el('div', big ? 'avatar big' : 'avatar');
  wrap.style.setProperty('--hue', String(hueFor(account.userId)));
  const name = (account.displayName || account.name || '?').trim();
  wrap.append(el('span', 'initial', name.charAt(0).toUpperCase() || '?'));
  if (account.avatarUrl) {
    const img = new Image();
    img.alt = '';
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';
    img.addEventListener('load', () => wrap.classList.add('loaded'));
    img.addEventListener('error', () => img.remove());
    img.src = account.avatarUrl;
    wrap.append(img);
  }
  return wrap;
}

function names(account, status) {
  const box = el('div', 'names');
  box.append(el('div', 'display', account.displayName || account.name));
  const handle = el('div', 'handle');
  if (status) handle.append(status);
  handle.append('@' + account.name);
  box.append(handle);
  return box;
}

function closeIcon() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('fill', 'currentColor');
  path.setAttribute('d', 'm12 10.6 4.9-4.9 1.4 1.4-4.9 4.9 4.9 4.9-1.4 1.4-4.9-4.9-4.9 4.9-1.4-1.4 4.9-4.9-4.9-4.9 1.4-1.4 4.9 4.9Z');
  svg.append(path);
  return svg;
}

let toastTimer;
function toast(text, isError) {
  const box = $('toast');
  box.textContent = text;
  box.classList.toggle('error', !!isError);
  box.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (box.hidden = true), isError ? 5000 : 2600);
}

function errorText(res) {
  switch (res && res.error) {
    case 'expired': return t('errExpired', [res.displayName || '']);
    case 'offline': return t('errOffline');
    case 'not_logged_in': return t('errNotLoggedIn');
    default: return t('errGeneric');
  }
}

async function send(type, extra) {
  try {
    return await chrome.runtime.sendMessage(Object.assign({ type }, extra));
  } catch {
    return { ok: false, error: 'internal' };
  }
}

// Runs an action with a spinner on the clicked button and blocks double clicks.
async function act(button, type, extra) {
  if (busy) return null;
  busy = true;
  document.querySelectorAll('button').forEach((b) => (b.disabled = true));
  if (button) button.classList.add('busy');
  const res = await send(type, extra);
  busy = false;
  if (button) button.classList.remove('busy');
  document.querySelectorAll('button').forEach((b) => (b.disabled = false));
  return res;
}

/* ---------- rendering ---------- */

function renderCurrent(state) {
  const box = $('current');
  box.replaceChildren();

  if (state.offline) {
    const who = el('div', 'who');
    who.append(el('div', 'title', t('offlineTitle')), el('div', 'hint', t('offlineHint')));
    box.append(who);
    return;
  }

  if (!state.current) {
    const who = el('div', 'who');
    who.append(el('div', 'title', t('notLoggedIn')), el('div', 'hint', t('notLoggedInHint')));
    const login = el('button', 'btn', t('loginButton'));
    login.type = 'button';
    login.addEventListener('click', () => chrome.tabs.create({ url: LOGIN_URL }));
    box.append(who, login);
    return;
  }

  const c = state.current;
  const who = el('div', 'who');
  who.append(el('div', 'label', t('nowLoggedIn')), names(c));
  box.append(avatar(c, true), who);

  if (c.saved) {
    box.append(el('span', 'chip saved', '✓ ' + t('saved')));
  } else {
    const save = el('button', 'btn primary', t('save'));
    save.type = 'button';
    save.addEventListener('click', async () => {
      const res = await act(save, 'saveCurrent');
      if (!res) return;
      if (res.ok) toast(t('toastSaved', [res.displayName]));
      else toast(errorText(res), true);
      refresh();
    });
    box.append(save);
  }
}

function renderRow(account) {
  const li = el('li', 'row' + (account.active ? ' is-active' : ''));
  const actions = el('div', 'row-actions');

  if (account.active) {
    actions.append(el('span', 'chip active', t('active')));
  } else if (account.expired) {
    const renew = el('button', 'btn', t('renew'));
    renew.type = 'button';
    renew.addEventListener('click', () => startAdd(renew));
    actions.append(renew);
  } else {
    const sw = el('button', 'btn primary', t('switch'));
    sw.type = 'button';
    sw.addEventListener('click', async () => {
      const res = await act(sw, 'switchTo', { userId: account.userId });
      if (!res) return;
      if (res.ok) toast(t(res.already ? 'toastAlready' : 'toastSwitched', [res.displayName]));
      else toast(errorText(res), true);
      refresh();
    });
    actions.append(sw);
  }

  const remove = el('button', 'icon-btn remove');
  remove.type = 'button';
  remove.title = t('removeLabel');
  remove.setAttribute('aria-label', t('removeLabel') + ': ' + (account.displayName || account.name));
  remove.append(closeIcon());
  let armed = false;
  let disarmTimer;
  remove.addEventListener('click', async () => {
    if (!armed) {
      armed = true;
      remove.classList.add('confirm');
      remove.textContent = t('removeConfirm');
      disarmTimer = setTimeout(() => refresh(), 3500);
      return;
    }
    clearTimeout(disarmTimer);
    const res = await act(remove, 'removeAccount', { userId: account.userId });
    if (res && res.ok) toast(t('toastRemoved'));
    refresh();
  });
  actions.append(remove);

  const status = account.expired && !account.active ? el('span', 'chip expired small', t('expired')) : null;
  li.append(avatar(account, false), names(account, status), actions);
  return li;
}

function render(state) {
  renderCurrent(state);

  const list = $('list');
  list.replaceChildren(...state.accounts.map(renderRow));
  $('listTitle').textContent = t('yourAccounts', [String(state.accounts.length)]);
  $('empty').hidden = state.accounts.length > 0;
  $('pending').hidden = !state.addPending;
}

async function refresh() {
  const state = await send('getState');
  if (state && state.ok) render(state);
  else toast(t('errGeneric'), true);
}

async function startAdd(button) {
  const res = await act(button, 'addAccount');
  if (!res) return;
  if (!res.ok) {
    toast(errorText(res), true);
    refresh();
  }
  // On success a login tab opens and this popup closes by itself.
}

/* ---------- start ---------- */

document.querySelectorAll('[data-i18n]').forEach((node) => {
  node.textContent = t(node.dataset.i18n);
});
document.documentElement.lang = chrome.i18n.getUILanguage();

$('add').addEventListener('click', () => startAdd($('add')));
$('cancelAdd').addEventListener('click', async () => {
  await act(null, 'cancelAdd');
  refresh();
});

refresh();
