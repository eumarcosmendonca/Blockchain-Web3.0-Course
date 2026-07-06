/**
 * SEED para a testnet SEPOLIA — popula a demo pública com dados de exemplo.
 *
 * Diferença para o seed local: na Sepolia você só tem UMA conta com fundos
 * (a do .env). Então esta mesma conta atua como admin E como hospital de
 * demonstração (o admin credencia o próprio endereço).
 *
 * Uso (após `npm run deploy:sepolia`):
 *   npm run seed:sepolia
 *
 * Os números de série levam um sufixo de timestamp, então o script pode ser
 * rodado mais de uma vez sem conflito de "serial duplicado".
 */
const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

function hashPaciente(id) {
  return ethers.keccak256(ethers.toUtf8Bytes(id));
}

async function main() {
  const file = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`Deployment não encontrado. Rode antes: npm run deploy:sepolia`);
  }
  const dep = JSON.parse(fs.readFileSync(file, "utf8"));

  const [conta] = await ethers.getSigners();
  const contrato = await ethers.getContractAt("CareChainRegistry", dep.endereco, conta);
  const taxa = await contrato.taxaDeRegistro();

  console.log("Rede:", network.name);
  console.log("Contrato:", dep.endereco);
  console.log("Conta (admin + hospital de demo):", conta.address);

  // 1) Credencia a própria conta como hospital de demonstração (se necessário)
  if (!(await contrato.hospitalCredenciado(conta.address))) {
    console.log("→ Credenciando a conta como hospital de demonstração...");
    await (await contrato.credenciarHospital(conta.address)).wait();
  }

  // 2) Registra 3 dispositivos de exemplo (serial com sufixo p/ evitar duplicata)
  const sufixo = Date.now().toString().slice(-6);
  const registros = [
    { p: "SUS-700-1001", fab: "Medtronic", mod: "Azure XT DR MRI SureScan", serie: `MDT-AZ-${sufixo}-01`, med: "Dr. Carlos Andrade — CRM-AL 3210" },
    { p: "SUS-700-1002", fab: "Medtronic", mod: "Azure XT DR MRI SureScan", serie: `MDT-AZ-${sufixo}-02`, med: "Dra. Renata Lopes — CRM-AL 4587" },
    { p: "SUS-700-2001", fab: "Biotronik", mod: "Edora 8 DR-T", serie: `BIO-ED-${sufixo}-01`, med: "Dr. Paulo Menezes — CRM-AL 5099" },
  ];
  const dataImplante = Math.floor(Date.now() / 1000);
  for (const r of registros) {
    console.log(`→ Registrando ${r.fab} ${r.mod} (${r.serie})...`);
    const tx = await contrato.registrarMarcapasso(
      hashPaciente(r.p), r.fab, r.mod, r.serie, dataImplante, r.med, { value: taxa }
    );
    await tx.wait();
  }

  // 3) Recall em lote de demonstração (modelo Medtronic)
  console.log("→ Acionando recall em lote (Medtronic Azure XT DR MRI SureScan)...");
  await (await contrato.recallPorModelo("Medtronic", "Azure XT DR MRI SureScan")).wait();

  const total = await contrato.totalRegistros();
  console.log("\n✔ Seed concluído. Total de registros na rede:", total.toString());
  console.log(`Veja no Etherscan: https://sepolia.etherscan.io/address/${dep.endereco}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
