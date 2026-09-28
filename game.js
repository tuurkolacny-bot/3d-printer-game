const STORAGE_KEY = 'printer-tycoon-save';

const defaultState = {
  money: 1200,
  day: 1,
  reputation: 0,
  energy: 100,
  printer: {
    status: 'Inactief',
    progress: 0,
    activeOrderId: null,
    jammed: false,
    speed: 1,
    precision: 1,
    material: 'PLA'
  },
  materials: {
    PLA: 80,
    ABS: 45,
    PETG: 35
  },
  upgrades: {
    hotend: 0,
    nozzle: 0,
    stabilizer: 0,
    scheduler: 0
  },
  orders: [],
  log: ['Welkom bij je werkplaats! Je printer staat klaar.']
};

const printableMaterials = ['PLA', 'ABS', 'PETG'];

const catalog = [
  { id: 'phone-stand', name: 'Telefoonstandaard', material: 'PLA', duration: 8, reward: 115, reputation: 3 },
  { id: 'keychain', name: 'Sleutelhouder', material: 'PLA', duration: 7, reward: 90, reputation: 2 },
  { id: 'lamp-shade', name: 'Lampenkap', material: 'ABS', duration: 11, reward: 170, reputation: 5 },
  { id: 'toolbox', name: 'Mini toolkist', material: 'PETG', duration: 15, reward: 230, reputation: 6 },
  { id: 'toy-car', name: 'Speelgoed auto', material: 'PLA', duration: 10, reward: 140, reputation: 4 },
  { id: 'bracket', name: 'Montagebeugel', material: 'ABS', duration: 9, reward: 130, reputation: 4 },
  { id: 'case', name: 'Console behuizing', material: 'PETG', duration: 16, reward: 300, reputation: 8 }
];

const shop = [
  {
    id: 'hotend',
    name: 'Snellere hotend',
    description: '+20% printtempo',
    cost: 220,
    level: 0,
    max: 3
  },
  {
    id: 'nozzle',
    name: 'Precision nozzle',
    description: '+15% opbrengst',
    cost: 260,
    level: 0,
    max: 3
  },
  {
    id: 'stabilizer',
    name: 'Bed stabilisatie',
    description: 'Minder printerstoringen',
    cost: 310,
    level: 0,
    max: 3
  },
  {
    id: 'scheduler',
    name: 'Smart planner',
    description: '+10% reputatie per bestelling',
    cost: 360,
    level: 0,
    max: 2
  }
];

const els = {
  money: document.querySelector('#money'),
  day: document.querySelector('#day'),
  reputation: document.querySelector('#reputation'),
  energy: document.querySelector('#energy'),
  statusText: document.querySelector('#statusText'),
  progressFill: document.querySelector('#progressFill'),
  progressText: document.querySelector('#progressText'),
  materialList: document.querySelector('#materialList'),
  orderList: document.querySelector('#orderList'),
  shopList: document.querySelector('#shopList'),
  logList: document.querySelector('#logList'),
  printModel: document.querySelector('#printModel'),
  repairBtn: document.querySelector('#repairBtn'),
  nextDayBtn: document.querySelector('#nextDayBtn'),
  saveBtn: document.querySelector('#saveBtn')
};

let state = loadState();
let printTimer = null;

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return JSON.parse(JSON.stringify(defaultState));

  try {
    const parsed = JSON.parse(saved);
    return { ...JSON.parse(JSON.stringify(defaultState)), ...parsed, printer: { ...defaultState.printer, ...(parsed.printer || {}) }, materials: { ...defaultState.materials, ...(parsed.materials || {}) }, upgrades: { ...defaultState.upgrades, ...(parsed.upgrades || {}) }, log: parsed.log || defaultState.log };
  } catch {
    return JSON.parse(JSON.stringify(defaultState));
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function addLog(message) {
  state.log.unshift(message);
  state.log = state.log.slice(0, 7);
}

function repairPrinter() {
  if (state.printer.jammed) {
    state.printer.jammed = false;
    state.printer.status = 'Inactief';
    state.energy = Math.min(100, state.energy + 25);
    addLog('De printer is succesvol gerepareerd.');
    render();
    return;
  }

  addLog('De printer heeft geen reparatie nodig.');
}

function getReputationLabel() {
  if (state.reputation >= 70) return 'Gevierd';
  if (state.reputation >= 40) return 'Populair';
  if (state.reputation >= 15) return 'Stevig';
  return 'Nieuw';
}

function getShopItemState(item) {
  return state.upgrades[item.id] || 0;
}

function generateDayOrders() {
  const count = 3 + Math.min(2, Math.floor(state.day / 2));
  const generated = [];

  for (let i = 0; i < count; i += 1) {
    const source = catalog[Math.floor(Math.random() * catalog.length)];
    const rewardBoost = 1 + state.day * 0.08;
    const durability = 1 + Math.random() * 0.7;

    generated.push({
      id: `${source.id}-${Date.now()}-${Math.random()}`,
      ...source,
      reward: Math.round(source.reward * rewardBoost * durability),
      reputation: source.reputation,
      duration: source.duration
    });
  }

  state.orders = generated;
}

function buyUpgrade(id) {
  const item = shop.find(entry => entry.id === id);
  if (!item) return;

  const current = getShopItemState(item);
  if (current >= item.max) {
    addLog(`${item.name} is al op maximaal niveau.`);
    render();
    return;
  }

  const cost = item.cost + current * 110;
  if (state.money < cost) {
    addLog(`Niet genoeg geld voor ${item.name}.`);
    render();
    return;
  }

  state.money -= cost;
  state.upgrades[id] = current + 1;
  addLog(`${item.name} gekocht. ${item.description}`);
  render();
}

function startOrder(orderId) {
  if (state.printer.activeOrderId) {
    addLog('De printer is nog bezig met een opdracht.');
    render();
    return;
  }

  const order = state.orders.find(entry => entry.id === orderId);
  if (!order) return;

  if (state.materials[order.material] <= 0) {
    addLog(`Geen ${order.material} meer beschikbaar.`);
    render();
    return;
  }

  state.materials[order.material] = Math.max(0, state.materials[order.material] - 10);
  state.printer.activeOrderId = orderId;
  state.printer.status = 'Printen';
  state.printer.progress = 0;
  state.printer.material = order.material;
  state.energy = Math.max(18, state.energy - 8);
  els.printModel.classList.add('active');
  addLog(`Printen gestart: ${order.name}.`);

  const speedBoost = 1 + (state.upgrades.hotend || 0) * 0.22;
  const precisionBoost = 1 + (state.upgrades.nozzle || 0) * 0.14;
  const failureChance = Math.max(0.02, 0.12 - (state.upgrades.stabilizer || 0) * 0.02);

  if (printTimer) clearInterval(printTimer);

  printTimer = setInterval(() => {
    if (!state.printer.activeOrderId) return;

    const activeOrder = state.orders.find(entry => entry.id === state.printer.activeOrderId);
    if (!activeOrder) return;

    const randomFail = Math.random() < failureChance;
    if (randomFail) {
      state.printer.jammed = true;
      state.printer.status = 'Storing';
      state.printer.progress = Math.max(0, state.printer.progress - 20);
      addLog(`Printer storing tijdens ${activeOrder.name}.`);
      clearInterval(printTimer);
      render();
      return;
    }

    const step = (100 / activeOrder.duration) * (0.28 * speedBoost * precisionBoost);
    state.printer.progress += step;

    if (state.printer.progress >= 100) {
      finishOrder(activeOrder);
    }

    render();
  }, 400);

  render();
}

function finishOrder(order) {
  if (printTimer) clearInterval(printTimer);

  state.printer.progress = 100;
  state.printer.status = 'Klaar';
  state.printer.activeOrderId = null;
  state.energy = Math.min(100, state.energy + 10);

  const bonus = 1 + (state.upgrades.nozzle || 0) * 0.12;
  const pay = Math.round(order.reward * bonus);
  const repGain = Math.round(order.reputation * (1 + (state.upgrades.scheduler || 0) * 0.18));

  state.money += pay;
  state.reputation += repGain;

  state.orders = state.orders.filter(entry => entry.id !== order.id);
  if (state.orders.length === 0) {
    generateDayOrders();
  }

  addLog(`Order voltooid: ${order.name}. +€${pay} en +${repGain} reputatie.`);
  state.printer.progress = 0;
  state.printer.status = 'Inactief';
  state.printer.jammed = false;
  els.printModel.classList.remove('active');
  render();
}

function nextDay() {
  state.day += 1;
  state.energy = Math.min(100, state.energy + 25);
  state.money += 40 + state.day * 4;
  state.orders = [];
  generateDayOrders();
  addLog(`Nieuwe dag gestart. Werkdruk is omhoog.`);
  render();
}

function renderMaterials() {
  els.materialList.innerHTML = '';
  printableMaterials.forEach(name => {
    const wrapper = document.createElement('div');
    wrapper.className = 'material-item';
    wrapper.innerHTML = `
      <span>${name}</span>
      <strong>${state.materials[name]}g</strong>
    `;
    els.materialList.appendChild(wrapper);
  });
}

function renderOrders() {
  els.orderList.innerHTML = '';

  state.orders.forEach(order => {
    const card = document.createElement('div');
    card.className = 'order-card';
    card.innerHTML = `
      <div class="order-top">
        <strong>${order.name}</strong>
        <span class="pill">€${order.reward}</span>
      </div>
      <div class="order-meta">
        <span>${order.material}</span>
        <span>${order.duration}s</span>
        <span>Rep +${order.reputation}</span>
      </div>
      <button class="action-btn" data-order-id="${order.id}">Printen</button>
    `;
    els.orderList.appendChild(card);
  });

  els.orderList.querySelectorAll('[data-order-id]').forEach(button => {
    button.addEventListener('click', () => startOrder(button.dataset.orderId));
  });
}

function renderShop() {
  els.shopList.innerHTML = '';

  shop.forEach(item => {
    const current = getShopItemState(item);
    const cost = item.cost + current * 110;
    const card = document.createElement('div');
    card.className = `shop-item ${current >= item.max ? 'locked' : ''}`;

    card.innerHTML = `
      <div class="shop-top">
        <strong>${item.name}</strong>
        <span class="pill">Lv ${current}/${item.max}</span>
      </div>
      <div class="shop-meta">
        <span>${item.description}</span>
      </div>
      <button class="shop-btn" data-upgrade-id="${item.id}">${current >= item.max ? 'Max' : `Kopen €${cost}`}</button>
    `;

    if (current < item.max) {
      const btn = card.querySelector('.shop-btn');
      btn.addEventListener('click', () => buyUpgrade(item.id));
    }

    els.shopList.appendChild(card);
  });
}

function renderLog() {
  els.logList.innerHTML = '';
  state.log.forEach(message => {
    const item = document.createElement('li');
    item.textContent = message;
    els.logList.appendChild(item);
  });
}

function renderTopStats() {
  els.money.textContent = `€${state.money}`;
  els.day.textContent = String(state.day);
  els.reputation.textContent = getReputationLabel();
  els.energy.textContent = `${state.energy}%`;
  els.statusText.textContent = state.printer.status;
  els.progressText.textContent = `${Math.round(state.printer.progress)}%`;
  els.progressFill.style.width = `${state.printer.progress}%`;
}

function render() {
  renderTopStats();
  renderMaterials();
  renderOrders();
  renderShop();
  renderLog();
}

els.nextDayBtn.addEventListener('click', nextDay);
els.repairBtn.addEventListener('click', repairPrinter);
els.saveBtn.addEventListener('click', () => {
  saveState();
  addLog('Spel opgeslagen.');
  render();
});

function boot() {
  if (!state.orders.length) {
    generateDayOrders();
  }
  render();
}

boot();

window.addEventListener('beforeunload', saveState);
