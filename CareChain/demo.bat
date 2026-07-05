@echo off
REM ============================================================
REM  CareChain - sobe a demo COMPLETA no Windows (duplo clique).
REM  Abre 3 janelas (blockchain, backend, frontend), publica o
REM  contrato, roda o seed e abre o site no navegador.
REM  Requer Node.js instalado no Windows.
REM ============================================================
cd /d "%~dp0"

if not exist node_modules (
  echo Instalando dependencias - primeira vez...
  call npm install
)

echo Subindo a blockchain local...
start "CareChain - Blockchain (NAO FECHE - contas e chaves aqui)" cmd /k "npm run node"

echo Aguardando a rede ficar pronta...
timeout /t 10 /nobreak >nul

echo Publicando o contrato...
call npm run deploy:local

echo Populando com dados de demonstracao...
call npm run seed:local

echo Subindo o backend...
start "CareChain - Backend (API)" cmd /k "npm run backend"

echo Subindo o frontend...
start "CareChain - Frontend" cmd /k "npm run frontend"

timeout /t 2 /nobreak >nul
start http://localhost:8080

echo.
echo ==========================================================
echo   CareChain no ar!  -  http://localhost:8080
echo   MetaMask: rede http://127.0.0.1:8545 - Chain ID 31337
echo   As chaves das contas de teste estao na janela Blockchain.
echo   Para encerrar: feche as 3 janelas abertas.
echo ==========================================================
pause
