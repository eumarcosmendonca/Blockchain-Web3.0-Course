/**
 * Script de SEED — popula a rede local com dados fictícios do Hospital do Coração
 * de Maceió, para a demonstração ao vivo.
 *
 * Uso (com `npm run node` rodando e após `npm run deploy:local`):
 *   npm run seed:local
 *
 * O que ele faz:
 *   1. Carrega o contrato já publicado (deployments/localhost.json).
 *   2. Credencia o Hospital do Coração (signer #1) e um segundo hospital (signer #2).
 *   3. Registra vários marca-passos fictícios, pagando a taxa.
 *   4. Marca um dispositivo como EmRecall para demonstrar rastreabilidade.
 *   5. Imprime um resumo da rede.
 *
 * IMPORTANTE (privacidade/LGPD): os pacientes são identificados apenas por um HASH.
 * Aqui geramos o hash a partir de um "cartão SUS" fictício — nenhum dado real é usado.
 */
const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

function carregarDeployment() {
  const file = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(
      `Deployment não encontrado (${file}). Rode antes: npm run deploy:local`
    );
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

// Hash do paciente (mesma regra do contrato: keccak256 do identificador em texto).
function hashPaciente(identificador) {
  return ethers.keccak256(ethers.toUtf8Bytes(identificador));
}

async function main() {
  const dep = carregarDeployment();
  const signers = await ethers.getSigners();
  const admin = signers[0];
  const hospitalCoracao = signers[1];
  const hospitalSantaCasa = signers[2];

  const contrato = await ethers.getContractAt("CareChainRegistry", dep.endereco, admin);
  const taxa = await contrato.taxaDeRegistro();

  console.log("Contrato:", dep.endereco);
  console.log("Admin (Secretaria de Saúde):", admin.address);
  console.log("Hospital do Coração:", hospitalCoracao.address);
  console.log("Santa Casa de Maceió:", hospitalSantaCasa.address);
  console.log("Taxa por registro:", ethers.formatEther(taxa), "ETH\n");

  // 1) Credenciamento (só o admin pode fazer)
  console.log("→ Credenciando hospitais...");
  await (await contrato.credenciarHospital(hospitalCoracao.address)).wait();
  await (await contrato.credenciarHospital(hospitalSantaCasa.address)).wait();

  // 2) Dados fictícios de marca-passos
  const registrosCoracao = [
    {
      paciente: "SUS-700-1001",
      fabricante: "Medtronic",
      modelo: "Azure XT DR MRI SureScan",
      serie: "MDT-AZ-2024-0001",
      dataImplante: Math.floor(new Date("2024-03-12").getTime() / 1000),
      medico: "Dr. Carlos Andrade — CRM-AL 3210",
    },
    {
      paciente: "SUS-700-1002",
      fabricante: "Biotronik",
      modelo: "Edora 8 DR-T",
      serie: "BIO-ED-2024-0044",
      dataImplante: Math.floor(new Date("2024-05-20").getTime() / 1000),
      medico: "Dra. Renata Lopes — CRM-AL 4587",
    },
    {
      paciente: "SUS-700-1003",
      fabricante: "Boston Scientific",
      modelo: "Accolade MRI L331",
      serie: "BSC-AC-2024-0102",
      dataImplante: Math.floor(new Date("2024-07-01").getTime() / 1000),
      medico: "Dr. Carlos Andrade — CRM-AL 3210",
    },
    {
      paciente: "SUS-700-1004",
      fabricante: "Medtronic",
      modelo: "Azure XT DR MRI SureScan",
      serie: "MDT-AZ-2024-0002",
      dataImplante: Math.floor(new Date("2024-09-15").getTime() / 1000),
      medico: "Dra. Renata Lopes — CRM-AL 4587",
    },
  ];

  const registrosSantaCasa = [
    {
      paciente: "SUS-700-2001",
      fabricante: "Abbott",
      modelo: "Assurity MRI PM2272",
      serie: "ABT-AS-2024-0777",
      dataImplante: Math.floor(new Date("2024-06-10").getTime() / 1000),
      medico: "Dr. Paulo Menezes — CRM-AL 5099",
    },
    {
      paciente: "SUS-700-2002",
      fabricante: "Medtronic",
      modelo: "Azure XT DR MRI SureScan",
      serie: "MDT-AZ-2024-0003",
      dataImplante: Math.floor(new Date("2024-08-22").getTime() / 1000),
      medico: "Dr. Paulo Menezes — CRM-AL 5099",
    },
  ];

  // 3) Registros do Hospital do Coração
  console.log("→ Registrando marca-passos (Hospital do Coração)...");
  for (const r of registrosCoracao) {
    const tx = await contrato
      .connect(hospitalCoracao)
      .registrarMarcapasso(
        hashPaciente(r.paciente),
        r.fabricante,
        r.modelo,
        r.serie,
        r.dataImplante,
        r.medico,
        { value: taxa }
      );
    await tx.wait();
    console.log(`   ✓ ${r.fabricante} ${r.modelo} (${r.serie})`);
  }

  // 4) Registros da Santa Casa
  console.log("→ Registrando marca-passos (Santa Casa de Maceió)...");
  for (const r of registrosSantaCasa) {
    const tx = await contrato
      .connect(hospitalSantaCasa)
      .registrarMarcapasso(
        hashPaciente(r.paciente),
        r.fabricante,
        r.modelo,
        r.serie,
        r.dataImplante,
        r.medico,
        { value: taxa }
      );
    await tx.wait();
    console.log(`   ✓ ${r.fabricante} ${r.modelo} (${r.serie})`);
  }

  // 5) Demonstra rastreabilidade: RECALL EM LOTE do modelo Medtronic Azure.
  //    Uma única transação marca TODOS os dispositivos ativos desse modelo
  //    (nos dois hospitais) como EmRecall — o grande diferencial do CareChain.
  console.log("\n→ Simulando RECALL EM LOTE: Medtronic Azure XT DR MRI SureScan...");
  const txRecall = await contrato.recallPorModelo("Medtronic", "Azure XT DR MRI SureScan");
  await txRecall.wait();

  // Resumo
  const total = await contrato.totalRegistros();
  const saldo = await contrato.saldoContrato();
  const idsCoracao = await contrato.getRegistrosPorHospital(hospitalCoracao.address);
  const idsSantaCasa = await contrato.getRegistrosPorHospital(hospitalSantaCasa.address);

  console.log("\n===================== RESUMO DA REDE =====================");
  console.log("Total de marca-passos registrados:", total.toString());
  console.log("Registros do Hospital do Coração:", idsCoracao.map(Number).join(", "));
  console.log("Registros da Santa Casa:", idsSantaCasa.map(Number).join(", "));
  console.log("Saldo acumulado no contrato:", ethers.formatEther(saldo), "ETH");
  console.log("==========================================================");
  console.log("\nAgora suba a API e o dApp:");
  console.log("  npm run backend");
  console.log("  npm run frontend   ->  http://localhost:8080");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
