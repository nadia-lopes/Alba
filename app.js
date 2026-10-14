/* Alba Gás e Água — lógica em JavaScript puro */
(function () {
  "use strict";

  // ===== CONFIGURAÇÃO (editável pela empresa) =====
  var CONFIG = {
    whatsapp: "5516997974877",
    whatsappLabel: "(16) 99797-4877",
    deliveryFee: 8.0,
    openHour: 8,
    closeHour: 22,
    coupons: {} // Nenhum cupom comercial definido. Ex.: { "ALBA10": 10 } = R$ 10 de desconto.
  };

  var PRODUCTS = [
    { id: "p13", name: "Botijão de gás P13", size: "13 kg", type: "gas", price: 110, available: true },
    { id: "p20", name: "Botijão de gás P20", size: "20 kg", type: "gas", price: 190, available: true },
    { id: "p45", name: "Botijão de gás P45", size: "45 kg", type: "gas", price: 420, available: false },
    { id: "agua20", name: "Galão de água", size: "20 litros", type: "agua", price: 15, available: true },
    { id: "agua10", name: "Galão de água", size: "10 litros", type: "agua", price: 10, available: true }
  ];

  var CART_KEY = "alba_cart";
  var THEME_KEY = "alba_theme";
  var COUPON_KEY = "alba_coupon";
  var FORM_KEY = "alba_form";

  function $(s, r) { return (r || document).querySelector(s); }
  function $all(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function money(v) { return "R$ " + v.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, "."); }
  function find(id) { for (var i = 0; i < PRODUCTS.length; i++) if (PRODUCTS[i].id === id) return PRODUCTS[i]; return null; }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  // ===== Carrinho =====
  function loadCart() {
    try {
      var raw = JSON.parse(localStorage.getItem(CART_KEY) || "{}");
      var clean = {};
      Object.keys(raw).forEach(function (id) {
        var q = parseInt(raw[id], 10);
        var p = find(id);
        if (p && p.available && q > 0) clean[id] = Math.min(q, 99);
      });
      return clean;
    } catch (e) { return {}; }
  }
  function saveCart(c) { localStorage.setItem(CART_KEY, JSON.stringify(c)); }
  function setQty(id, q) {
    var p = find(id);
    if (!p) return;
    if (!p.available) { toast(p.name + " " + p.size + " está indisponível no momento."); return; }
    var c = loadCart();
    q = Math.max(0, Math.min(99, q | 0));
    if (q === 0) delete c[id]; else c[id] = q;
    saveCart(c);
    render();
  }
  function count(c) { return Object.keys(c).reduce(function (s, k) { return s + c[k]; }, 0); }
  function totals() {
    var c = loadCart();
    var lines = Object.keys(c).map(function (id) { var p = find(id); return { p: p, q: c[id], sub: p.price * c[id] }; });
    var subtotal = lines.reduce(function (s, l) { return s + l.sub; }, 0);
    var code = localStorage.getItem(COUPON_KEY);
    var discount = code && CONFIG.coupons[code] ? Math.min(CONFIG.coupons[code], subtotal) : 0;
    var fee = lines.length ? CONFIG.deliveryFee : 0;
    return { lines: lines, subtotal: subtotal, discount: discount, fee: fee, total: subtotal - discount + fee, coupon: discount ? code : null };
  }

  // ===== Tema =====
  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    $all("[data-theme-btn]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-theme-btn") === t)); });
  }
  applyTheme(localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light");

  // ===== Horário (Brasília) =====
  function isOpen() {
    var h;
    try {
      h = parseInt(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "America/Sao_Paulo" }).format(new Date()), 10);
    } catch (e) { var d = new Date(); h = (d.getUTCHours() + 21) % 24; }
    if (h === 24) h = 0;
    return h >= CONFIG.openHour && h < CONFIG.closeHour;
  }

  // ===== Toast =====
  var toastTimer;
  function toast(msg) {
    var t = $("#toast");
    if (!t) return;
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
  }

  // ===== Render comum =====
  function renderCommon() {
    var n = count(loadCart());
    $all("[data-cart-count]").forEach(function (b) { b.textContent = n; b.hidden = n === 0; b.setAttribute("aria-label", n + " itens no carrinho"); });
    $all("[data-cart-btn]").forEach(function (b) { b.setAttribute("aria-label", "Abrir carrinho, " + n + " itens"); });
    var st = $("#store-status");
    if (st) {
      var open = isOpen();
      st.classList.toggle("closed", !open);
      $("#store-status-text").textContent = open ? "Aberto · todos os dias, 08h–22h" : "Fechado agora · abrimos às 08h";
    }
  }

  // ===== Página inicial =====
  var filter = "all", query = "";
  function norm(s) { return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
  function renderHome() {
    var grid = $("#products");
    if (!grid) return;
    var c = loadCart();
    var q = norm(query.trim());
    var list = PRODUCTS.filter(function (p) {
      if (filter !== "all" && p.type !== filter) return false;
      if (!q) return true;
      var hay = norm(p.name + " " + p.size + " " + (p.type === "gas" ? "gas botijao" : "agua galao") + " " + p.id);
      return q.split(/\s+/).every(function (w) { return hay.indexOf(w) !== -1; });
    });
    if (!list.length) { grid.innerHTML = '<div class="empty">Nenhum produto encontrado.</div>'; return; }
    grid.innerHTML = list.map(function (p) {
      var qty = c[p.id] || 0;
      var action;
      if (!p.available) action = '<div class="unavail">Indisponível</div>';
      else if (qty > 0) action = '<div class="stepper"><button type="button" data-dec="' + p.id + '" aria-label="Diminuir ' + esc(p.name + " " + p.size) + '">−</button><span aria-live="polite">' + qty + ' no carrinho</span><button type="button" data-inc="' + p.id + '" aria-label="Aumentar ' + esc(p.name + " " + p.size) + '">+</button></div>';
      else action = '<button type="button" class="btn-add" data-add="' + p.id + '">Adicionar ao carrinho</button>';
      return '<div class="card"><div class="photo">Foto do produto</div><div class="name">' + esc(p.name) + '</div><div class="size">' + esc(p.size) + '</div><div class="price">' + money(p.price) + '*</div><div class="avail' + (p.available ? "" : " out") + '">' + (p.available ? "Disponível" : "Sem estoque no momento") + '</div><div class="actions">' + action + "</div></div>";
    }).join("");
  }

  // ===== Carrinho =====
  function renderCart() {
    var box = $("#cart-items");
    if (!box) return;
    var t = totals();
    if (!t.lines.length) {
      box.innerHTML = '<div class="item"><div class="info"><div class="title">Seu carrinho está vazio.</div><div class="unit">Adicione produtos para continuar.</div></div></div>';
    } else {
      box.innerHTML = t.lines.map(function (l) {
        return '<div class="item"><div class="thumb"></div><div class="info"><div class="title">' + esc(l.p.name + " · " + l.p.size) + '</div><div class="unit">Unitário ' + money(l.p.price) + '*</div><div class="ctrl"><button type="button" class="q" data-dec="' + l.p.id + '" aria-label="Diminuir">−</button><b aria-live="polite">' + l.q + '</b><button type="button" class="q" data-inc="' + l.p.id + '" aria-label="Aumentar">+</button><button type="button" class="remove" data-remove="' + l.p.id + '">Remover</button></div></div></div>';
      }).join("");
    }
    $("#sum-subtotal").textContent = money(t.subtotal);
    $("#sum-discount").textContent = "−" + money(t.discount);
    $("#sum-fee").textContent = money(t.fee);
    $("#sum-total").textContent = money(t.total);
    var go = $("#go-checkout");
    go.setAttribute("aria-disabled", String(!t.lines.length));
    var cm = $("#coupon-msg");
    if (t.coupon && cm.dataset.state !== "err") { cm.hidden = false; cm.classList.remove("err"); cm.textContent = "Cupom aplicado: −" + money(t.discount); }
  }

  // ===== Checkout =====
  var FIELDS = ["nome", "telefone", "cep", "rua", "numero", "complemento", "bairro", "cidade", "obs"];
  var PAY_LABELS = { pix: "Pix", credito: "Cartão de crédito", debito: "Cartão de débito", dinheiro: "Dinheiro" };
  function formData() {
    var d = {};
    FIELDS.forEach(function (f) { var el = document.getElementById(f); d[f] = el ? el.value.trim() : ""; });
    var pay = $('input[name="pagamento"]:checked');
    d.pagamento = pay ? pay.value : "";
    return d;
  }
  function saveForm() { try { localStorage.setItem(FORM_KEY, JSON.stringify(formData())); } catch (e) {} }
  function restoreForm() {
    try {
      var d = JSON.parse(localStorage.getItem(FORM_KEY) || "{}");
      FIELDS.forEach(function (f) { var el = document.getElementById(f); if (el && d[f]) el.value = d[f]; });
      if (d.pagamento) { var r = $('input[name="pagamento"][value="' + d.pagamento + '"]'); if (r) r.checked = true; }
    } catch (e) {}
  }
  function buildMessage(d, t) {
    var L = [];
    L.push("NOVO PEDIDO — ALBA GÁS E ÁGUA", "", "DADOS DO CLIENTE", "Nome: " + d.nome, "Telefone: " + d.telefone, "", "ENDEREÇO DE ENTREGA");
    if (d.cep) L.push("CEP: " + d.cep);
    L.push("Rua: " + d.rua, "Número: " + d.numero);
    if (d.complemento) L.push("Complemento: " + d.complemento);
    L.push("Bairro: " + d.bairro, "Cidade: " + d.cidade, "", "PRODUTOS");
    t.lines.forEach(function (l) { L.push(l.q + "x " + l.p.name + " " + l.p.size + " — " + money(l.p.price), "Subtotal do item: " + money(l.sub)); });
    L.push("", "RESUMO FINANCEIRO", "Subtotal dos produtos: " + money(t.subtotal));
    if (t.discount) L.push("Desconto: −" + money(t.discount));
    L.push("Taxa de entrega: " + money(t.fee), "TOTAL DO PEDIDO: " + money(t.total), "", "FORMA DE PAGAMENTO", PAY_LABELS[d.pagamento] || "[não selecionada]");
    if (d.obs) L.push("", "OBSERVAÇÕES", d.obs);
    return L.join("\n");
  }
  function renderCheckout() {
    var box = $("#co-summary");
    if (!box) return;
    var t = totals();
    var d = formData();
    var rows = t.lines.map(function (l) { return '<div class="line"><span>' + l.q + "× " + esc(l.p.name + " " + l.p.size) + "</span><span>" + money(l.sub) + "</span></div>"; }).join("");
    if (!t.lines.length) rows = '<div class="line"><span>Carrinho vazio</span><span>—</span></div>';
    rows += '<div class="line"><span>Desconto</span><span>−' + money(t.discount) + "</span></div>";
    rows += '<div class="line"><span>Entrega</span><span>' + money(t.fee) + "</span></div>";
    rows += '<div class="line"><span>Pagamento</span><span>' + (PAY_LABELS[d.pagamento] || "—") + "</span></div>";
    rows += '<hr><div class="line total"><span>Total</span><span>' + money(t.total) + "</span></div>";
    box.innerHTML = rows;
    $("#closed-note").hidden = isOpen();
    var show = {};
    FIELDS.forEach(function (f) { show[f] = d[f] || "[" + f + "]"; });
    $("#co-preview").textContent = buildMessage({
      nome: d.nome || "[nome]", telefone: d.telefone || "[telefone]", cep: d.cep, rua: d.rua || "[rua]", numero: d.numero || "[número]",
      complemento: d.complemento, bairro: d.bairro || "[bairro]", cidade: d.cidade || "[cidade]", pagamento: d.pagamento, obs: d.obs
    }, t);
  }
  function setError(id, msg) {
    var el = document.getElementById(id);
    var field = el.closest(".field");
    field.classList.toggle("invalid", !!msg);
    el.setAttribute("aria-invalid", msg ? "true" : "false");
    field.querySelector(".error").textContent = msg ? "⚠ " + msg : "";
  }
  function validate() {
    var d = formData();
    var errs = [];
    function req(id, cond, msg) { setError(id, cond ? "" : msg); if (!cond) errs.push(id); }
    req("nome", d.nome.length >= 3, "Informe seu nome completo.");
    var digits = d.telefone.replace(/\D/g, "");
    req("telefone", digits.length >= 10 && digits.length <= 11, "Informe o telefone com DDD.");
    var cepD = d.cep.replace(/\D/g, "");
    req("cep", !d.cep || cepD.length === 8, "CEP deve ter 8 dígitos.");
    req("rua", d.rua.length >= 2, "Informe a rua.");
    req("numero", d.numero.length >= 1, "Informe o número.");
    req("bairro", d.bairro.length >= 2, "Informe o bairro.");
    req("cidade", d.cidade.length >= 2, "Informe a cidade.");
    $("#pay-error").textContent = d.pagamento ? "" : "⚠ Escolha uma forma de pagamento.";
    if (!d.pagamento) errs.push("pay-pix");
    return errs;
  }

  function render() { renderCommon(); renderHome(); renderCart(); renderCheckout(); }

  // ===== Eventos =====
  document.addEventListener("click", function (e) {
    var b = e.target.closest("button, a");
    if (!b) return;
    var c = loadCart();
    if (b.dataset.add) { setQty(b.dataset.add, (c[b.dataset.add] || 0) + 1); var p = find(b.dataset.add); if (p && p.available) toast(p.name + " " + p.size + " adicionado ao carrinho."); }
    else if (b.dataset.inc) setQty(b.dataset.inc, (c[b.dataset.inc] || 0) + 1);
    else if (b.dataset.dec) setQty(b.dataset.dec, (c[b.dataset.dec] || 0) - 1);
    else if (b.dataset.remove) { setQty(b.dataset.remove, 0); toast("Produto removido do carrinho."); }
    else if (b.dataset.themeBtn) { localStorage.setItem(THEME_KEY, b.dataset.themeBtn); applyTheme(b.dataset.themeBtn); }
    else if (b.dataset.filter) {
      filter = b.dataset.filter;
      $all("[data-filter]").forEach(function (x) { x.setAttribute("aria-selected", String(x === b)); });
      renderHome();
    }
    else if (b.id === "see-products") { var s = $("#search-input"); if (s) { s.scrollIntoView({ behavior: "smooth", block: "start" }); } }
    else if (b.id === "apply-coupon") {
      var code = $("#coupon").value.trim().toUpperCase();
      var cm = $("#coupon-msg");
      cm.hidden = false;
      if (!code) { cm.classList.add("err"); cm.dataset.state = "err"; cm.textContent = "Digite um cupom."; return; }
      if (CONFIG.coupons[code]) { localStorage.setItem(COUPON_KEY, code); cm.classList.remove("err"); cm.dataset.state = ""; }
      else { localStorage.removeItem(COUPON_KEY); cm.classList.add("err"); cm.dataset.state = "err"; cm.textContent = "Cupom inválido ou não disponível."; }
      render();
    }
    else if (b.id === "go-checkout" && b.getAttribute("aria-disabled") === "true") { e.preventDefault(); toast("Seu carrinho está vazio."); }
    else if (b.id === "send-wa") {
      e.preventDefault();
      var t = totals();
      if (!t.lines.length) { toast("Seu carrinho está vazio. Adicione produtos antes de enviar."); return; }
      var errs = validate();
      if (errs.length) { var first = document.getElementById(errs[0]); if (first) first.focus(); toast("Corrija os campos destacados."); return; }
      if (!isOpen()) { toast("Loja fechada. Atendemos das 08h às 22h."); return; }
      saveForm();
      var url = "https://wa.me/" + CONFIG.whatsapp + "?text=" + encodeURIComponent(buildMessage(formData(), t));
      var w = window.open(url, "_blank", "noopener");
      if (!w) window.location.href = url;
      toast("WhatsApp aberto. Confirme o envio da mensagem por lá.");
    }
  });

  document.addEventListener("input", function (e) {
    if (e.target.id === "search-input") { query = e.target.value; renderHome(); }
    if (e.target.id === "telefone") {
      var v = e.target.value.replace(/\D/g, "").slice(0, 11);
      if (v.length > 6) v = "(" + v.slice(0, 2) + ") " + v.slice(2, v.length - 4) + "-" + v.slice(-4);
      else if (v.length > 2) v = "(" + v.slice(0, 2) + ") " + v.slice(2);
      e.target.value = v;
    }
    if (e.target.id === "cep") {
      var c = e.target.value.replace(/\D/g, "").slice(0, 8);
      e.target.value = c.length > 5 ? c.slice(0, 5) + "-" + c.slice(5) : c;
    }
    if (e.target.closest && e.target.closest("#checkout-form")) {
      if (e.target.closest(".field.invalid")) setError(e.target.id, "");
      saveForm(); renderCheckout();
    }
  });
  document.addEventListener("change", function (e) {
    if (e.target.name === "pagamento") { $("#pay-error").textContent = ""; saveForm(); renderCheckout(); }
  });
  var form = $("#checkout-form");
  if (form) form.addEventListener("submit", function (e) { e.preventDefault(); $("#send-wa").click(); });

  window.addEventListener("storage", render);
  $all("[data-wa-link]").forEach(function (a) { a.href = "https://wa.me/" + CONFIG.whatsapp; });

  restoreForm();
  applyTheme(localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light");
  render();
  setInterval(renderCommon, 60000);
})();
