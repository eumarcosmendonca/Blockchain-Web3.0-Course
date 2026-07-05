@echo off
REM ============================================================
REM  CareChain - Inicializa o repositorio git com o commit inicial.
REM  Dê um duplo clique neste arquivo (ou rode no terminal).
REM ============================================================
cd /d "%~dp0"

echo Inicializando repositorio git em: %cd%
git init
git add .
git commit -m "CareChain: registro e rastreabilidade de marca-passos (Solidity + Node.js)"

echo.
echo Pronto! Repositorio criado com o commit inicial.
echo Para enviar ao GitHub:
echo    git branch -M main
echo    git remote add origin https://github.com/SEU_USUARIO/carechain.git
echo    git push -u origin main
echo.
pause
