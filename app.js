// CapyDeal - front-end em JS puro
// Usa a Gemini API 2.5 Flash com Google Search + Google Maps via REST (Google AI Studio).
// Tudo fica no navegador - nenhum servidor proprio.

// ----------------- Referencias de DOM -----------------
const form = document.getElementById("search-form");
const loadingEl = document.getElementById("loading");
const resultsEl = document.getElementById("results");
const answerEl = document.getElementById("ai-answer");
const sourcesListEl = document.getElementById("sources-list");
const statusEl = document.getElementById("status-indicator");
const btnRun = document.getElementById("btn-run");
const btnClear = document.getElementById("btn-clear");
const btnDownload = document.getElementById("btn-download");
const onlyNearbyCheckbox = document.getElementById("only-nearby");
const includeSimilarCheckbox = document.getElementById("include-similar");
const locationField = document.getElementById("location-field");
const btnRerunWithWatchlist = document.getElementById("btn-rerun-with-watchlist");
const btnExportCsv = document.getElementById("btn-export-csv");
const btnClearWatchlist = document.getElementById("btn-clear-watchlist");

// Blocos de resposta formatada
const mainHighlightEl = document.getElementById("ai-main-highlight");
const notesEl = document.getElementById("ai-notes");

// Tema
const themeToggleBtn = document.getElementById("btn-theme-toggle");
const themeLabel = themeToggleBtn?.querySelector(".theme-label");

// Modal API
const apiModal = document.getElementById("api-modal");
const apiModalMessage = document.getElementById("api-modal-message");
const apiModalInput = document.getElementById("api-key-modal");
const apiSaveContinue = document.getElementById("api-save-continue");
const apiCancel = document.getElementById("api-cancel");
const apiOpenButton = document.getElementById("btn-open-api-modal");

// Modal Pro (Legado/Informativo)
const proModal = document.getElementById("pro-modal");
const proClose = document.getElementById("pro-close");
const proDevActivate = document.getElementById("pro-dev-activate");

// Modal Black Friday (Novo)
const promoModal = document.getElementById("promo-modal");
const promoClose = document.getElementById("promo-close");

// ----------------- Plano / Monetizacao -----------------
// Na Black Friday, o limite e ignorado pois o PRO e forcado.
const FREE_SEARCH_LIMIT = 999999; 
const SEARCH_COUNT_KEY = "capydeal_search_count_v1";
const PRO_KEY = "capydeal_is_pro_v1";

let isProFlag = true; // FORCE PRO: Comeca como true
let searchCount = 0;

// estado geral
let apiKeyMemory = null;
let pendingApiResolver = null;
let lastResultRawText = "";
let currentWatchlist = null;

// ----------------- Tema (claro/escuro) -----------------
const THEME_KEY = "capydeal_theme_v1";

function applyTheme(theme) {
  if (theme === "dark") {
    document.body.classList.add("theme-dark");
    if (themeLabel) themeLabel.textContent = "Claro";
  } else {
    document.body.classList.remove("theme-dark");
    if (themeLabel) themeLabel.textContent = "Escuro";
  }
}

function loadTheme() {
  const stored = localStorage.getItem(THEME_KEY) || "light";
  applyTheme(stored);
}

function toggleTheme() {
  const isDark = document.body.classList.contains("theme-dark");
  const next = isDark ? "light" : "dark";
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
}

if (themeToggleBtn) {
  themeToggleBtn.addEventListener("click", toggleTheme);
}

loadTheme();

// ----------------- Helpers de plano -----------------
function isPro() {
  return true; // FORCE PRO: Sempre retorna true
}

function setPro(value) {
  isProFlag = true;
  localStorage.setItem(PRO_KEY, "1");
  updateProUI();
}

function incrementSearchCount() {
  // Nao faz nada na Black Friday pois e tudo liberado
  searchCount += 1;
  localStorage.setItem(SEARCH_COUNT_KEY, String(searchCount));
}

function updateProUI() {
  const pro = isPro();
  document.body.classList.toggle("is-pro", pro);

  // Como o PRO esta liberado, removemos as travas visuais
  if (onlyNearbyCheckbox) {
    onlyNearbyCheckbox.disabled = false;
  }
  
  // O campo de localizacao aparece se o checkbox estiver marcado
  if (locationField) {
    locationField.style.display = onlyNearbyCheckbox.checked ? "block" : "none";
  }

  if (btnRerunWithWatchlist) {
    const hasWatchlist = currentWatchlist &&
      Array.isArray(currentWatchlist.offers) &&
      currentWatchlist.offers.length > 0;
    // Habilita se tiver watchlist, ja que Pro e true
    btnRerunWithWatchlist.disabled = !hasWatchlist;
  }
}

// ----------------- Utilidades de status -----------------
function setStatus(mode, message) {
  statusEl.textContent = message;
  statusEl.classList.remove("status-idle", "status-running", "status-error");
  if (mode === "running") statusEl.classList.add("status-running");
  else if (mode === "error") statusEl.classList.add("status-error");
  else statusEl.classList.add("status-idle");
}

function resetUI() {
  loadingEl.classList.add("hidden");
  resultsEl.classList.add("hidden");
  answerEl.innerHTML = "";
  if (mainHighlightEl) mainHighlightEl.innerHTML = "";
  if (notesEl) notesEl.innerHTML = "";
  sourcesListEl.innerHTML = "";
  setStatus("idle", "Aguardando consulta...");
  lastResultRawText = "";
  btnDownload.disabled = true;
  const existing = loadWatchlist();
  renderWatchlistPanel(existing);
}

async function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    try {
      await navigator.serviceWorker.register("/service-worker.js");
    } catch { }
  }
}

function updateNetworkStatus() {
  if (!navigator.onLine) {
    setStatus("error", "Sem conexao. Alguns recursos podem nao funcionar.");
    return;
  }
  if (!statusEl.classList.contains("status-running")) {
    setStatus("idle", "Aguardando consulta...");
  }
}

// ----------------- Modal da API -----------------
function openApiModal(message) {
  if (message) {
    apiModalMessage.innerHTML = message;
  }
  apiModal.classList.remove("hidden");
  setTimeout(() => apiModalInput.focus(), 50);
}

function closeApiModal() {
  apiModal.classList.add("hidden");
  apiModalInput.value = "";
  apiModalMessage.innerHTML =
    'Para usar a CapyDeal, cole abaixo sua <strong>GEMINI_API_KEY</strong> gerada no Google AI Studio.';
}

async function getApiKeyOrAsk() {
  if (apiKeyMemory) return apiKeyMemory;
  return new Promise((resolve) => {
    pendingApiResolver = resolve;
    openApiModal(
      "Para usar a CapyDeal, cole abaixo sua <strong>GEMINI_API_KEY</strong>."
    );
  });
}

if (apiOpenButton) {
  apiOpenButton.addEventListener("click", () => {
    pendingApiResolver = null;
    openApiModal();
  });
}

if (apiSaveContinue) {
  apiSaveContinue.addEventListener("click", () => {
    const key = apiModalInput.value.trim();
    if (!key) {
      alert("Cole sua GEMINI_API_KEY para continuar.");
      return;
    }
    apiKeyMemory = key;
    localStorage.setItem("capydeal_gemini_api_key", key);
    closeApiModal();
    if (pendingApiResolver) {
      pendingApiResolver(key);
      pendingApiResolver = null;
    }
  });
}

if (apiCancel) {
  apiCancel.addEventListener("click", () => {
    closeApiModal();
    if (pendingApiResolver) {
      pendingApiResolver(null);
      pendingApiResolver = null;
    }
  });
}

if (apiModal) {
  apiModal.addEventListener("click", (e) => {
    if (e.target === apiModal || e.target.classList.contains("modal-backdrop")) {
      if (apiCancel) apiCancel.click();
    }
  });
}

// ----------------- Modal do Modo Pro (Legado) -----------------
function openProModal() {
  if (!proModal) return;
  proModal.classList.remove("hidden");
}

function closeProModal() {
  if (!proModal) return;
  proModal.classList.add("hidden");
}

if (proClose) {
  proClose.addEventListener("click", closeProModal);
}

if (proDevActivate) {
  proDevActivate.addEventListener("click", () => {
    setPro(true);
    closeProModal();
  });
}

if (proModal) {
  proModal.addEventListener("click", (e) => {
    if (e.target === proModal || e.target.classList.contains("modal-backdrop")) {
      closeProModal();
    }
  });
}

// ----------------- Modal Promo Black Friday -----------------
function openPromoModal() {
  if (!promoModal) return;
  // Verifica se ja viu o banner nesta sessao (opcional, aqui mostramos sempre no refresh)
  const hasSeen = sessionStorage.getItem("capydeal_seen_promo");
  if (!hasSeen) {
    promoModal.classList.remove("hidden");
    sessionStorage.setItem("capydeal_seen_promo", "true");
  }
}

function closePromoModal() {
  if (!promoModal) return;
  promoModal.classList.add("hidden");
}

if (promoClose) {
  promoClose.addEventListener("click", closePromoModal);
}

if (promoModal) {
  promoModal.addEventListener("click", (e) => {
    if (e.target === promoModal || e.target.classList.contains("modal-backdrop")) {
      closePromoModal();
    }
  });
}

// ----------------- Eventos UI basicos -----------------
if (btnClear) {
  btnClear.addEventListener("click", () => {
    form.reset();
    resetUI();
  });
}

if (onlyNearbyCheckbox) {
  onlyNearbyCheckbox.addEventListener("change", () => {
    // PRO liberado: nao bloqueia mais
    if (locationField) {
      locationField.style.display = onlyNearbyCheckbox.checked ? "block" : "none";
    }
  });
}

if (btnDownload) {
  btnDownload.addEventListener("click", () => {
    if (!lastResultRawText) return;
    const blob = new Blob([lastResultRawText], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const now = new Date();
    const stamp = now.toISOString().slice(0, 19).replace(/[:T]/g, "-");
    a.href = url;
    a.download = `capydeal-busca-${stamp}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}

// ----------------- Submissao principal -----------------
form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const product = document.getElementById("product").value.trim();
  const budget = document.getElementById("budget").value.trim();
  const preferredStoresRaw = document
    .getElementById("preferred-stores")
    .value.trim();
  const location = document.getElementById("location").value.trim();
  const onlyNearby = onlyNearbyCheckbox.checked;
  const includeSimilar = includeSimilarCheckbox.checked;

  if (!product) {
    alert("Descreva o produto, modelo ou marca que voce quer encontrar.");
    return;
  }

  // PRO Liberado: removemos o check de limite
  
  const apiKey = await getApiKeyOrAsk();
  if (!apiKey) {
    setStatus("idle", "Busca cancelada: nenhuma chave de API informada.");
    loadingEl.classList.add("hidden");
    return;
  }

  const preferredStores = preferredStoresRaw
    ? preferredStoresRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
    : [];

  setStatus("running", "Chamando Gemini 2.5 Flash com Google Search & Maps...");
  loadingEl.classList.remove("hidden");
  resultsEl.classList.add("hidden");
  answerEl.innerHTML = "";
  if (mainHighlightEl) mainHighlightEl.innerHTML = "";
  if (notesEl) notesEl.innerHTML = "";
  sourcesListEl.innerHTML = "";
  btnDownload.disabled = true;

  try {
    const onlyNearbyEffective = onlyNearby; // Sempre true se checkbox marcado, pois Pro e true

    const userPrompt = buildPrompt({
      product,
      budget,
      preferredStores,
      location,
      onlyNearby: onlyNearbyEffective,
      includeSimilar,
    });

    const parts = [{ text: userPrompt }];

    let latLng = null;
    if (onlyNearbyEffective) {
      latLng = await getBrowserLocation();
    }

    const body = {
      contents: [
        {
          role: "user",
          parts,
        },
      ],
      tools: [{ google_search: {} }, { googleMaps: {} }],
    };

    if (latLng) {
      body.toolConfig = {
        retrievalConfig: {
          latLng,
        },
      };
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Erro na API Gemini:", errorText);
      throw new Error(
        "Falha na chamada da API Gemini. Veja o console para detalhes."
      );
    }

    const data = await response.json();
    if (!data || !Array.isArray(data.candidates) || !data.candidates.length) {
      throw new Error("Resposta vazia ou invalida da IA.");
    }
    renderResponse(data);
  } catch (err) {
    console.error(err?.message || err, err?.stack || "");
    setStatus("error", "Erro ao consultar a IA. Veja o console para detalhes.");
  } finally {
    loadingEl.classList.add("hidden");
  }
});

// ----------------- Prompt CapyDeal -----------------
function buildPrompt(opts) {
  const {
    product, budget, preferredStores, location, onlyNearby, includeSimilar,
  } = opts;

  let prompt = `
Voce e a CapyDeal, agente especialista em busca de precos, comparacao de aparelhos e caca de boas oportunidades.

OBJETIVO:
- Encontrar o(s) melhor(es) aparelhos que atendam ao pedido do usuario.
- Mostrar primeiro uma tabela de ofertas (loja, aparelho, tipo, preco, link).
- Considerar tanto o modelo exato quanto modelos semelhantes, respeitando o orcamento quando informado.

FORMATO DA RESPOSTA (OBRIGATORIO, NESSA ORDEM):

1. Uma tabela em Markdown logo no inicio, com as colunas EXACTAMENTE assim:
| Loja | Produto/Modelo | Tipo (online/fisica/proxima) | Preco | Link |

2. Um bloco com heading de nivel 2:
## Resumo do produto e recomendacao principal
- Explique em poucas linhas qual e a melhor opcao para o usuario e por que (custo/beneficio, marca, garantia, assistencia no Brasil etc.).

3. Um bloco com heading de nivel 2:
## Modelos semelhantes dentro do orcamento
- Liste, se existirem, 2 a 6 alternativas bem proximas em configuracao e faixa de preco, explicando em bullet points quando faz sentido escolher cada uma.
- Se o usuario nao ativou modelos semelhantes, explique brevemente que esta focando no modelo mais proximo possivel do pedido principal.

4. Um bloco com heading de nivel 2:
## Notas e cuidados
- Alerte sobre lojas muito desconhecidas, avaliacoes ruins, fretes abusivos, golpes comuns e politicas de troca/garantia.

REGRAS GERAIS:
- Use sempre portugues do Brasil.
- Use Google Search e Google Maps para obter dados atualizados de precos e lojas.
- Priorize resultados do Brasil, em R$.
- Inclua links completos de lojas sempre que possivel.
- Seja direta, mas explique POR QUE determinado aparelho parece a melhor escolha.
- Se nao encontrar o modelo exato, deixe isso claro e traga modelos semelhantes em configuracao/preco e posicione o modelo exato mesmo assim na tabela (se existir, mesmo acima do orcamento).`.trim();

  prompt += `

Contexto da busca:
- Pedido principal do usuario: "${product}".`;

  if (budget) {
    prompt += `
- Orcamento previsto aproximado: R$ ${budget}.`;
  } else {
    prompt += `
- Orcamento nao informado. Considere faixas de preco tipicas para o tipo de produto.`;
  }

  if (preferredStores && preferredStores.length) {
    prompt += `
- Lojas preferenciais informadas: ${preferredStores.join(
      ", "
    )}. Priorize essas lojas quando elas tiverem boas ofertas.`;
  } else {
    prompt += `
- Nenhuma loja preferencial especifica informada.`;
  }

  if (location) {
    prompt += `
- Localizacao de referencia textual: "${location}".`;
  }

  prompt += `
- Priorizar lojas proximas: ${onlyNearby ? "SIM" : "NAO"}.`;
  prompt += `
- Incluir modelos semelhantes dentro do orcamento: ${includeSimilar ? "SIM" : "NAO"} (se NAO, foque apenas no modelo exato ou o mais proximo possivel).`;

  if (currentWatchlist &&
    Array.isArray(currentWatchlist.offers) &&
    currentWatchlist.offers.length) {
    prompt += `
Historico de lojas ja vistas em buscas anteriores para este usuario (pode reaproveitar essas lojas se ainda fizerem sentido):
${JSON.stringify(currentWatchlist, null, 2)}
`;
  }

  prompt += `
INSTRUCOES SOBRE SEMELHANCA:
- Quando "incluir modelos semelhantes" estiver ativo, e nao houver muitas opcoes do modelo exato:
  - Use o orcamento e o tipo de produto para sugerir aparelhos de configuracao equivalente (mesma categoria, processador similar, mesma faixa de RAM/armazenamento, etc.).
  - Mantenha sempre na tabela o modelo exato pedido (se existir), mesmo se ele estiver acima do orcamento, indicando isso na descricao.

JSON DE WATCHLIST (OBRIGATORIO NO FINAL):
No final da resposta, adicione um bloco de codigo contendo APENAS um JSON chamado "watchlist", no formato:

\`\`\`json
{
  "productCanonicalName": "nome normalizado do produto principal",
  "currency": "BRL",
  "offers": [
    {
      "storeId": "slug-unico-da-loja",
      "storeName": "Nome da Loja",
      "url": "https://link-da-oferta-ou-da-loja",
      "isOnline": true,
      "isPhysical": false,
      "price": 1234.56,
      "priceText": "R$ 1.234,56 a vista ou em X vezes",
      "productName": "Nome completo do produto/modelo",
      "notes": "Observacoes uteis como frete, prazo, avaliacao media, selo oficial etc."
    }
  ]
}
\`\`\`

Regras para esse JSON:
- Nao explique esse JSON.
- Nao coloque texto depois dele.
- Se nao encontrar lojas confiaveis, retorne "offers": [] nesse JSON.
- Nao invente campos alem dos definidos acima, para manter o parse simples.
`;

  return prompt;
}

// ----------------- Renderizacao da resposta -----------------
function splitSectionsFromMarkdown(md) {
  if (!md) return { main: "", notes: "", full: "" };
  const withoutJson = md.replace(/```json[\s\S]*?```/gi, "").trim();
  const parts = withoutJson.split(/(?=##\s)/);

  let main = "";
  let notes = "";
  let full = withoutJson;

  for (const block of parts) {
    const lower = block.toLowerCase();
    if (!main && lower.startsWith("## resumo do produto")) {
      main = block.trim();
    } else if (!notes && lower.startsWith("## notas e cuidados")) {
      notes = block.trim();
    }
  }

  return { main, notes, full };
}

function renderResponse(data) {
  const candidate = data.candidates && data.candidates[0];
  const parts = candidate && candidate.content && candidate.content.parts
    ? candidate.content.parts
    : [];
  const text = parts
    .filter((p) => p.text)
    .map((p) => p.text)
    .join("");

  lastResultRawText = text || "";
  btnDownload.disabled = !lastResultRawText;

  const watchlistFromAI = extractWatchlistFromText(text);
  if (watchlistFromAI && Array.isArray(watchlistFromAI.offers)) {
    saveWatchlist(watchlistFromAI);
    renderWatchlistPanel(watchlistFromAI);
  } else {
    const existing = loadWatchlist();
    renderWatchlistPanel(existing);
  }

  const { main, notes, full } = splitSectionsFromMarkdown(text || "");

  if (mainHighlightEl) {
    mainHighlightEl.innerHTML = markdownToHtml(main || "");
  }

  answerEl.innerHTML = markdownToHtml(full || "Nenhum texto retornado.");

  if (notesEl) {
    notesEl.innerHTML = markdownToHtml(notes || "");
  }

  applyFreeTierTableLimit();

  // Sem contagem na black friday
  // if (!isPro()) { incrementSearchCount(); }

  setStatus("idle", "Consulta concluida.");
  resultsEl.classList.remove("hidden");

  sourcesListEl.innerHTML = "";
  const grounding = candidate && candidate.groundingMetadata
    ? candidate.groundingMetadata
    : null;

  if (grounding && grounding.groundingChunks && grounding.groundingChunks.length) {
    const added = new Set();
    grounding.groundingChunks.forEach((chunk) => {
      if (chunk.web && chunk.web.uri) {
        const key = chunk.web.uri;
        if (added.has(key)) return;
        added.add(key);
        addSourceItem(chunk.web.title || chunk.web.uri, chunk.web.uri);
      } else if (chunk.maps && chunk.maps.uri) {
        const key = chunk.maps.uri;
        if (added.has(key)) return;
        added.add(key);
        addSourceItem(chunk.maps.title || "Lugar no Google Maps", chunk.maps.uri);
      }
    });
  } else {
    const li = document.createElement("li");
    li.textContent =
      "Nenhuma fonte explicita retornada pela API (pode ser conhecimento interno do modelo).";
    sourcesListEl.appendChild(li);
  }
}

// ----------------- Modo Sentinela: storage & UI -----------------
const WATCHLIST_STORAGE_KEY = "capydeal_watchlist_v1";

function loadWatchlist() {
  try {
    const raw = localStorage.getItem(WATCHLIST_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.offers)) return null;
    currentWatchlist = parsed;
    return parsed;
  } catch (err) {
    console.warn("Falha ao carregar watchlist do localStorage:", err);
    return null;
  }
}

function saveWatchlist(watchlist) {
  try {
    if (!watchlist || !Array.isArray(watchlist.offers)) return;
    currentWatchlist = watchlist;
    localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(watchlist));
  } catch (err) {
    console.warn("Falha ao salvar watchlist no localStorage:", err);
  }
}

function clearWatchlist() {
  try {
    localStorage.removeItem(WATCHLIST_STORAGE_KEY);
    currentWatchlist = null;
    if (btnExportCsv) btnExportCsv.disabled = true;
    if (btnClearWatchlist) btnClearWatchlist.disabled = true;
    if (btnRerunWithWatchlist) btnRerunWithWatchlist.disabled = true;
    renderWatchlistPanel(null);
  } catch (err) {
    console.warn("Falha ao limpar watchlist:", err);
  }
}

function extractWatchlistFromText(text) {
  if (!text) return null;
  const regex = /```json([\s\S]*?)```/gi;
  let match;
  let lastJsonBlock = null;
  while ((match = regex.exec(text)) !== null) {
    lastJsonBlock = match[1];
  }

  if (!lastJsonBlock) {
    console.warn("Nenhum bloco ```json encontrado na resposta da IA.");
    return null;
  }

  let jsonString = lastJsonBlock.trim();
  const firstBrace = jsonString.indexOf("{");
  const lastBrace = jsonString.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    jsonString = jsonString.slice(firstBrace, lastBrace + 1);
  }

  try {
    const parsed = JSON.parse(jsonString);
    console.log("Watchlist extraida da IA:", parsed);
    return parsed;
  } catch (err) {
    console.warn(
      "Falha ao parsear JSON de watchlist:",
      err,
      "Bloco bruto:",
      jsonString
    );
    return null;
  }
}

function renderWatchlistPanel(watchlist) {
  const panel = document.getElementById("watchlist-panel");
  const listEl = document.getElementById("watchlist-list");
  const emptyEl = document.getElementById("watchlist-empty");
  if (!panel || !listEl || !emptyEl) return;

  listEl.innerHTML = "";
  
  const hasOffers = watchlist &&
    Array.isArray(watchlist.offers) &&
    watchlist.offers.length > 0;

  if (!hasOffers) {
    emptyEl.style.display = "block";
    if (btnRerunWithWatchlist) btnRerunWithWatchlist.disabled = true;
    if (btnExportCsv) btnExportCsv.disabled = true;
    if (btnClearWatchlist) btnClearWatchlist.disabled = true;
    return;
  }

  emptyEl.style.display = "none";
  currentWatchlist = watchlist;
  
  // Na black, Pro sempre ativo, entao habilita sempre
  if (btnRerunWithWatchlist) {
    btnRerunWithWatchlist.disabled = false; 
  }
  if (btnExportCsv) {
    btnExportCsv.disabled = false;
  }
  if (btnClearWatchlist) {
    btnClearWatchlist.disabled = false;
  }

  watchlist.offers.forEach((offer) => {
    const li = document.createElement("li");
    li.className = "watchlist-item";

    const header = document.createElement("div");
    header.className = "watchlist-item-header";

    const title = document.createElement("div");
    title.className = "watchlist-title";
    title.textContent = offer.storeName || "(Loja sem nome)";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "watchlist-select";
    checkbox.dataset.storeId = offer.storeId || offer.storeName || "";

    header.appendChild(title);
    header.appendChild(checkbox);

    const meta = document.createElement("div");
    meta.className = "watchlist-meta";
    const tipos = [];
    if (offer.isOnline) tipos.push("online");
    if (offer.isPhysical) tipos.push("fisica");
    const tipoLabel = tipos.length ? tipos.join(" + ") : "tipo nao definido";
    const priceLabel = typeof offer.price === "number"
      ? `Preco: R$ ${offer.price.toFixed(2)}`
      : offer.priceText
        ? `Preco: ${offer.priceText}`
        : "Preco nao identificado";
    meta.textContent = `${tipoLabel} - ${priceLabel}`;

    const productInfo = document.createElement("div");
    productInfo.className = "watchlist-meta";
    productInfo.textContent = offer.productName || "";

    li.appendChild(header);
    li.appendChild(meta);
    if (offer.productName) {
      li.appendChild(productInfo);
    }

    if (offer.url) {
      const link = document.createElement("a");
      link.href = offer.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.className = "watchlist-link";
      link.textContent = "Abrir loja";
      li.appendChild(link);
    }

    listEl.appendChild(li);
  });
}

// ----------------- Exportar Watchlist como CSV -----------------
function exportWatchlistToCsv() {
  if (!currentWatchlist || !Array.isArray(currentWatchlist.offers) || !currentWatchlist.offers.length) {
    alert("Nenhuma oferta na watchlist para exportar.");
    return;
  }

  const headers = [
    "Loja",
    "Produto",
    "Preco",
    "Tipo",
    "URL",
    "Notas"
  ];

  const escapeCell = (value) => {
    if (value === null || value === undefined) return '""';
    const str = String(value);
    const escaped = str.replace(/"/g, '""');
    return '"' + escaped + '"';
  };

  const rows = currentWatchlist.offers.map((offer) => {
    const tipo = [];
    if (offer.isOnline) tipo.push("online");
    if (offer.isPhysical) tipo.push("fisica");
    const tipoStr = tipo.join(" + ") || "nao definido";

    let preco = "";
    if (typeof offer.price === "number" && !isNaN(offer.price)) {
      preco = "R$ " + offer.price.toFixed(2).replace(".", ",");
    } else if (offer.priceText) {
      preco = offer.priceText;
    }

    return [
      escapeCell(offer.storeName || ""),
      escapeCell(offer.productName || ""),
      escapeCell(preco),
      escapeCell(tipoStr),
      escapeCell(offer.url || ""),
      escapeCell(offer.notes || "")
    ].join(",");
  });

  const headerRow = headers.map(h => '"' + h + '"').join(",");
  const csvContent = [headerRow, ...rows].join("\n");
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const now = new Date();
  const stamp = now.toISOString().slice(0, 10);
  const productName = currentWatchlist.productCanonicalName
    ? currentWatchlist.productCanonicalName.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30)
    : "watchlist";
  
  a.href = url;
  a.download = `capydeal-${productName}-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

if (btnExportCsv) {
  btnExportCsv.addEventListener("click", exportWatchlistToCsv);
}

if (btnClearWatchlist) {
  btnClearWatchlist.addEventListener("click", () => {
    if (confirm("Tem certeza que deseja limpar toda a watchlist?")) {
      clearWatchlist();
    }
  });
}

// Botao: refazer busca priorizando lojas marcadas (so Pro)
if (btnRerunWithWatchlist) {
  btnRerunWithWatchlist.addEventListener("click", () => {
    // PRO Liberado
    const checkboxes = Array.from(
      document.querySelectorAll(".watchlist-select:checked")
    );
    const selectedNames = checkboxes
      .map((cb) => cb
        .closest(".watchlist-item")
        ?.querySelector(".watchlist-title")
        ?.textContent.trim()
      )
      .filter(Boolean);

    const preferredInput = document
      .getElementById("preferred-stores")
      .value.trim();
    let combined = preferredInput;
    if (selectedNames.length) {
      const extra = selectedNames.join(", ");
      combined = combined ? combined + ", " + extra : extra;
    }

    document.getElementById("preferred-stores").value = combined;
    form.requestSubmit();
  });
}

// ----------------- Fontes, localizacao e markdown -----------------
function addSourceItem(title, url) {
  const li = document.createElement("li");
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.textContent = title;
  li.appendChild(a);
  sourcesListEl.appendChild(li);
}

function getBrowserLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      },
      () => resolve(null),
      { timeout: 7000 }
    );
  });
}

function markdownToHtml(markdown) {
  if (!markdown) return "";
  const lines = markdown.split("\n");
  const outLines = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (/^\s*\|.*\|\s*$/.test(line) &&
      i + 1 < lines.length &&
      /^\s*\|[-:\|\s]+\|\s*$/.test(lines[i + 1])) {
      const headerLine = lines[i].trim();
      const headerCells = headerLine
        .slice(1, -1)
        .split("|")
        .map((s) => s.trim());
      i += 2;

      const bodyLines = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        bodyLines.push(lines[i].trim());
        i++;
      }

      let tableHtml = '<table class="md-table"><thead><tr>';
      headerCells.forEach((h) => {
        tableHtml += `<th>${inlineMarkdown(h)}</th>`;
      });
      tableHtml += "</tr></thead><tbody>";

      bodyLines.forEach((row) => {
        const cells = row
          .slice(1, -1)
          .split("|")
          .map((s) => s.trim());
        tableHtml += "<tr>";
        cells.forEach((c) => {
          tableHtml += `<td>${inlineMarkdown(c)}</td>`;
        });
        tableHtml += "</tr>";
      });

      tableHtml += "</tbody></table>";
      outLines.push(tableHtml);
      continue;
    }

    outLines.push(line);
    i++;
  }

  const joined = outLines.join("\n");
  let html = joined
    .replace(/^###\s+(.*)$/gim, "<h3>$1</h3>")
    .replace(/^##\s+(.*)$/gim, "<h2>$1</h2>")
    .replace(/^#\s+(.*)$/gim, "<h1>$1</h1>");

  html = html
    .replace(/^\s*[-*]\s+(.*)$/gim, "<ul><li>$1</li></ul>")
    .replace(/<\/ul>\s*<ul>/gim, "");

  html = html
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return "";
      if (/^<\/?(h[1-6]|ul|li|table|thead|tbody|tr|th|td)\b/i.test(trimmed)) {
        return trimmed;
      }
      return `<p>${inlineMarkdown(trimmed)}</p>`;
    })
    .join("");

  return html;
}

function inlineMarkdown(text) {
  if (!text) return "";
  let html = text;
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );
  return html;
}

function applyFreeTierTableLimit() {
  // PRO liberado, nao aplica limite visual
  return;
}

// ----------------- Inicializacao -----------------
(function init() {
  try {
    // FORCE PRO NA INICIALIZACAO
    localStorage.setItem(PRO_KEY, "1");
    isProFlag = true;
    
    // Check de contagem mantido apenas para legado
    const storedCount = localStorage.getItem(SEARCH_COUNT_KEY);
    searchCount = storedCount ? parseInt(storedCount, 10) || 0 : 0;

    const storedApiKey = localStorage.getItem("capydeal_gemini_api_key");
    if (storedApiKey) {
      apiKeyMemory = storedApiKey;
    }

    updateProUI();
    resetUI();
    registerServiceWorker();
    updateNetworkStatus();
    
    // Tenta abrir o banner promocional
    openPromoModal();

    window.addEventListener("online", updateNetworkStatus);
    window.addEventListener("offline", updateNetworkStatus);
  } catch (err) {
    console.warn("Falha na inicializacao:", err);
  }
})();