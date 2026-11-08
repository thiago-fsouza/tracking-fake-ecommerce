/* ===== LojaTeste — e-commerce FICTÍCIO para testes de tracking (GA4 / GTM) ===== */
window.dataLayer = window.dataLayer || [];

const PAGE = (location.pathname.split('/').pop() || 'index.html').replace('.html', '') || 'index';
dataLayer.push({ event: 'page_data', page_type: PAGE, page_title: document.title });

const PRODUCTS = [
  { item_id: 'SKU001', item_name: 'Camiseta Básica', item_category: 'Vestuário',  price: 59.9,  emoji: '👕' },
  { item_id: 'SKU002', item_name: 'Tênis Urbano',    item_category: 'Calçados',   price: 249.9, emoji: '👟' },
  { item_id: 'SKU003', item_name: 'Mochila Casual',  item_category: 'Acessórios', price: 129.9, emoji: '🎒' },
  { item_id: 'SKU004', item_name: 'Boné Clássico',   item_category: 'Acessórios', price: 39.9,  emoji: '🧢' }
];

const $ = s => document.querySelector(s);
const brl = n => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const round = n => Math.round(n * 100) / 100;

// --- dataLayer helpers (loga no console para facilitar o debug) ---
const track = (event, params = {}) => { dataLayer.push({ event, ...params }); console.log('[dataLayer]', event, params); };
const ecom = (event, ecommerce) => {
  dataLayer.push({ ecommerce: null }); // limpa o objeto anterior (boa prática GA4)
  dataLayer.push({ event, ecommerce });
  console.log('[dataLayer]', event, ecommerce);
};

// --- carrinho (localStorage) ---
const getCart = () => { try { return JSON.parse(localStorage.getItem('cart')) || []; } catch (e) { return []; } };
const setCart = c => {
  localStorage.setItem('cart', JSON.stringify(c));
  const n = $('#cnt'); if (n) n.textContent = c.reduce((s, l) => s + l.qty, 0);
};
const item = (id, qty = 1, extra = {}) => { const { emoji, ...p } = PRODUCTS.find(p => p.item_id === id); return { ...p, quantity: qty, ...extra }; };
const emojiOf = id => PRODUCTS.find(p => p.item_id === id).emoji;
const cartItems = () => getCart().map((l, i) => item(l.id, l.qty, { index: i }));
const sum = its => round(its.reduce((s, i) => s + i.price * i.quantity, 0));

function change(id, delta) {
  const c = getCart(), l = c.find(x => x.id === id);
  if (l) l.qty += delta; else if (delta > 0) c.push({ id, qty: delta });
  setCart(c.filter(x => x.qty > 0));
}
function addToCart(id, q = 1) {
  change(id, q); const it = item(id, q);
  ecom('add_to_cart', { currency: 'BRL', value: round(it.price * q), items: [it] });
}
function removeFromCart(id, q = 1) {
  change(id, -q); const it = item(id, q);
  ecom('remove_from_cart', { currency: 'BRL', value: round(it.price * q), items: [it] });
}

// --- layout comum ---
function layout() {
  $('#hdr').innerHTML = `<div class="bar"><a class="logo" href="index.html">🛍️ LojaTeste</a>
    <nav><a href="index.html">Início</a><a href="produtos.html">Produtos</a><a href="carrinho.html">Carrinho (<span id="cnt">0</span>)</a></nav></div>
    <div class="aviso">Ambiente fictício para testes de tracking — nenhuma compra é real.</div>`;
  $('#ftr').textContent = '© LojaTeste — projeto didático de martech.';
  setCart(getCart());
}

// --- páginas ---
const pages = {};

pages.index = () => {
  const promo = { creative_name: 'banner_home', promotion_id: 'PROMO10', promotion_name: 'Semana do Teste' };
  ecom('view_promotion', promo);
  $('#promo').onclick = () => ecom('select_promotion', promo);
};

pages.produtos = () => {
  const list = PRODUCTS.map((p, i) => { const { emoji, ...r } = p; return { ...r, index: i, item_list_id: 'catalogo', item_list_name: 'Catálogo' }; });
  $('#grid').innerHTML = PRODUCTS.map(p => `<article class="card"><div class="img">${p.emoji}</div>
    <h3>${p.item_name}</h3><p class="mut">${p.item_category}</p><strong>${brl(p.price)}</strong>
    <button data-id="${p.item_id}">Adicionar ao carrinho</button></article>`).join('');
  ecom('view_item_list', { item_list_id: 'catalogo', item_list_name: 'Catálogo', items: list });
  $('#grid').onclick = e => {
    const id = e.target.dataset.id; if (!id) return;
    addToCart(id); e.target.textContent = 'Adicionado ✓';
    setTimeout(() => e.target.textContent = 'Adicionar ao carrinho', 1000);
  };
};

pages.carrinho = () => {
  const draw = () => {
    const its = cartItems();
    $('#lines').innerHTML = its.length ? its.map(i => `<div class="line"><span>${emojiOf(i.item_id)} ${i.item_name}</span>
      <span>${brl(i.price)}</span>
      <span><button data-a="dec" data-id="${i.item_id}">−</button> ${i.quantity} <button data-a="inc" data-id="${i.item_id}">+</button></span>
      <span>${brl(i.price * i.quantity)}</span><button data-a="rm" data-id="${i.item_id}">✕</button></div>`).join('')
      : '<p>Seu carrinho está vazio. <a href="produtos.html">Ver produtos</a></p>';
    $('#sub').textContent = brl(sum(its));
    $('#go').hidden = !its.length;
  };
  const its = cartItems();
  if (its.length) ecom('view_cart', { currency: 'BRL', value: sum(its), items: its });
  $('#lines').onclick = e => {
    const { a, id } = e.target.dataset; if (!a) return;
    if (a === 'inc') addToCart(id);
    if (a === 'dec') removeFromCart(id);
    if (a === 'rm') removeFromCart(id, getCart().find(l => l.id === id).qty);
    draw();
  };
  draw();
};

pages.checkout = () => {
  const its = cartItems();
  if (!its.length) return location.replace('produtos.html');
  const SHIP = { padrao: 15, expresso: 30 };
  const frete = () => SHIP[$('#frete').value];
  const base = () => ({ currency: 'BRL', value: sum(its), items: its });
  const upd = () => {
    $('#sum').innerHTML = its.map(i => `<div>${i.quantity}× ${i.item_name} — ${brl(i.price * i.quantity)}</div>`).join('')
      + `<div>Frete: ${brl(frete())}</div><strong>Total: ${brl(sum(its) + frete())}</strong>`;
  };
  upd();
  ecom('begin_checkout', base());
  $('#frete').onchange = () => { upd(); ecom('add_shipping_info', { ...base(), shipping_tier: $('#frete').value }); };
  $('#pgto').onchange = () => ecom('add_payment_info', { ...base(), payment_type: $('#pgto').value });
  $('#form').onsubmit = e => {
    e.preventDefault();
    const order = { transaction_id: 'T' + Date.now(), ...base(), shipping: frete(), tax: 0 };
    localStorage.setItem('lastOrder', JSON.stringify(order));
    setCart([]);
    location.href = 'confirmacao.html';
  };
};

pages.confirmacao = () => {
  const o = JSON.parse(localStorage.getItem('lastOrder') || 'null');
  if (!o) return location.replace('index.html');
  if (!o.sent) { // evita purchase duplicado ao recarregar a página
    const { sent, ...data } = o;
    ecom('purchase', data);
    o.sent = true; localStorage.setItem('lastOrder', JSON.stringify(o));
  }
  $('#order').innerHTML = `<p>Pedido <strong>${o.transaction_id}</strong></p>`
    + o.items.map(i => `<div>${i.quantity}× ${i.item_name} — ${brl(i.price * i.quantity)}</div>`).join('')
    + `<div>Frete: ${brl(o.shipping)}</div><strong>Total: ${brl(o.value + o.shipping)}</strong>`;
};

document.addEventListener('DOMContentLoaded', () => { layout(); if (pages[PAGE]) pages[PAGE](); });
