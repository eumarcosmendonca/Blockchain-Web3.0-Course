#!/usr/bin/env bash
# ============================================================
#  CareChain — sobe a demo COMPLETA com um único comando (Linux/WSL/macOS).
#  Uso:  bash demo.sh
#
#  O que ele faz:
#    1. npm install (se necessário)
#    2. Sobe a blockchain local (hardhat node) em segundo plano
#    3. Publica o contrato e roda o seed (dados do Hospital do Coração)
#    4. Sobe o backend (API/indexador) e o frontend em segundo plano
#    5. Deixa tudo no ar até você pressionar Ctrl+C (derruba tudo junto)
#
#  Logs: .hardhat-node.log (contas e chaves!), .backend.log, .frontend.log
# ============================================================
set -e
cd "$(dirname "$0")"

if [ ! -d node_modules ]; then
  echo "→ Instalando dependências (primeira vez)..."
  npm install
fi

echo "→ Subindo a blockchain local (hardhat node)..."
npx hardhat node > .hardhat-node.log 2>&1 &
NODE_PID=$!

# Espera a porta 8545 responder
echo -n "→ Aguardando a rede ficar pronta"
for i in $(seq 1 60); do
  if curl -s -o /dev/null http://127.0.0.1:8545; then
    break
  fi
  echo -n "."
  sleep 0.5
done
echo " ok!"

echo "→ Publicando o contrato..."
npm run deploy:local

echo "→ Populando com os dados de demonstração (seed)..."
npm run seed:local

echo "→ Subindo o backend (API/indexador)..."
node backend/server.js > .backend.log 2>&1 &
BACKEND_PID=$!

echo "→ Subindo o frontend..."
node frontend/serve.js > .frontend.log 2>&1 &
FRONTEND_PID=$!

sleep 1
echo ""
echo "=========================================================="
echo "  CareChain no ar!  →  http://localhost:8080"
echo "----------------------------------------------------------"
echo "  API:        http://localhost:3001/api/status"
echo "  Contas de teste (chaves privadas p/ o MetaMask):"
echo "     grep -A1 'Account #0' .hardhat-node.log   (admin)"
echo "     ou abra o arquivo .hardhat-node.log"
echo "  MetaMask: rede http://127.0.0.1:8545 · Chain ID 31337"
echo "----------------------------------------------------------"
echo "  Pressione Ctrl+C para derrubar tudo."
echo "=========================================================="

trap 'echo ""; echo "→ Encerrando..."; kill $NODE_PID $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0' INT TERM
wait
