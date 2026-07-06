# Deploy na Sepolia + demo pública na internet

Guia para colocar o CareChain no ar de verdade: contrato na testnet pública **Sepolia**
(com link no Etherscan) e o site hospedado (Netlify, grátis) — o "protótipo navegável"
para formulários e avaliadores. Tempo total: ~30–45 min.

---

## Parte 1 — Preparar a carteira e o RPC (10 min)

### 1.1 Crie uma conta SÓ para o deploy
No MetaMask: menu de contas → **Adicionar conta** → crie uma nova (ex.: "CareChain Deploy").
**Nunca use uma carteira com dinheiro real.** Exporte a chave privada dela:
⋮ da conta → Detalhes da conta → Exportar chave privada.

### 1.2 Escolha uma URL RPC da Sepolia
Duas opções:

- **Sem cadastro (mais rápido):** use um RPC público, ex.:
  `https://ethereum-sepolia-rpc.publicnode.com`
- **Com cadastro (mais estável, recomendado para o dia da avaliação):**
  crie uma conta gratuita na [Alchemy](https://www.alchemy.com) → Create App →
  rede Sepolia → copie a URL HTTPS (algo como `https://eth-sepolia.g.alchemy.com/v2/SUA_CHAVE`).

### 1.3 Consiga ETH de teste (faucet)
Você precisa de ~0,05–0,1 SepoliaETH (grátis). Tente nesta ordem:

1. **Google Cloud Web3 Faucet** — `https://cloud.google.com/application/web3/faucet/ethereum/sepolia`
   (só pede login Google; 0,05/dia)
2. **Alchemy Faucet** — `https://www.alchemy.com/faucets/ethereum-sepolia` (pede conta Alchemy)
3. Se um recusar, tente o outro — faucets às vezes têm exigências (idade da conta etc.).

Cole o endereço da conta "CareChain Deploy" e receba. Confirme o saldo no MetaMask
(rede Sepolia — ela já vem listada no MetaMask em "Popular").

## Parte 2 — Configurar e publicar o contrato (10 min)

Na pasta do projeto:

```bash
cp .env.example .env      # (no Windows: copy .env.example .env)
```

Edite o `.env`:

```
SEPOLIA_RPC_URL="https://ethereum-sepolia-rpc.publicnode.com"   # ou sua URL da Alchemy
PRIVATE_KEY="0x...chave privada da conta CareChain Deploy..."
```

Publique e popule:

```bash
npm run deploy:sepolia    # publica o contrato (leva ~30s; anote o endereço!)
npm run seed:sepolia      # registra 3 dispositivos de exemplo + 1 recall em lote
```

O deploy atualiza automaticamente o `frontend/contract-info.js` com o endereço, a ABI e
o RPC da Sepolia — o site passa a apontar para a testnet.

**Seu link do Etherscan:** `https://sepolia.etherscan.io/address/SEU_ENDERECO`
— mostra o contrato, todas as transações e eventos, publicamente verificáveis.

## Parte 3 — Hospedar o site (10 min, grátis)

O frontend é 100% estático — o jeito mais fácil é o **Netlify Drop**:

1. Acesse `https://app.netlify.com/drop` (crie a conta grátis se pedir).
2. **Arraste a pasta `frontend/` inteira** para a página.
3. Em segundos você recebe um link tipo `https://carechain-xyz.netlify.app`.
   (Dá para renomear em Site settings → Change site name → ex.: `carechain-ufal`.)

Pronto: esse é o **link da demonstração online** para o formulário.

### O que o visitante consegue fazer nesse link
- **Sem MetaMask:** ver as métricas, listar/filtrar registros e rastrear pacientes —
  a leitura usa o RPC público gravado no contract-info (melhoria já incluída no código).
- **Com MetaMask (rede Sepolia):** tudo — inclusive registrar (se credenciado) e as
  ações de admin (se for a carteira administradora).
- A aba **Atividade da rede** mostrará "backend indisponível" (o indexador não está
  hospedado) — normal na demo estática. Se quiser 100%: hospede `backend/` no
  Render/Railway (grátis) e ajuste `API_BASE` no `app.js` para a URL gerada.

## Parte 4 — O que responder no formulário

> **Link para demonstração online:**
> https://SEU-SITE.netlify.app
> Contrato na testnet Sepolia (verificável): https://sepolia.etherscan.io/address/SEU_ENDERECO

## Avisos importantes

- **Transações na Sepolia levam ~12s** (tempo real de bloco de uma rede pública) — por
  isso a demo AO VIVO do pitch continua sendo na rede local (instantânea). A Sepolia é a
  prova pública; a local é o palco.
- Depois do deploy na Sepolia, para voltar a demonstrar localmente rode de novo
  `npm run deploy:local` + `seed:local` (isso reescreve o contract-info para a rede local).
  Guarde uma cópia do `frontend/contract-info.js` da Sepolia para o site hospedado — ou
  simplesmente refaça o drop no Netlify sempre a partir do deploy sepolia.
- A chave privada fica SÓ no `.env` (que o .gitignore já protege) e é de uma conta
  descartável de teste.
