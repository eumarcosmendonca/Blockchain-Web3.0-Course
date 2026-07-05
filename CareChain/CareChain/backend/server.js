/**
 * CareChain — Backend (API REST + Indexador de eventos)
 * ------------------------------------------------------
 * Papel na arquitetura Web 3.0:
 *   - A BLOCKCHAIN é a fonte da verdade (registros imutáveis).
 *   - As ESCRITAS (registrar, credenciar, sacar) são assinadas pela carteira do
 *     usuário no frontend (MetaMask) — o backend NÃO guarda chaves privadas.
 *   - Este backend é a CAMADA DE LEITURA/INDEXAÇÃO: escuta os eventos do contrato,
 *     mantém um índice em memória e expõe uma API REST para consultas rápidas e
 *     estatísticas ("ver as transações gerais da rede").
 *
 * Rode com:  npm run backend   (após deploy:local e, idealmente, seed:local)
 */
const express = require("express");
const cors = require("cors");
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const PORT = process.env.PORT || 3001;
const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";

// Rótulos legíveis para o enum Status do contrato.
const STATUS = ["Ativo", "Explantado", "EmRecall", "PacienteFalecido"];

// --------------------------------------------------------------------------
// Carrega o deployment (endereço + ABI). Prioriza CONTRACT_ADDRESS do .env.
// --------------------------------------------------------------------------
function carregarContrato() {
  const deploymentsFile = path.join(__dirname, "..", "deployments", "localhost.json");
  if (!fs.existsSync(deploymentsFile)) {
    throw new Error(
      "deployments/localhost.json não encontrado. Rode antes: npm run deploy:local"
    );
  }
  const dep = JSON.parse(fs.readFileSync(deploymentsFile, "utf8"));
  const endereco = process.env.CONTRACT_ADDRESS || dep.endereco;
  return { endereco, abi: dep.abi, dep };
}

// Converte BigInt -> string ao serializar JSON (evita erro do JSON.stringify).
function json(res, dados) {
  res.setHeader("Content-Type", "application/json");
  res.send(
    JSON.stringify(dados, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2)
  );
}

// Formata um registro (struct do contrato) para um objeto amigável.
function formatarRegistro(m) {
  return {
    id: Number(m.id),
    pacienteHash: m.pacienteHash,
    fabricante: m.fabricante,
    modelo: m.modelo,
    numeroSerie: m.numeroSerie,
    dataImplante: Number(m.dataImplante),
    dataImplanteISO: new Date(Number(m.dataImplante) * 1000).toISOString().slice(0, 10),
    hospital: m.hospital,
    medicoResponsavel: m.medicoResponsavel,
    status: Number(m.status),
    statusTexto: STATUS[Number(m.status)] || "Desconhecido",
    registradoEm: Number(m.registradoEm),
  };
}

async function main() {
  const { endereco, abi } = carregarContrato();
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contrato = new ethers.Contract(endereco, abi, provider);

  console.log("CareChain backend");
  console.log("RPC:", RPC_URL);
  console.log("Contrato:", endereco);

  // Índice de eventos em memória (a "linha do tempo" das transações da rede).
  let eventos = [];

  // Extrai bloco/txHash/índice do log tanto de queryFilter quanto de listener ao vivo.
  function extrairMeta(ev) {
    const bloco = ev?.blockNumber ?? (ev?.log && ev.log.blockNumber) ?? null;
    const txHash = ev?.transactionHash ?? (ev?.log && ev.log.transactionHash) ?? null;
    const idx = ev?.index ?? (ev?.log && ev.log.index) ?? 0;
    return { bloco, txHash, idx };
  }

  function registrarEvento(tipo, dados, ev, alvo) {
    (alvo || eventos).push({ tipo, ...dados, ...extrairMeta(ev) });
  }

  // RE-INDEXAÇÃO COMPLETA: varre o histórico do contrato desde o bloco 0 e
  // substitui a linha do tempo. É chamada na subida E a cada GET /api/eventos,
  // garantindo que a resposta esteja SEMPRE sincronizada com a blockchain
  // (nunca dependemos só dos listeners ao vivo). Barato no protótipo.
  async function indexarHistorico() {
    const novos = [];
    try {
      const registrados = await contrato.queryFilter("MarcapassoRegistrado", 0, "latest");
      for (const ev of registrados) {
        registrarEvento(
          "MarcapassoRegistrado",
          {
            id: Number(ev.args.id),
            hospital: ev.args.hospital,
            pacienteHash: ev.args.pacienteHash,
            fabricante: ev.args.fabricante,
            modelo: ev.args.modelo,
            numeroSerie: ev.args.numeroSerie,
            valorPago: ev.args.valorPago.toString(),
          },
          ev,
          novos
        );
      }
      const status = await contrato.queryFilter("StatusAtualizado", 0, "latest");
      for (const ev of status) {
        registrarEvento(
          "StatusAtualizado",
          {
            id: Number(ev.args.id),
            novoStatus: STATUS[Number(ev.args.novoStatus)],
            responsavel: ev.args.responsavel,
          },
          ev,
          novos
        );
      }
      const cred = await contrato.queryFilter("HospitalCredenciado", 0, "latest");
      for (const ev of cred) {
        registrarEvento("HospitalCredenciado", { hospital: ev.args.hospital }, ev, novos);
      }
      const recalls = await contrato.queryFilter("RecallEmLote", 0, "latest");
      for (const ev of recalls) {
        registrarEvento(
          "RecallEmLote",
          {
            fabricante: ev.args.fabricante,
            modelo: ev.args.modelo,
            quantidadeAfetada: Number(ev.args.quantidadeAfetada),
            responsavel: ev.args.responsavel,
          },
          ev,
          novos
        );
      }
      // Ordem CRONOLÓGICA: por bloco e, dentro do mesmo bloco, pela posição do log.
      novos.sort(
        (a, b) => ((a.bloco || 0) - (b.bloco || 0)) || ((a.idx || 0) - (b.idx || 0))
      );
      eventos = novos;
    } catch (e) {
      console.warn("Falha ao indexar histórico:", e.message);
    }
    return eventos;
  }

  // Escuta eventos novos em tempo real.
  function escutarEventos() {
    contrato.on("MarcapassoRegistrado", (id, hospital, pacienteHash, fabricante, modelo, numeroSerie, dataImplante, valorPago, ev) => {
      registrarEvento(
        "MarcapassoRegistrado",
        { id: Number(id), hospital, pacienteHash, fabricante, modelo, numeroSerie, valorPago: valorPago.toString() },
        ev
      );
      console.log(`[evento] Novo registro id=${Number(id)} (${fabricante} ${modelo})`);
    });
    contrato.on("StatusAtualizado", (id, novoStatus, responsavel, ev) => {
      registrarEvento("StatusAtualizado", { id: Number(id), novoStatus: STATUS[Number(novoStatus)], responsavel }, ev);
      console.log(`[evento] Status atualizado id=${Number(id)} -> ${STATUS[Number(novoStatus)]}`);
    });
    contrato.on("HospitalCredenciado", (hospital, timestamp, ev) => {
      registrarEvento("HospitalCredenciado", { hospital }, ev);
      console.log(`[evento] Hospital credenciado: ${hospital}`);
    });
    contrato.on("RecallEmLote", (fabricante, modelo, quantidadeAfetada, responsavel, ev) => {
      registrarEvento(
        "RecallEmLote",
        { fabricante, modelo, quantidadeAfetada: Number(quantidadeAfetada), responsavel },
        ev
      );
      console.log(`[evento] RECALL EM LOTE: ${fabricante} ${modelo} (${Number(quantidadeAfetada)} dispositivos)`);
    });
  }

  await indexarHistorico();
  console.log(`Indexação inicial: ${eventos.length} eventos carregados.`);
  escutarEventos();

  // ------------------------------------------------------------------------
  // API REST
  // ------------------------------------------------------------------------
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Saúde do serviço.
  app.get("/api/health", (_req, res) => json(res, { ok: true, contrato: endereco, rpc: RPC_URL }));

  // Estatísticas gerais da rede.
  app.get("/api/status", async (_req, res) => {
    try {
      const [total, saldo, taxa, admin, totalHospitais, pausado] = await Promise.all([
        contrato.totalRegistros(),
        contrato.saldoContrato(),
        contrato.taxaDeRegistro(),
        contrato.admin(),
        contrato.totalHospitaisCredenciados(),
        contrato.pausado(),
      ]);
      json(res, {
        contrato: endereco,
        admin,
        totalRegistros: Number(total),
        totalHospitaisCredenciados: Number(totalHospitais),
        saldoContratoWei: saldo.toString(),
        saldoContratoEth: ethers.formatEther(saldo),
        taxaDeRegistroWei: taxa.toString(),
        taxaDeRegistroEth: ethers.formatEther(taxa),
        pausado,
        totalEventosIndexados: eventos.length,
      });
    } catch (e) {
      res.status(500).json({ erro: e.message });
    }
  });

  // Todos os registros da rede.
  app.get("/api/registros", async (_req, res) => {
    try {
      const todos = await contrato.getTodosRegistros();
      json(res, todos.map(formatarRegistro));
    } catch (e) {
      res.status(500).json({ erro: e.message });
    }
  });

  // Um registro específico.
  app.get("/api/registros/:id", async (req, res) => {
    try {
      const reg = await contrato.getRegistro(req.params.id);
      json(res, formatarRegistro(reg));
    } catch (e) {
      res.status(404).json({ erro: "Registro não encontrado", detalhe: e.message });
    }
  });

  // Filtro por hospital (usa o mapping do contrato).
  app.get("/api/hospital/:address/registros", async (req, res) => {
    try {
      const ids = await contrato.getRegistrosPorHospital(req.params.address);
      const regs = await Promise.all(ids.map((id) => contrato.getRegistro(id)));
      json(res, regs.map(formatarRegistro));
    } catch (e) {
      res.status(500).json({ erro: e.message });
    }
  });

  // Rastreabilidade por paciente (hash).
  app.get("/api/paciente/:hash/registros", async (req, res) => {
    try {
      const ids = await contrato.getRegistrosPorPaciente(req.params.hash);
      const regs = await Promise.all(ids.map((id) => contrato.getRegistro(id)));
      json(res, regs.map(formatarRegistro));
    } catch (e) {
      res.status(500).json({ erro: e.message });
    }
  });

  // Dispositivos em recall (rastreabilidade de segurança).
  app.get("/api/recalls", async (_req, res) => {
    try {
      const todos = await contrato.getTodosRegistros();
      const recalls = todos.map(formatarRegistro).filter((r) => r.statusTexto === "EmRecall");
      json(res, recalls);
    } catch (e) {
      res.status(500).json({ erro: e.message });
    }
  });

  // Linha do tempo das transações gerais da rede.
  // Re-indexa a cada consulta: a resposta reflete SEMPRE o estado atual da chain.
  app.get("/api/eventos", async (_req, res) => {
    try {
      json(res, await indexarHistorico());
    } catch (e) {
      json(res, eventos); // fallback: devolve o último índice conhecido
    }
  });

  app.listen(PORT, () => {
    console.log(`\nAPI ouvindo em http://localhost:${PORT}`);
    console.log("Endpoints:");
    console.log(`  GET /api/health`);
    console.log(`  GET /api/status`);
    console.log(`  GET /api/registros`);
    console.log(`  GET /api/registros/:id`);
    console.log(`  GET /api/hospital/:address/registros`);
    console.log(`  GET /api/paciente/:hash/registros`);
    console.log(`  GET /api/recalls`);
    console.log(`  GET /api/eventos`);
  });
}

main().catch((e) => {
  console.error("Erro fatal no backend:", e.message);
  process.exit(1);
});
