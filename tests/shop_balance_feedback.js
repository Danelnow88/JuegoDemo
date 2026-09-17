// Tests #12: feedback visual de saldo insuficiente sobre el número existente.
const fs = require('fs');
const vm = require('vm');

let pass = 0;
let fail = 0;

function t(desc, fn) {
  try {
    fn();
    pass++;
    console.log('  ok  ' + desc);
  } catch (error) {
    fail++;
    console.log('  FAIL ' + desc + ' -> ' + error.message);
  }
}

const game = fs.readFileSync('js/game.js', 'utf8');
const css = fs.readFileSync('css/styles.css', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const domSource = fs.readFileSync('js/ui/dom.js', 'utf8');

function extractFunction(source, name) {
  const start = source.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('no se encontró ' + name);
  const bodyStart = source.indexOf('{', start);
  let depth = 0;
  for (let i = bodyStart; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}') {
      depth--;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error('función incompleta: ' + name);
}

function makeClassList() {
  const values = new Set();
  return {
    add(value) { values.add(value); },
    remove(value) { values.delete(value); },
    contains(value) { return values.has(value); },
    count(value) { return Array.from(values).filter((entry) => entry === value).length; },
  };
}

function makeHarness(initialShards) {
  const balanceClassList = makeClassList();
  const offerClassList = makeClassList();
  const balance = { classList: balanceClassList, offsetWidth: 40, onanimationend: null, textContent: String(initialShards) };
  const calls = { floats: 0, generated: 0, hud: 0, inventory: 0, sound: 0 };
  const sandbox = {
    SHOP_BALANCE_INSUFFICIENT_CLASS: 'shop-balance-insufficient',
    dom: { shopShards: balance },
    shards: initialShards,
    arenaW: () => 900,
    arenaH: () => 520,
    addFloatText: () => { calls.floats++; },
    generateOffers: () => { calls.generated++; },
    updateHUD: () => { calls.hud++; },
    renderInventory: () => { calls.inventory++; },
    setTimeout: (fn) => fn(),
    sfx: { shopBuy: () => { calls.sound++; } },
  };
  vm.createContext(sandbox);
  vm.runInContext([
    extractFunction(game, 'clearShopBalanceFeedback'),
    extractFunction(game, 'restartShopBalanceFeedback'),
    extractFunction(game, 'handleShopPurchase'),
  ].join('\n'), sandbox);
  return { sandbox, balance, balanceClassList, offer: { classList: offerClassList }, offerClassList, calls };
}

t('usa el elemento DOM real #shopShards que ya muestra el saldo', () => {
  if (!html.includes('<span id="shopShards">0</span>')) throw new Error('número de saldo ausente');
  if (!domSource.includes("shopShards: document.getElementById('shopShards')")) throw new Error('dom.shopShards no apunta al número real');
});

t('saldo menor al precio rechaza, no cobra ni entrega y activa una sola clase', () => {
  const h = makeHarness(3);
  let delivered = 0;
  const result = h.sandbox.handleShopPurchase({ price: 8, buy: () => { delivered++; } }, h.offer);
  if (result !== false) throw new Error('la compra no fue rechazada');
  if (h.sandbox.shards !== 3 || h.balance.textContent !== '3') throw new Error('el saldo cambió');
  if (delivered !== 0) throw new Error('se entregó el producto');
  if (!h.balanceClassList.contains('shop-balance-insufficient')) throw new Error('feedback no activado');
  if (h.balanceClassList.count('shop-balance-insufficient') !== 1) throw new Error('clase duplicada');
  if (h.calls.floats !== 0) throw new Error('se agregó feedback de texto');
});

t('un segundo intento reinicia el mismo feedback sin acumular clase ni handler', () => {
  const h = makeHarness(3);
  const item = { price: 8, buy: () => true };
  h.sandbox.handleShopPurchase(item, h.offer);
  const firstHandler = h.balance.onanimationend;
  h.sandbox.handleShopPurchase(item, h.offer);
  if (!h.balanceClassList.contains('shop-balance-insufficient')) throw new Error('feedback no quedó activo');
  if (h.balanceClassList.count('shop-balance-insufficient') !== 1) throw new Error('se acumularon clases');
  if (typeof h.balance.onanimationend !== 'function' || h.balance.onanimationend === firstHandler) throw new Error('la animación no se reinició');
  h.balance.onanimationend({ animationName: 'shop-balance-insufficient' });
  if (h.balanceClassList.contains('shop-balance-insufficient') || h.balance.onanimationend !== null) throw new Error('el feedback no volvió a normal');
});

t('saldo suficiente compra una vez, actualiza saldo y no activa rojo', () => {
  const h = makeHarness(10);
  let delivered = 0;
  const result = h.sandbox.handleShopPurchase({ price: 8, buy: () => { delivered++; return true; } }, h.offer);
  if (result !== true || delivered !== 1) throw new Error('producto no entregado exactamente una vez');
  if (h.sandbox.shards !== 2 || h.balance.textContent !== 2) throw new Error('descuento incorrecto');
  if (h.balanceClassList.contains('shop-balance-insufficient')) throw new Error('feedback falso en compra válida');
  if (!h.offerClassList.contains('just-bought')) throw new Error('feedback de compra previo alterado');
  if (h.calls.sound !== 1 || h.calls.generated !== 1 || h.calls.hud !== 1 || h.calls.inventory !== 1) throw new Error('flujo normal de tienda alterado');
});

t('una compra válida limpia inmediatamente un feedback anterior', () => {
  const h = makeHarness(10);
  h.balanceClassList.add('shop-balance-insufficient');
  h.balance.onanimationend = () => {};
  h.sandbox.handleShopPurchase({ price: 8, buy: () => true }, h.offer);
  if (h.balanceClassList.contains('shop-balance-insufficient') || h.balance.onanimationend !== null) throw new Error('feedback viejo no limpiado');
});

t('rechazos por disabled o buy=false no activan falso feedback de saldo', () => {
  const disabled = makeHarness(10);
  let disabledDelivered = 0;
  disabled.sandbox.handleShopPurchase({ disabled: true, price: 8, buy: () => { disabledDelivered++; } }, disabled.offer);
  if (disabledDelivered !== 0 || disabled.balanceClassList.contains('shop-balance-insufficient')) throw new Error('disabled activó feedback económico');

  const ineligible = makeHarness(10);
  ineligible.sandbox.handleShopPurchase({ price: 8, buy: () => false }, ineligible.offer);
  if (ineligible.sandbox.shards !== 10) throw new Error('buy=false no restituyó saldo');
  if (ineligible.balanceClassList.contains('shop-balance-insufficient')) throw new Error('buy=false activó feedback económico');
});

t('el click real delega al flujo único de compra y no conserva el mensaje de saldo', () => {
  const purchaseFlow = extractFunction(game, 'handleShopPurchase');
  if (!game.includes('el.addEventListener("click", () => handleShopPurchase(item, el))')) throw new Error('click no conectado');
  if (purchaseFlow.includes('Fragmentos insuficientes')) throw new Error('permanece texto de saldo insuficiente');
  if (!purchaseFlow.includes('if (shards < item.price)')) throw new Error('condición económica incorrecta');
});

t('CSS usa rojo existente, 600 ms, titileo y shake leve de ±3 px', () => {
  if (!css.includes('#shopShards.shop-balance-insufficient')) throw new Error('selector del saldo ausente');
  if (!css.includes('animation: shop-balance-insufficient 600ms ease-out')) throw new Error('duración incorrecta');
  if (!css.includes('color: #ff5f9b')) throw new Error('rojo de advertencia ausente');
  if (!/opacity:\s*\.5/.test(css) || !/opacity:\s*\.55/.test(css) || !/opacity:\s*\.65/.test(css)) throw new Error('titileo insuficiente');
  if (!css.includes('translateX(-3px)') || !css.includes('translateX(3px)')) throw new Error('shake no usa ±3 px');
  if (/translateX\([+-]?(?:[4-9]|\d{2,})px\)/.test(css.slice(css.indexOf('@keyframes shop-balance-insufficient'), css.indexOf('/* F10:')))) throw new Error('shake exagerado');
});

console.log('RESULT shop_balance_feedback: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);