require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/**
 * Configuração do Hardhat para o projeto CareChain.
 *
 * Redes:
 *  - hardhat  : rede em memória usada nos testes automatizados (npm test).
 *  - localhost: rede local persistente iniciada com `npm run node` (para a demo).
 *  - sepolia  : testnet pública Ethereum (deploy opcional para mostrar on-chain real).
 *
 * As chaves/URLs sensíveis ficam no arquivo .env (nunca versionado no git).
 */

const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    // Rede local persistente (hardhat node) — usada na apresentação ao vivo.
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    // Testnet pública opcional. Só é usada se SEPOLIA_RPC_URL e PRIVATE_KEY existirem.
    sepolia: {
      url: SEPOLIA_RPC_URL,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 11155111,
    },
  },
};
