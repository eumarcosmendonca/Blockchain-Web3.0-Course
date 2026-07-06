/* =========================================================================
 * CareChain — Lógica do dApp (frontend)
 * Conecta ao contrato via MetaMask (ethers.js v6).
 *  - LEITURAS: feitas direto no contrato (não precisam de gás).
 *  - ESCRITAS: assinadas pela carteira do usuário (MetaMask).
 * ========================================================================= */

const API_BASE = "http://localhost:3001"; // backend (indexador) — opcional
// Nomes internos (iguais ao enum do contrato; usados em classes CSS e filtros)
const STATUS = ["Ativo", "Explantado", "EmRecall", "PacienteFalecido"];
// Rótulos amigáveis exibidos na interface
const STATUS_ROTULO = ["Ativo", "Explantado", "Em recall", "Paciente falecido"];
// Converte nome interno -> rótulo amigável (ex.: "EmRecall" -> "Em recall")
function rotuloStatus(interno) {
  const i = STATUS.indexOf(interno);
  return i >= 0 ? STATUS_ROTULO[i] : interno;
}

let provider = null;
let signer = null;
let contaAtual = null;
let ehAdmin = false;
let contrato = null; // instância só-leitura (provider)
let contratoAssinado = null; // instância de escrita (signer)

// ------------------------------------------------------------------ utils
function $(sel) {
  return document.querySelector(sel);
}

function toast(msg, tipo = "info") {
  const el = document.createElement("div");
  el.className = "toast toast-" + tipo;
  el.textContent = msg;
  $("#toasts").appendChild(el);
  setTimeout(() => el.remove(), 5000);
}

function curto(addr) {
  if (!addr) return "—";
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

function hashPaciente(identificador) {
  return ethers.keccak256(ethers.toUtf8Bytes(identificador.trim()));
}

function configOk() {
  if (!window.CARECHAIN || !window.CARECHAIN.endereco) {
    toast("Contrato não configurado. Rode: npm run deploy:local", "erro");
    return false;
  }
  return true;
}

// ------------------------------------------------------------ conexão web3
async function conectar() {
  if (!window.ethereum) {
    toast("MetaMask não encontrado. Instale a extensão para continuar.", "erro");
    return;
  }
  if (!configOk()) return;

  try {
    sessionStorage.removeItem("carechain_desconectado");
    provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    signer = await provider.getSigner();
    contaAtual = (await signer.getAddress()).toLowerCase();

    contrato = new ethers.Contract(window.CARECHAIN.endereco, window.CARECHAIN.abi, provider);
    contratoAssinado = new ethers.Contract(window.CARECHAIN.endereco, window.CARECHAIN.abi, signer);

    const btn = $("#btn-conectar");
    btn.textContent = curto(contaAtual) + "  ▾";
    btn.title = "Copiar endereço, trocar de conta ou desconectar";
    await atualizarStatus();
    await detectarPapel();
    toast("Carteira conectada: " + curto(contaAtual), "ok");
  } catch (e) {
    toast("Erro ao conectar: " + (e.shortMessage || e.message), "erro");
  }
}

// ---------------------------------------------------- menu da carteira
function alternarMenu(forcar) {
  const menu = $("#menu-carteira");
  if (forcar === false) {
    menu.classList.remove("aberto");
    return;
  }
  menu.classList.toggle("aberto");
}

// Copia o endereço COMPLETO da conta conectada.
async function copiarEndereco() {
  if (!contaAtual) return;
  try {
    await navigator.clipboard.writeText(ethers.getAddress(contaAtual));
    toast("Endereço copiado: " + curto(contaAtual), "ok");
  } catch {
    // fallback para navegadores sem clipboard API em http
    const ta = document.createElement("textarea");
    ta.value = ethers.getAddress(contaAtual);
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    toast("Endereço copiado: " + curto(contaAtual), "ok");
  }
  alternarMenu(false);
}

// Abre o seletor de contas do MetaMask para trocar/conectar outra conta.
// (Trocar a conta na raposa só avisa o site se a nova conta já estiver
// conectada a ele — este botão resolve isso pedindo a permissão de novo.)
async function trocarConta() {
  if (!window.ethereum) return;
  alternarMenu(false);
  try {
    await window.ethereum.request({
      method: "wallet_requestPermissions",
      params: [{ eth_accounts: {} }],
    });
    sessionStorage.removeItem("carechain_desconectado");
    location.reload(); // recarrega; a reconexão silenciosa assume a conta escolhida
  } catch (e) {
    // usuário cancelou o popup — sem problema
    console.warn("Troca de conta cancelada:", e.message);
  }
}

// Desconecta a carteira do site: revoga a permissão no MetaMask (quando
// suportado) e grava uma flag para a reconexão automática não religar sozinha.
async function desconectar() {
  alternarMenu(false);
  try {
    await window.ethereum.request({
      method: "wallet_revokePermissions",
      params: [{ eth_accounts: {} }],
    });
  } catch (e) {
    // versões antigas do MetaMask não suportam revogar — a flag abaixo cobre isso
    console.warn("revokePermissions indisponível:", e.message);
  }
  sessionStorage.setItem("carechain_desconectado", "1");
  location.reload();
}

// Detecta se a conta é admin ou hospital credenciado.
async function detectarPapel() {
  try {
    const admin = (await contrato.admin()).toLowerCase();
    const credenciado = await contrato.hospitalCredenciado(contaAtual);
    ehAdmin = contaAtual === admin;

    const badge = $("#papel-badge");
    badge.style.display = "inline-flex";
    if (ehAdmin) {
      badge.textContent = "Administrador";
      badge.className = "chip chip-ambar";
    } else if (credenciado) {
      badge.textContent = "Hospital credenciado";
      badge.className = "chip chip-verde";
    } else {
      badge.textContent = "Visitante";
      badge.className = "chip chip-neutro";
    }
    // Aba de administração: botão "apagado" e conteúdo escondido para não-admins.
    definirAcessoAdmin(ehAdmin);
    const redeBadge = $("#rede-badge");
    redeBadge.className = "chip chip-verde";
    redeBadge.innerHTML = '<span class="dot"></span>' + (window.CARECHAIN.rede || "local");
  } catch (e) {
    console.warn("Falha ao detectar papel:", e.message);
  }
}

// Controla o acesso à aba de administração: para não-admins, o botão da aba
// fica "apagado" e o conteúdo (campos/cartões) é substituído por um aviso.
function definirAcessoAdmin(liberado) {
  const tabBtn = document.querySelector('.aba[data-aba="admin"]');
  if (tabBtn) tabBtn.classList.toggle("bloqueada", !liberado);
  const grid = document.querySelector("#aba-admin .admin-grid");
  if (grid) grid.style.display = liberado ? "" : "none";
  const bloqueio = $("#admin-bloqueio");
  if (bloqueio) bloqueio.style.display = liberado ? "none" : "flex";
  const aviso = $("#admin-aviso");
  if (aviso) aviso.style.display = liberado ? "" : "none";
}

// ------------------------------------------------------- filtros (Map)
// REQUISITO/TÉCNICA: usamos a estrutura de dados Map para agrupar e filtrar —
// a mesma ideia do mapping `registrosPorHospital` do contrato, agora no cliente.
function agruparPor(lista, chaveFn) {
  const mapa = new Map();
  for (const item of lista) {
    const chave = chaveFn(item);
    if (!mapa.has(chave)) mapa.set(chave, []);
    mapa.get(chave).push(item);
  }
  return mapa;
}

// Preenche um <select> com as chaves de um Map, preservando a seleção atual.
function popularSelect(sel, mapa, rotuloTodos, formatar) {
  const atual = sel.value;
  sel.innerHTML = `<option value="">${rotuloTodos}</option>`;
  for (const chave of mapa.keys()) {
    const opt = document.createElement("option");
    opt.value = chave;
    opt.textContent = formatar ? formatar(chave) : chave;
    sel.appendChild(opt);
  }
  if ([...mapa.keys()].includes(atual)) sel.value = atual;
}

// ------------------------------------------------------- status da rede
async function atualizarStatus() {
  // Cria um provider só-leitura mesmo sem carteira conectada (MetaMask ou RPC público).
  const p = provider || providerLeitura();
  if (!p || !configOk()) return;
  const c = contrato || new ethers.Contract(window.CARECHAIN.endereco, window.CARECHAIN.abi, p);

  try {
    const [total, hospitais, saldo, taxa, pausado] = await Promise.all([
      c.totalRegistros(),
      c.totalHospitaisCredenciados(),
      c.saldoContrato(),
      c.taxaDeRegistro(),
      c.pausado(),
    ]);
    $("#stat-total").textContent = total.toString();
    $("#stat-hospitais").textContent = hospitais.toString();
    $("#stat-saldo").textContent = ethers.formatEther(saldo) + " ETH";
    $("#stat-taxa").textContent = ethers.formatEther(taxa) + " ETH";

    // Circuit breaker contextual: mostra só o botão que faz sentido no estado atual.
    const btnPausar = $("#btn-pausar");
    const btnRetomar = $("#btn-despausar");
    if (btnPausar && btnRetomar) {
      btnPausar.style.display = pausado ? "none" : "inline-flex";
      btnRetomar.style.display = pausado ? "inline-flex" : "none";
    }
  } catch (e) {
    console.warn("Falha ao ler status:", e.message);
  }
}

// ------------------------------------------------------- registrar
async function registrar(ev) {
  ev.preventDefault();
  if (!contratoAssinado) {
    toast("Conecte a carteira primeiro.", "erro");
    return;
  }
  const paciente = $("#reg-paciente").value;
  const fabricante = $("#reg-fabricante").value;
  const modelo = $("#reg-modelo").value;
  const serie = $("#reg-serie").value;
  const dataStr = $("#reg-data").value;
  const medico = $("#reg-medico").value;

  if (!paciente || !fabricante || !modelo || !serie || !dataStr || !medico) {
    toast("Preencha todos os campos.", "erro");
    return;
  }

  const dataImplante = Math.floor(new Date(dataStr).getTime() / 1000);
  const pacienteHash = hashPaciente(paciente);

  try {
    const taxa = await contrato.taxaDeRegistro();
    toast("Confirme a transação no MetaMask…", "info");
    const tx = await contratoAssinado.registrarMarcapasso(
      pacienteHash,
      fabricante,
      modelo,
      serie,
      dataImplante,
      medico,
      { value: taxa }
    );
    await tx.wait();
    toast("Marca-passo registrado com sucesso!", "ok");
    $("#form-registrar").reset();
    await atualizarStatus();
  } catch (e) {
    toast("Falha no registro: " + (e.shortMessage || e.reason || e.message), "erro");
  }
}

// ------------------------------------------------------- consultar
function linhaRegistro(r) {
  const statusInterno = STATUS[Number(r.status)] || "?"; // p/ classe CSS e filtro
  const statusLabel = STATUS_ROTULO[Number(r.status)] || "?"; // p/ exibição
  return `<tr>
    <td>${Number(r.id)}</td>
    <td>${r.fabricante}</td>
    <td>${r.modelo}</td>
    <td class="mono">${r.numeroSerie}</td>
    <td>${new Date(Number(r.dataImplante) * 1000).toLocaleDateString("pt-BR")}</td>
    <td class="mono">${curto(r.hospital)}</td>
    <td>${r.medicoResponsavel}</td>
    <td><span class="status-pill status-${statusInterno}">${statusLabel}</span></td>
  </tr>`;
}

async function listarTodos() {
  const c = contrato || leituraSemCarteira();
  if (!c) return;
  try {
    const todos = await c.getTodosRegistros();
    renderTabela(todos);
    toast(`${todos.length} registro(s) carregado(s).`, "info");
  } catch (e) {
    toast("Erro ao listar: " + e.message, "erro");
  }
}

async function rastrearPaciente() {
  const c = contrato || leituraSemCarteira();
  if (!c) return;
  const ident = $("#busca-paciente").value;
  if (!ident) {
    toast("Digite o identificador do paciente.", "erro");
    return;
  }
  try {
    const ids = await c.getRegistrosPorPaciente(hashPaciente(ident));
    if (ids.length === 0) {
      renderTabela([]);
      toast("Nenhum dispositivo encontrado para esse paciente.", "info");
      return;
    }
    const regs = await Promise.all(ids.map((id) => c.getRegistro(id)));
    renderTabela(regs);
    toast(`${regs.length} dispositivo(s) do paciente.`, "ok");
  } catch (e) {
    toast("Erro ao rastrear: " + e.message, "erro");
  }
}

// Cache da última consulta; os filtros trabalham em cima dele, via Map.
let cacheRegistros = [];

function renderTabela(regs) {
  cacheRegistros = regs ? Array.from(regs) : [];
  atualizarOpcoesFiltros();
  aplicarFiltrosRegistros();
}

// Reconstrói as opções de Fabricante e Hospital a partir dos dados (chaves dos Maps).
function atualizarOpcoesFiltros() {
  const porFabricante = agruparPor(cacheRegistros, (r) => r.fabricante);
  const porHospital = agruparPor(cacheRegistros, (r) => r.hospital.toLowerCase());
  popularSelect($("#filtro-fabricante"), porFabricante, "Fabricante: todos");
  popularSelect($("#filtro-hospital"), porHospital, "Hospital: todos", (h) => curto(h));
}

// Aplica os filtros selecionados usando Maps de agrupamento (status → fabricante → hospital).
function aplicarFiltrosRegistros() {
  const fStatus = $("#filtro-status").value;
  const fFabricante = $("#filtro-fabricante").value;
  const fHospital = $("#filtro-hospital").value;

  let lista = cacheRegistros;
  if (fStatus) {
    const mapa = agruparPor(lista, (r) => STATUS[Number(r.status)]);
    lista = mapa.get(fStatus) || [];
  }
  if (fFabricante) {
    const mapa = agruparPor(lista, (r) => r.fabricante);
    lista = mapa.get(fFabricante) || [];
  }
  if (fHospital) {
    const mapa = agruparPor(lista, (r) => r.hospital.toLowerCase());
    lista = mapa.get(fHospital) || [];
  }

  const tbody = $("#tabela-registros tbody");
  if (!lista || lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="vazio">Nenhum registro para os filtros selecionados.</td></tr>`;
    return;
  }
  tbody.innerHTML = lista.map(linhaRegistro).join("");
}

function limparFiltros() {
  $("#filtro-status").value = "";
  $("#filtro-fabricante").value = "";
  $("#filtro-hospital").value = "";
  aplicarFiltrosRegistros();
}

// Provider só-leitura: usa o MetaMask se existir; senão, cai para o RPC público
// gravado no contract-info.js — assim a demo hospedada funciona para QUALQUER
// visitante, mesmo sem carteira instalada (as escritas continuam exigindo MetaMask).
function providerLeitura() {
  if (window.ethereum) return new ethers.BrowserProvider(window.ethereum);
  if (window.CARECHAIN && window.CARECHAIN.rpcUrl)
    return new ethers.JsonRpcProvider(window.CARECHAIN.rpcUrl);
  return null;
}

function leituraSemCarteira() {
  if (!configOk()) return null;
  const p = providerLeitura();
  if (!p) return null;
  return new ethers.Contract(window.CARECHAIN.endereco, window.CARECHAIN.abi, p);
}

// ------------------------------------------------------- rede (backend)
// Cache dos eventos; o filtro por tipo usa Map, e a exibição é do mais NOVO
// (topo) para o mais antigo (base).
let cacheEventos = [];

async function carregarEventos() {
  const cont = $("#timeline");
  try {
    const resp = await fetch(API_BASE + "/api/eventos");
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    cacheEventos = await resp.json();
    renderTimeline();
  } catch (e) {
    cont.innerHTML = `<p class="vazio">Backend indisponível (${e.message}). Rode <code>npm run backend</code> para ver a linha do tempo.</p>`;
  }
}

function renderTimeline() {
  const cont = $("#timeline");
  const filtro = $("#filtro-evento").value;

  // Filtro por tipo de evento via Map (agrupamento tipo → eventos).
  const porTipo = agruparPor(cacheEventos, (e) => e.tipo);
  const base = filtro ? porTipo.get(filtro) || [] : cacheEventos;

  if (!base.length) {
    cont.innerHTML = `<p class="vazio">Nenhum evento para o filtro selecionado.</p>`;
    return;
  }

  // Mais recentes primeiro (o backend entrega em ordem cronológica crescente).
  cont.innerHTML = base
    .slice()
    .reverse()
    .map((e) => {
      let det = "";
      if (e.tipo === "MarcapassoRegistrado")
        det = `#${e.id} · ${e.fabricante} ${e.modelo} · série ${e.numeroSerie} · hospital ${curto(e.hospital)}`;
      else if (e.tipo === "StatusAtualizado")
        det = `#${e.id} → ${rotuloStatus(e.novoStatus)} (por ${curto(e.responsavel)})`;
      else if (e.tipo === "HospitalCredenciado") det = `hospital ${curto(e.hospital)}`;
      else if (e.tipo === "RecallEmLote")
        det = `⚠ ${e.fabricante} ${e.modelo} — ${e.quantidadeAfetada} dispositivo(s) afetado(s)`;
      return `<div class="evento ${e.tipo}">
        <div>
          <div class="tipo">${e.tipo}</div>
          <div class="det">${det} · bloco ${e.bloco ?? "?"}</div>
        </div>
      </div>`;
    })
    .join("");
}

// ------------------------------------------------------- ações de admin
async function comAdmin(fn) {
  if (!contratoAssinado) {
    toast("Conecte a carteira do administrador.", "erro");
    return;
  }
  if (!ehAdmin) {
    toast("Sua carteira não é o administrador da rede.", "erro");
    return;
  }
  try {
    toast("Confirme no MetaMask…", "info");
    const tx = await fn();
    await tx.wait();
    toast("Operação concluída!", "ok");
    await atualizarStatus();
  } catch (e) {
    toast("Falha: " + (e.shortMessage || e.reason || e.message), "erro");
  }
}

function ligarAdmin() {
  $("#btn-credenciar").onclick = () =>
    comAdmin(() => contratoAssinado.credenciarHospital($("#adm-cred-endereco").value.trim()));
  $("#btn-revogar").onclick = () =>
    comAdmin(() => contratoAssinado.revogarHospital($("#adm-cred-endereco").value.trim()));
  $("#btn-taxa").onclick = () =>
    comAdmin(() => contratoAssinado.atualizarTaxa(ethers.parseEther($("#adm-taxa").value.trim())));
  $("#btn-sacar").onclick = () =>
    comAdmin(() => {
      const dest = $("#adm-saque-endereco").value.trim();
      const val = $("#adm-saque-valor").value.trim();
      if (!val) return contratoAssinado.sacarTudo(dest);
      return contratoAssinado.sacar(dest, ethers.parseEther(val));
    });
  $("#btn-status").onclick = () =>
    comAdmin(() =>
      contratoAssinado.atualizarStatus(
        Number($("#adm-recall-id").value),
        Number($("#adm-recall-status").value)
      )
    );
  // RECALL EM LOTE: uma transação marca todos os dispositivos ativos do modelo.
  $("#btn-recall-lote").onclick = () => {
    const fab = $("#adm-recall-fabricante").value.trim();
    const mod = $("#adm-recall-modelo").value.trim();
    if (!fab || !mod) {
      toast("Informe fabricante e modelo para o recall em lote.", "erro");
      return;
    }
    comAdmin(() => contratoAssinado.recallPorModelo(fab, mod)).then(() => listarTodos());
  };
  $("#btn-pausar").onclick = () => comAdmin(() => contratoAssinado.definirPausa(true));
  $("#btn-despausar").onclick = () => comAdmin(() => contratoAssinado.definirPausa(false));

  // Transferir administração: ação irreversível → confirmação via modal
  // centralizado com fundo desfocado.
  $("#btn-transferir-admin").onclick = () => {
    const novo = $("#adm-novo-admin").value.trim();
    if (!novo) {
      toast("Informe o endereço do novo administrador.", "erro");
      return;
    }
    abrirModalTransferencia(novo);
  };
}

// ------------------------------------------------------- modal de confirmação
let enderecoTransferencia = null;

function abrirModalTransferencia(endereco) {
  enderecoTransferencia = endereco;
  $("#modal-endereco").textContent = endereco;
  $("#modal-overlay").classList.add("aberto");
}

function fecharModal() {
  enderecoTransferencia = null;
  $("#modal-overlay").classList.remove("aberto");
}

function ligarModal() {
  $("#modal-cancelar").onclick = fecharModal;
  $("#modal-confirmar").onclick = () => {
    const novo = enderecoTransferencia;
    fecharModal();
    if (!novo) return;
    comAdmin(() => contratoAssinado.transferirAdmin(novo)).then(() => detectarPapel());
  };
  // clicar no fundo desfocado (fora da caixa) cancela
  $("#modal-overlay").onclick = (ev) => {
    if (ev.target === $("#modal-overlay")) fecharModal();
  };
  // tecla Esc cancela
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") fecharModal();
  });
}

// ------------------------------------------------------- abas
let timerTimeline = null;

function ligarAbas() {
  document.querySelectorAll(".aba").forEach((btn) => {
    btn.onclick = () => {
      document.querySelectorAll(".aba").forEach((b) => b.classList.remove("ativa"));
      document.querySelectorAll(".painel").forEach((p) => p.classList.remove("ativa"));
      btn.classList.add("ativa");
      $("#aba-" + btn.dataset.aba).classList.add("ativa");

      // A timeline se auto-atualiza a cada 5s enquanto a aba Rede estiver aberta.
      if (timerTimeline) {
        clearInterval(timerTimeline);
        timerTimeline = null;
      }
      if (btn.dataset.aba === "rede") {
        carregarEventos();
        timerTimeline = setInterval(carregarEventos, 5000);
      }
      if (btn.dataset.aba === "consultar") listarTodos();
    };
  });
}

// Reconecta automaticamente após um reload SE o site já foi autorizado antes.
// Usa eth_accounts (não abre popup): se houver conta autorizada, refaz a conexão.
async function reconectarSilencioso() {
  if (!window.ethereum || !window.CARECHAIN || !window.CARECHAIN.endereco) return;
  // o usuário clicou em "Desconectar": respeita a escolha até ele reconectar
  if (sessionStorage.getItem("carechain_desconectado") === "1") return;
  try {
    const contas = await window.ethereum.request({ method: "eth_accounts" });
    if (contas && contas.length > 0) {
      await conectar();
    }
  } catch (e) {
    console.warn("Reconexão silenciosa falhou:", e.message);
  }
}

// ------------------------------------------------------- init
function init() {
  // Sem conexão: conecta. Já conectado: abre o menu (copiar/trocar/desconectar).
  $("#btn-conectar").onclick = (ev) => {
    ev.stopPropagation();
    if (contaAtual) alternarMenu();
    else conectar();
  };
  $("#menu-copiar").onclick = copiarEndereco;
  $("#menu-trocar").onclick = trocarConta;
  $("#menu-sair").onclick = desconectar;
  // clique fora fecha o menu
  document.addEventListener("click", (ev) => {
    if (!ev.target.closest(".carteira-wrap")) alternarMenu(false);
  });
  $("#form-registrar").onsubmit = registrar;
  $("#btn-rastrear").onclick = rastrearPaciente;
  $("#btn-listar-tudo").onclick = listarTodos;

  // filtros (consultar e rastrear + atividade da rede)
  $("#filtro-status").onchange = aplicarFiltrosRegistros;
  $("#filtro-fabricante").onchange = aplicarFiltrosRegistros;
  $("#filtro-hospital").onchange = aplicarFiltrosRegistros;
  $("#btn-limpar-filtros").onclick = limparFiltros;
  $("#filtro-evento").onchange = renderTimeline;

  // por padrão, a administração fica bloqueada até um admin conectar
  definirAcessoAdmin(false);

  // Se o contrato está numa rede pública (Sepolia), mostra o link de auditoria
  // no rodapé — "não confie, verifique".
  if (window.CARECHAIN && window.CARECHAIN.rede === "sepolia" && window.CARECHAIN.endereco) {
    const link = $("#link-etherscan");
    link.href = "https://sepolia.etherscan.io/address/" + window.CARECHAIN.endereco;
    link.style.display = "inline";
  }
  ligarAbas();
  ligarAdmin();
  ligarModal();

  // leitura inicial de status (sem exigir conexão de carteira)
  atualizarStatus();

  // se o site já foi autorizado antes, reconecta sozinho (útil após reload/troca de conta)
  reconectarSilencioso();

  // reage a troca de conta/rede no MetaMask
  if (window.ethereum) {
    window.ethereum.on("accountsChanged", () => location.reload());
    window.ethereum.on("chainChanged", () => location.reload());
  }
}

window.addEventListener("DOMContentLoaded", init);
