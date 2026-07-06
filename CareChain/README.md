# CareChain ❤️‍🩹

**Registro seguro e rastreabilidade de marca-passos na blockchain (Web 3.0).**

Projeto da disciplina eletiva **Blockchain e Web 3.0** — Ciência da Computação, UFAL/AL — Prof. **Leandro Sales**.
Autores: **João Gabriel Seixas Santos** e **Marcos Mendonça**.

---

## 🌐 Demo pública

- **Aplicação online (protótipo navegável):** https://SEU-SITE.netlify.app
- **Contrato na testnet Sepolia (verificável):** [0xAb9Bd0244Ad634A7efDe301c113f20B4cB96Dfa3](   https://sepolia.etherscan.io/address/0xAb9Bd0244Ad634A7efDe301c113f20B4cB96Dfa3)

Qualquer pessoa pode abrir a aplicação (sem carteira) para consultar, filtrar e rastrear os
registros, e auditar todas as transações do contrato diretamente no Etherscan. Para interagir
(registrar/administrar), conecte o MetaMask na rede Sepolia.

---

## 1. O problema

Pacientes que recebem um marca-passo dependem de informações que hoje ficam espalhadas em
sistemas isolados de hospitais e fabricantes: quem fabricou, qual o modelo, número de série,
quem implantou, quando e em qual paciente. **Não existe uma base única, imutável e verificável**
para essas informações. Quando um fabricante emite um **recall** de um lote/modelo, rastrear todos
os pacientes afetados é lento e sujeito a falhas — com risco direto à vida.

## 2. A solução

O **CareChain** coloca esse registro em uma **blockchain**: cada marca-passo vira um registro
imutável, auditável e disponível para toda a rede de saúde. A camada Web 3.0 (carteira + assinatura
digital) garante que só entidades autorizadas escrevem, e que qualquer um pode verificar.
O diferencial: o **recall em lote** — uma única transação do administrador marca todos os
dispositivos ativos de um modelo defeituoso, em qualquer hospital da rede.

Este repositório é um **protótipo de escopo municipal** (rede de Maceió/AL), usando como referência
o **Hospital do Coração de Maceió**. A **Secretaria Municipal de Saúde** é o administrador da rede.

> ⚠️ **Privacidade (LGPD):** nenhum dado pessoal do paciente é gravado em texto puro on-chain.
> Guardamos apenas o **hash** (keccak256) do identificador do paciente. Os dados sensíveis
> permanecem off-chain, no sistema do hospital.

## 3. Arquitetura

```
┌────────────────┐   assina tx    ┌─────────────────────────┐
│   Frontend      │ ─────────────► │   Smart Contract         │
│  dApp + MetaMask│   (escrita)    │  CareChainRegistry.sol   │  ◄── fonte da verdade
│  (ethers.js)    │ ◄───────────── │  (Solidity, EVM)         │      (imutável)
└────────────────┘    leitura      └─────────────────────────┘
        ▲                                     │ emite eventos
        │ REST (linha do tempo/estatísticas)  ▼
┌────────────────────────────────────────────────────────────┐
│  Backend Node.js (Express) — INDEXADOR de eventos + API REST │
└────────────────────────────────────────────────────────────┘
```

- **Solidity** (`contracts/CareChainRegistry.sol`): regras de negócio na blockchain.
- **Frontend** (`frontend/`): dApp que conecta via **MetaMask** e assina as transações;
  leituras funcionam mesmo sem carteira (RPC público).
- **Backend** (`backend/server.js`): **camada de leitura/indexação** — escuta os eventos do
  contrato e expõe uma API REST. **Não guarda chaves privadas.**

## 4. Requisitos

- **Node.js 18+** e **npm**
- **MetaMask** no navegador (para usar o dApp)
- (Opcional) URL RPC da Sepolia para deploy na testnet — há opções públicas sem cadastro

## 5. Como rodar (rede local — recomendado para a demo ao vivo)

### Atalho: um comando só

```bash
bash demo.sh        # Linux / WSL / macOS
```

ou, no Windows, dê duplo clique em **`demo.bat`**. O script instala as dependências, sobe a
blockchain, publica o contrato, roda o seed e sobe backend + frontend.
Pressione Ctrl+C (ou feche as janelas, no Windows) para derrubar tudo.

### Ou manualmente, passo a passo

Abra **quatro terminais** na pasta do projeto.

```bash
# 0) Instalar dependências (uma única vez)
npm install

# 1) Terminal A — sobe a blockchain local (deixe rodando)
npm run node

# 2) Terminal B — publica o contrato e popula com dados do Hospital do Coração
npm run deploy:local
npm run seed:local

# 3) Terminal C — sobe a API/indexador
npm run backend

# 4) Terminal D — sobe o dApp
npm run frontend
```

Depois abra **http://localhost:8080** no navegador com o MetaMask.

### Conectar o MetaMask à rede local

1. No MetaMask, adicione uma rede personalizada:
   - **Nome:** Hardhat Local
   - **RPC URL:** `http://127.0.0.1:8545`
   - **Chain ID:** `31337`
   - **Moeda:** ETH
2. Importe uma das contas de teste que o `npm run node` imprime no terminal (chaves privadas
   públicas do Hardhat — use-as SOMENTE na rede local). A **conta #0** é o administrador; a
   **#1** é o Hospital do Coração; a **#2** é a Santa Casa (já credenciadas pelo `seed`).

## 6. Rodar os testes automatizados

```bash
npm test
```

Suíte com **30 testes** cobrindo controle de acesso, registro, taxa, mapping de filtro por
hospital, leitura geral da rede, rastreabilidade/recall, **recall em lote por modelo**, saque
pelo admin e pausa da rede.

## 7. Deploy na testnet pública (Sepolia)

```bash
cp .env.example .env      # preencha SEPOLIA_RPC_URL e PRIVATE_KEY (carteira SÓ de teste!)
npm run deploy:sepolia    # publica o contrato
npm run seed:sepolia      # popula a demo pública com dados de exemplo
```

Guia completo (RPC, faucet, hospedagem do site no Netlify): **[docs/DEPLOY_SEPOLIA.md](docs/DEPLOY_SEPOLIA.md)**.

## 8. Estrutura de pastas

```
CareChain/
├── contracts/CareChainRegistry.sol   # o smart contract
├── scripts/deploy.js                 # publica o contrato + gera contract-info
├── scripts/seed.js                   # popula a rede local (Hospital do Coração)
├── scripts/seed-sepolia.js           # popula a demo pública na testnet
├── test/CareChainRegistry.test.js    # 30 testes automatizados
├── backend/server.js                 # API REST + indexador de eventos
├── frontend/                         # dApp (HTML/CSS/JS + ethers.js via CDN)
├── docs/                             # documentação (ver seção 9)
├── demo.sh / demo.bat                # sobe a demo completa com 1 comando
├── hardhat.config.js                 # configuração de redes/compilador
└── README.md
```

## 9. Documentação essencial

- 📘 [docs/ROTEIRO.md](docs/ROTEIRO.md) — explicação detalhada de cada parte do código.
- 🧭 [docs/GUIA_PRATICO.md](docs/GUIA_PRATICO.md) — personas e roteiro guiado por todas as funcionalidades.
- 💼 [docs/MODELO_DE_NEGOCIO.md](docs/MODELO_DE_NEGOCIO.md) — o modelo de negócio.
- 🎤 [docs/APRESENTACAO.md](docs/APRESENTACAO.md) — roteiro de apresentação + perguntas dos jurados.
- 🎬 [docs/ROTEIRO_VIDEO.md](docs/ROTEIRO_VIDEO.md) — roteiro do vídeo de demonstração.
- 🌐 [docs/DEPLOY_SEPOLIA.md](docs/DEPLOY_SEPOLIA.md) — deploy na testnet + demo pública.

## 10. Licença

MIT — uso acadêmico.
