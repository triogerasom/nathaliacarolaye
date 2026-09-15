const COMPANY = {
  cnpj: "68205288000174",
  cnpjMasked: "68.205.288/0001-74",
  name: "68.205.288 NATHALIA CAROLAYNE DIAS ARAUJ",
  ie: "0056002090061",
  uf: "MG",
};

const AUTH_EMAIL = "eu15933220620@gmail.com";
const INITIAL_PASSWORD_HASH = "9ee9988554a1e60b2b53c3478979dab72977d77ba42fee4432b4114ea8e7549e";

const SAMPLE_XML = `<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe"><NFe xmlns="http://www.portalfiscal.inf.br/nfe"><infNFe versao="4.00" Id="NFe31260956228356014353550230001705991880248320"><ide><serie>23</serie><nNF>170599</nNF><dhEmi>2026-09-11T19:47:59-03:00</dhEmi><tpNF>1</tpNF></ide><emit><CNPJ>56228356014353</CNPJ><xNome>CRBS S/A   CDD Ipatinga</xNome></emit><dest><CNPJ>68205288000174</CNPJ><xNome>68.205.288 NATHALIA CAROLAYNE DIAS ARAUJ</xNome><IE>0056002090061</IE></dest><det nItem="1"><prod><cProd>0013566</cProd><cEAN>7891149105571</cEAN><xProd>SKOL BEATS SENSES LT 269ML CX C/8 FRIDGE PACK</xProd><NCM>22060090</NCM><CEST>0202300</CEST><CFOP>5403</CFOP><uCom>cx</uCom><qCom>1.0000</qCom><vUnCom>8.0609523810</vUnCom><vProd>8.06</vProd><cEANTrib>7891149105564</cEANTrib><uTrib>un</uTrib><qTrib>8.0000</qTrib><vUnTrib>1.0075000000</vUnTrib></prod><imposto><ICMS><ICMS10><CST>10</CST><vBC>8.06</vBC><pICMS>12.00</pICMS><vICMS>0.97</vICMS><vBCST>53.12</vBCST><pICMSST>25.00</pICMSST><vICMSST>12.31</vICMSST></ICMS10></ICMS><IPI><IPITrib><CST>50</CST><vIPI>0.52</vIPI></IPITrib></IPI><PIS><PISAliq><CST>01</CST><vPIS>0.12</vPIS></PISAliq></PIS><COFINS><COFINSAliq><CST>01</CST><vCOFINS>0.53</vCOFINS></COFINSAliq></COFINS></imposto></det><det nItem="2"><prod><cProd>0009085</cProd><cEAN>7891991002288</cEAN><xProd>GUARANA CHP ANTARCTICA DIET LATA 350ML SH C/12 NPAL</xProd><NCM>22021000</NCM><CEST>0301002</CEST><CFOP>5403</CFOP><uCom>cx</uCom><qCom>5.0000</qCom><vUnCom>28.5367498314</vUnCom><vProd>142.68</vProd><cEANTrib>7891991000727</cEANTrib><uTrib>un</uTrib><qTrib>60.0000</qTrib><vUnTrib>2.3780000000</vUnTrib></prod><imposto><ICMS><ICMS10><CST>10</CST><vBC>142.68</vBC><pICMS>12.00</pICMS><vICMS>17.12</vICMS><vBCST>277.20</vBCST><pICMSST>18.00</pICMSST><vICMSST>32.77</vICMSST></ICMS10></ICMS><IPI><IPITrib><CST>50</CST><vIPI>1.40</vIPI></IPITrib></IPI><PIS><PISAliq><CST>02</CST><vPIS>2.30</vPIS></PISAliq></PIS><COFINS><COFINSAliq><CST>02</CST><vCOFINS>10.55</vCOFINS></COFINSAliq></COFINS></imposto></det><det nItem="3"><prod><cProd>0009084</cProd><cEAN>7891991002189</cEAN><xProd>GUARANA CHP ANTARCTICA LATA 350ML SH C/12 NPAL</xProd><NCM>22021000</NCM><CEST>0301002</CEST><CFOP>5403</CFOP><uCom>cx</uCom><qCom>5.0000</qCom><vUnCom>28.5367498314</vUnCom><vProd>142.68</vProd><cEANTrib>7891991000826</cEANTrib><uTrib>un</uTrib><qTrib>60.0000</qTrib><vUnTrib>2.3780000000</vUnTrib></prod><imposto><ICMS><ICMS10><CST>10</CST><vBC>142.68</vBC><pICMS>12.00</pICMS><vICMS>17.12</vICMS><vBCST>277.20</vBCST><pICMSST>18.00</pICMSST><vICMSST>32.77</vICMSST></ICMS10></ICMS><IPI><IPITrib><CST>50</CST><vIPI>1.40</vIPI></IPITrib></IPI><PIS><PISAliq><CST>02</CST><vPIS>2.30</vPIS></PISAliq></PIS><COFINS><COFINSAliq><CST>02</CST><vCOFINS>10.55</vCOFINS></COFINSAliq></COFINS></imposto></det><total><ICMSTot><vNF>386.73</vNF></ICMSTot></total></infNFe></NFe><protNFe versao="4.00"><infProt><chNFe>31260956228356014353550230001705991880248320</chNFe><cStat>100</cStat><xMotivo>Autorizado o uso da NF-e</xMotivo></infProt></protNFe></nfeProc>`;

const initialState = {
  user: "Nathalia",
  auth: {
    email: AUTH_EMAIL,
    passwordHash: INITIAL_PASSWORD_HASH,
    mustChangePassword: true,
    loggedIn: false,
  },
  documents: [],
  products: {},
  movements: [],
  batches: [],
};

let state = loadState();

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 });
let supabaseClient = null;
let supabaseReady = false;

function loadState() {
  const saved = localStorage.getItem("nathaliaFiscalState");
  const loaded = saved ? JSON.parse(saved) : {};
  return {
    ...structuredClone(initialState),
    ...loaded,
    auth: {
      ...structuredClone(initialState.auth),
      ...(loaded.auth || {}),
    },
    documents: loaded.documents || [],
    products: loaded.products || {},
    movements: loaded.movements || [],
    batches: loaded.batches || [],
  };
}

function saveState() {
  localStorage.setItem("nathaliaFiscalState", JSON.stringify(state));
  saveRemoteState();
}

function text(node, tag) {
  const value = node?.getElementsByTagName(tag)?.[0]?.textContent;
  return value ? value.trim() : "";
}

function toNumber(value) {
  const normalized = String(value || "0").replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function maskKey(key) {
  if (!key) return "-";
  return `${key.slice(0, 6)}...${key.slice(-6)}`;
}

async function hashPassword(password) {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function renderAuth() {
  const locked = !state.auth.loggedIn || state.auth.mustChangePassword;
  document.body.classList.toggle("locked", locked);
  document.getElementById("auth-screen").classList.toggle("hidden", !locked);
  document.getElementById("login-form").classList.toggle("hidden", state.auth.mustChangePassword && state.auth.loggedIn);
  document.getElementById("password-form").classList.toggle("hidden", !(state.auth.mustChangePassword && state.auth.loggedIn));
  document.getElementById("session-email").textContent = state.auth.email;
}

async function initSupabase() {
  try {
    const configResponse = await fetch("/api/config", { cache: "no-store" });
    if (!configResponse.ok) return;
    const config = await configResponse.json();
    if (!config.supabaseUrl || !config.supabaseAnonKey) return;

    const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
    supabaseClient = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });

    const { data } = await supabaseClient.auth.getSession();
    const user = data.session?.user;
    supabaseReady = true;

    if (user) {
      state.auth.email = user.email || AUTH_EMAIL;
      state.auth.loggedIn = true;
      state.auth.mustChangePassword = Boolean(user.user_metadata?.must_change_password);
      await loadRemoteState();
      saveState();
    }
  } catch (error) {
    supabaseReady = false;
  } finally {
    renderAuth();
    render();
  }
}

async function loadRemoteState() {
  if (!supabaseReady || !supabaseClient) return;
  const { data, error } = await supabaseClient
    .from("company_app_state")
    .select("data")
    .eq("company_cnpj", COMPANY.cnpj)
    .maybeSingle();

  if (error || !data?.data) return;
  state = {
    ...state,
    ...data.data,
    auth: {
      ...state.auth,
      ...(data.data.auth || {}),
      loggedIn: true,
    },
  };
}

async function saveRemoteState() {
  if (!supabaseReady || !supabaseClient || !state.auth.loggedIn) return;
  const { data: userData } = await supabaseClient.auth.getUser();
  const payload = {
    ...state,
    auth: {
      ...state.auth,
      loggedIn: false,
    },
  };

  await supabaseClient.from("company_app_state").upsert({
    company_cnpj: COMPANY.cnpj,
    data: payload,
    updated_by: userData.user?.id || null,
    updated_at: new Date().toISOString(),
  });
}

function parseNfe(xmlText) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, "application/xml");
  const parserError = xml.querySelector("parsererror");

  if (parserError) {
    throw new Error("O arquivo não parece ser um XML válido de NF-e.");
  }

  const infNFe = xml.getElementsByTagName("infNFe")[0];
  const prot = xml.getElementsByTagName("infProt")[0];
  const ide = xml.getElementsByTagName("ide")[0];
  const emit = xml.getElementsByTagName("emit")[0];
  const dest = xml.getElementsByTagName("dest")[0];
  const total = xml.getElementsByTagName("ICMSTot")[0];

  if (!infNFe || !ide || !emit || !dest) {
    throw new Error("Não encontrei a estrutura principal da NF-e.");
  }

  const emitCnpj = text(emit, "CNPJ");
  const destCnpj = text(dest, "CNPJ");
  const keyFromId = infNFe.getAttribute("Id")?.replace(/^NFe/, "") || "";
  const key = text(prot, "chNFe") || keyFromId;
  const type = destCnpj === COMPANY.cnpj ? "entrada" : emitCnpj === COMPANY.cnpj ? "saida" : "ignorado";

  if (type === "ignorado") {
    throw new Error(`Este XML não tem ${COMPANY.name} como emitente ou destinatária.`);
  }

  const items = [...xml.getElementsByTagName("det")].map((det) => {
    const prod = det.getElementsByTagName("prod")[0];
    const imposto = det.getElementsByTagName("imposto")[0];
    const qCom = toNumber(text(prod, "qCom"));
    const qTrib = toNumber(text(prod, "qTrib")) || qCom;
    const vProd = toNumber(text(prod, "vProd"));
    const conversion = qCom ? qTrib / qCom : 1;
    const tax = imposto ? {
      icmsCst: text(imposto, "CST"),
      vBC: text(imposto, "vBC"),
      pICMS: text(imposto, "pICMS"),
      vICMS: text(imposto, "vICMS"),
      vBCST: text(imposto, "vBCST"),
      vICMSST: text(imposto, "vICMSST"),
      vIPI: text(imposto, "vIPI"),
      vPIS: text(imposto, "vPIS"),
      vCOFINS: text(imposto, "vCOFINS"),
    } : {};

    return {
      code: text(prod, "cProd"),
      ean: text(prod, "cEAN") || "SEM GTIN",
      eanTrib: text(prod, "cEANTrib") || text(prod, "cEAN") || "SEM GTIN",
      description: text(prod, "xProd"),
      ncm: text(prod, "NCM"),
      cest: text(prod, "CEST"),
      cfop: text(prod, "CFOP"),
      uCom: text(prod, "uCom"),
      qCom,
      vUnCom: toNumber(text(prod, "vUnCom")),
      vProd,
      uTrib: text(prod, "uTrib"),
      qTrib,
      vUnTrib: toNumber(text(prod, "vUnTrib")) || (qTrib ? vProd / qTrib : 0),
      conversion,
      tax,
    };
  });

  return {
    key,
    type,
    number: text(ide, "nNF"),
    series: text(ide, "serie"),
    issuedAt: text(ide, "dhEmi"),
    operation: text(ide, "natOp") || (type === "entrada" ? "Compra de mercadoria" : "Venda de mercadoria"),
    emit: { cnpj: emitCnpj, name: text(emit, "xNome") },
    dest: { cnpj: destCnpj, name: text(dest, "xNome") },
    participant: type === "entrada" ? text(emit, "xNome") : text(dest, "xNome"),
    total: toNumber(text(total, "vNF")),
    items,
    xmlOriginal: xmlText,
  };
}

function importNfe(xmlText, sourceName = "arquivo XML") {
  const document = parseNfe(xmlText);

  if (state.documents.some((doc) => doc.key === document.key)) {
    throw new Error(`NF-e duplicada. A chave ${document.key} já foi importada.`);
  }

  const batchId = crypto.randomUUID();
  const importedAt = new Date().toISOString();

  state.documents.unshift({ ...document, batchId, sourceName, importedAt });
  state.batches.unshift({
    id: batchId,
    sourceName,
    importedAt,
    status: "processado",
    items: document.items.length,
    key: document.key,
  });

  document.items.forEach((item) => {
    const productKey = item.eanTrib || item.ean || item.code;
    const existing = state.products[productKey] || {
      key: productKey,
      ean: item.ean,
      eanTrib: item.eanTrib,
      description: item.description,
      ncm: item.ncm,
      cest: item.cest,
      uTrib: item.uTrib,
      stock: 0,
      totalCost: 0,
      documents: 0,
      lastPurchase: "",
    };

    const multiplier = document.type === "entrada" ? 1 : -1;
    const movementQty = item.qTrib * multiplier;
    existing.stock += movementQty;

    if (document.type === "entrada") {
      existing.totalCost += item.vProd;
      existing.documents += 1;
      existing.lastPurchase = document.issuedAt;
    }

    existing.description = item.description || existing.description;
    existing.ncm = item.ncm || existing.ncm;
    existing.cest = item.cest || existing.cest;
    existing.ean = item.ean || existing.ean;
    existing.eanTrib = item.eanTrib || existing.eanTrib;
    existing.uTrib = item.uTrib || existing.uTrib;
    state.products[productKey] = existing;

    state.movements.unshift({
      id: crypto.randomUUID(),
      date: document.issuedAt,
      type: document.type,
      productKey,
      product: item.description,
      quantity: movementQty,
      unit: item.uTrib,
      commercialQuantity: item.qCom,
      commercialUnit: item.uCom,
      conversion: item.conversion,
      documentKey: document.key,
      documentNumber: document.number,
      cfop: item.cfop,
      value: item.vProd,
    });
  });

  saveState();
  render();
  renderImportResult(document);

  return document;
}

function render() {
  renderKpis();
  renderMovements();
  renderStock();
  renderProducts();
  renderDocuments();
}

function renderKpis() {
  const products = Object.values(state.products);
  const documents = state.documents;
  const entries = documents.filter((doc) => doc.type === "entrada");
  const exits = documents.filter((doc) => doc.type === "saida");
  const stockUnits = products.reduce((sum, product) => sum + product.stock, 0);
  const stockValue = products.reduce((sum, product) => {
    const average = product.documents ? product.totalCost / Math.max(product.stock, 1) : 0;
    return sum + Math.max(product.stock, 0) * average;
  }, 0);

  const cards = [
    ["Itens fiscais", number.format(stockUnits), "Saldo em unidade tributável"],
    ["Valor estimado", money.format(stockValue), "Baseado em compras importadas"],
    ["Entradas", entries.length, "NF-e em que a empresa é destinatária"],
    ["Saídas", exits.length, "XML de venda dará baixa automática"],
  ];

  document.getElementById("kpi-grid").innerHTML = cards.map(([label, value, hint]) => `
    <article class="kpi-card">
      <span>${label}</span>
      <strong>${value}</strong>
      <small>${hint}</small>
    </article>
  `).join("");
}

function renderMovements() {
  const rows = state.movements.slice(0, 8).map((movement) => `
    <tr>
      <td>${formatDate(movement.date)}</td>
      <td class="${movement.type === "entrada" ? "positive" : "negative"}">${movement.type}</td>
      <td>${movement.product}</td>
      <td>${number.format(movement.quantity)} ${movement.unit}</td>
      <td>NF-e ${movement.documentNumber}<br><small>${maskKey(movement.documentKey)}</small></td>
    </tr>
  `);

  document.getElementById("movement-rows").innerHTML = rows.join("") || emptyRow(5, "Nenhuma movimentação importada ainda.");
}

function renderStock() {
  const rows = Object.values(state.products).map((product) => {
    const average = product.documents ? product.totalCost / Math.max(product.stock, 1) : 0;
    return `
      <tr>
        <td><strong>${product.description}</strong></td>
        <td>${product.ean}</td>
        <td>${product.eanTrib}</td>
        <td>${product.ncm || "-"}</td>
        <td>${product.cest || "-"}</td>
        <td>${number.format(product.stock)} ${product.uTrib || "un"}</td>
        <td>${money.format(average)}</td>
      </tr>
    `;
  });

  document.getElementById("stock-rows").innerHTML = rows.join("") || emptyRow(7, "Importe uma NF-e de entrada para formar o estoque fiscal.");
}

function renderProducts() {
  const cards = Object.values(state.products).map((product) => `
    <article class="product-card">
      <strong>${product.description}</strong>
      <span>${product.eanTrib}</span>
      <small>EAN comercial ${product.ean} · NCM ${product.ncm || "-"} · CEST ${product.cest || "-"}</small>
    </article>
  `);

  document.getElementById("product-cards").innerHTML = cards.join("") || `<p class="empty-state">O cadastro mestre será criado automaticamente pelo GTIN/EAN dos XMLs.</p>`;
}

function renderDocuments() {
  const rows = state.documents.map((doc) => `
    <tr>
      <td class="${doc.type === "entrada" ? "positive" : "negative"}">${doc.type}</td>
      <td>${doc.number}/${doc.series}</td>
      <td>${formatDate(doc.issuedAt)}</td>
      <td>${doc.participant}</td>
      <td>${maskKey(doc.key)}</td>
      <td>${money.format(doc.total)}</td>
    </tr>
  `);

  document.getElementById("document-rows").innerHTML = rows.join("") || emptyRow(6, "Nenhum documento fiscal importado.");
}

function renderImportResult(doc) {
  document.getElementById("import-result").innerHTML = `
    <div class="section-heading">
      <span>XML processado</span>
      <h2>NF-e ${doc.number}/${doc.series} importada como ${doc.type}</h2>
    </div>
    <div class="result-grid">
      <div><span>Chave</span><strong>${maskKey(doc.key)}</strong></div>
      <div><span>Participante</span><strong>${doc.participant}</strong></div>
      <div><span>Data</span><strong>${formatDate(doc.issuedAt)}</strong></div>
      <div><span>Total</span><strong>${money.format(doc.total)}</strong></div>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Produto</th>
            <th>CFOP</th>
            <th>Compra</th>
            <th>Tributável</th>
            <th>Conversão</th>
            <th>Tributos extraídos</th>
          </tr>
        </thead>
        <tbody>
          ${doc.items.map((item) => `
            <tr>
              <td><strong>${item.description}</strong><br><small>EAN ${item.ean} · EAN Trib. ${item.eanTrib}</small></td>
              <td>${item.cfop}</td>
              <td>${number.format(item.qCom)} ${item.uCom}</td>
              <td>${number.format(item.qTrib)} ${item.uTrib}</td>
              <td>${number.format(item.conversion)} ${item.uTrib}/${item.uCom}</td>
              <td>ICMS ${item.tax.vICMS || "-"} · ST ${item.tax.vICMSST || "-"} · PIS ${item.tax.vPIS || "-"} · COFINS ${item.tax.vCOFINS || "-"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function emptyRow(cols, message) {
  return `<tr><td colspan="${cols}" class="empty-state">${message}</td></tr>`;
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pt-BR");
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 3600);
}

document.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach((item) => item.classList.remove("active"));
    document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
    button.classList.add("active");
    document.getElementById(button.dataset.view).classList.add("active");
    document.getElementById("view-title").textContent = button.textContent;
  });
});

document.getElementById("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = document.getElementById("login-email").value.trim().toLowerCase();
  const password = document.getElementById("login-password").value;

  if (supabaseReady && supabaseClient) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      showToast("E-mail ou senha inválidos.");
      return;
    }

    state.auth.email = data.user.email || email;
    state.auth.loggedIn = true;
    state.auth.mustChangePassword = Boolean(data.user.user_metadata?.must_change_password) || password === "456070";
    await loadRemoteState();
    state.auth.loggedIn = true;
    state.auth.mustChangePassword = state.auth.mustChangePassword || password === "456070";
    saveState();
    renderAuth();
    render();

    if (state.auth.mustChangePassword) {
      showToast("Crie uma nova senha para concluir o primeiro acesso.");
      document.getElementById("new-password").focus();
      return;
    }

    showToast(`Sessão iniciada para ${state.auth.email}.`);
    return;
  }

  const passwordHash = await hashPassword(password);

  if (email !== state.auth.email || passwordHash !== state.auth.passwordHash) {
    showToast("E-mail ou senha inválidos.");
    return;
  }

  state.auth.loggedIn = true;
  saveState();
  renderAuth();

  if (state.auth.mustChangePassword) {
    showToast("Crie uma nova senha para concluir o primeiro acesso.");
    document.getElementById("new-password").focus();
    return;
  }

  showToast(`Sessão iniciada para ${state.auth.email}.`);
});

document.getElementById("password-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const newPassword = document.getElementById("new-password").value;
  const confirmPassword = document.getElementById("confirm-password").value;

  if (newPassword.length < 6) {
    showToast("Use uma senha com pelo menos 6 caracteres.");
    return;
  }

  if (newPassword !== confirmPassword) {
    showToast("As senhas não conferem.");
    return;
  }

  if (supabaseReady && supabaseClient) {
    const { error } = await supabaseClient.auth.updateUser({
      password: newPassword,
      data: { must_change_password: false },
    });

    if (error) {
      showToast("Não consegui salvar a nova senha no servidor.");
      return;
    }
  }

  state.auth.passwordHash = await hashPassword(newPassword);
  state.auth.mustChangePassword = false;
  state.auth.loggedIn = true;
  saveState();
  renderAuth();
  showToast("Senha alterada. A plataforma está liberada.");
});

document.getElementById("logout-button").addEventListener("click", () => {
  if (supabaseReady && supabaseClient) {
    supabaseClient.auth.signOut();
  }
  state.auth.loggedIn = false;
  saveState();
  renderAuth();
  showToast("Sessão encerrada.");
});

document.getElementById("choose-file").addEventListener("click", () => {
  document.getElementById("xml-input").click();
});

document.getElementById("xml-input").addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (file) readFile(file);
  event.target.value = "";
});

document.getElementById("load-sample").addEventListener("click", () => {
  try {
    importNfe(SAMPLE_XML, "Amostra CRBS Ambev");
    showToast("XML da Ambev importado. O estoque fiscal foi atualizado.");
  } catch (error) {
    showToast(error.message);
  }
});

const dropZone = document.getElementById("drop-zone");
["dragenter", "dragover"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add("dragging");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove("dragging");
  });
});

dropZone.addEventListener("drop", (event) => {
  const file = event.dataTransfer.files[0];
  if (file) readFile(file);
});

function readFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const doc = importNfe(String(reader.result), file.name);
      showToast(`NF-e ${doc.number}/${doc.series} importada com sucesso.`);
    } catch (error) {
      showToast(error.message);
    }
  };
  reader.readAsText(file);
}

let deferredInstallPrompt;
const installButton = document.getElementById("install-button");

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installButton.hidden = false;
});

installButton.addEventListener("click", async () => {
  if (!deferredInstallPrompt) {
    showToast("No iPhone, use Compartilhar e depois Adicionar à Tela de Início.");
    return;
  }

  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installButton.hidden = true;
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

renderAuth();
render();
initSupabase();
