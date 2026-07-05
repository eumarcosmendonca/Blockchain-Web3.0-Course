#!/usr/bin/env bash
# ============================================================
#  CareChain - Inicializa o repositório git com o commit inicial.
#  Uso:  bash git-init.sh
# ============================================================
set -e
cd "$(dirname "$0")"

echo "Inicializando repositório git em: $(pwd)"
git init
git add .
git commit -m "CareChain: registro e rastreabilidade de marca-passos (Solidity + Node.js)"

echo
echo "Pronto! Repositório criado com o commit inicial."
echo "Para enviar ao GitHub:"
echo "   git branch -M main"
echo "   git remote add origin https://github.com/SEU_USUARIO/carechain.git"
echo "   git push -u origin main"
