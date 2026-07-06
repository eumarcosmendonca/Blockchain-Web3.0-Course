/**
 * Script de deploy do CareChainRegistry.
 *
 * Uso:
 *   Local:   npm run deploy:local     (precisa de `npm run node` rodando em outro terminal)
 *   Sepolia: npm run deploy:sepolia    (precisa de .env com SEPOLIA_RPC_URL e PRIVATE_KEY)
 *
 * Ao final, o script salva:
 *   - deployments/<rede>.json    -> endereço + ABI (usado pelo backend)
 *   - frontend/contract-info.js  -> endereço + ABI (usado pelo frontend, sem build)
 */
const { ethers, network, artifacts } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  // Taxa inicial de registro: 0,01 ETH (representa a taxa de sustentação da rede).
  const taxaInicial = ethers.parseEther("0.01");

  const [deployer] = await ethers.getSigners();
  console.log("Rede:", network.name);
  console.log("Administrador (deployer):", deployer.address);

  const Factory = await ethers.getContractFactory("CareChainRegistry");
  const contrato = await Factory.deploy(taxaInicial);
  await contrato.waitForDeployment();

  const address = await contrato.getAddress();
  console.log("CareChainRegistry publicado em:", address);
  console.log("Taxa de registro inicial:", ethers.formatEther(taxaInicial), "ETH");

  // Monta o pacote de informações (endereço + ABI) para frontend/backend.
  const artifact = await artifacts.readArtifact("CareChainRegistry");
  const info = {
    rede: network.name,
    endereco: address,
    admin: deployer.address,
    taxaDeRegistro: taxaInicial.toString(),
    // URL RPC pública da rede: permite ao dApp LER a blockchain mesmo sem
    // MetaMask instalado (essencial para a demo hospedada na internet).
    rpcUrl: network.config.url || "",
    abi: artifact.abi,
  };

  // Salva em deployments/<rede>.json
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(deploymentsDir, { recursive: true });
  fs.writeFileSync(
    path.join(deploymentsDir, `${network.name}.json`),
    JSON.stringify(info, null, 2)
  );

  // Salva em frontend/contract-info.js (o frontend não tem build; lê via <script>)
  const frontendFile = path.join(__dirname, "..", "frontend", "contract-info.js");
  const jsContent =
    "// GERADO AUTOMATICAMENTE pelo scripts/deploy.js — não editar à mão.\n" +
    "window.CARECHAIN = " +
    JSON.stringify(info, null, 2) +
    ";\n";
  fs.writeFileSync(frontendFile, jsContent);

  console.log("\nArquivos gerados:");
  console.log(" - deployments/" + network.name + ".json");
  console.log(" - frontend/contract-info.js");
  console.log("\nPróximos passos:");
  console.log("  npm run seed:local     # popula com dados do Hospital do Coração (rede local)");
  console.log("  npm run backend        # sobe a API/indexador");
  console.log("  npm run frontend       # sobe o dApp em http://localhost:8080");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
