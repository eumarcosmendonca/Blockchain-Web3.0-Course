# Setup do ambiente local de desenvolvimento

Guia rápido para preparar máquina, editor, navegador em modo debug e **MetaMask**. Complementa o `README.md` do projeto.

---

## 1. Node.js e projeto

1. Instale **Node.js** ≥ 18 (inclui **npm**).

   Se você usa **nvm** (recomendado), no macOS prefira instalar via **Homebrew** (facilita updates):

   ```bash
   brew update
   brew install nvm

   mkdir -p ~/.nvm

   # Adicione no ~/.zshrc:
   export NVM_DIR="$HOME/.nvm"
   [ -s "$(brew --prefix nvm)/nvm.sh" ] && . "$(brew --prefix nvm)/nvm.sh"
   [ -s "$(brew --prefix nvm)/etc/bash_completion.d/nvm" ] && . "$(brew --prefix nvm)/etc/bash_completion.d/nvm"

   # Recarregar o shell (ou feche e abra o terminal)
   source ~/.zshrc

   # Instalar e usar o LTS mais recente
   nvm install --lts
   nvm use --lts
   nvm alias default 'lts/*'
   ```

   Verifique no terminal:

   ```bash
   node -v
   npm -v
   ```

2. Entre na pasta da aula que você vai rodar e siga as instruções do `README.md` daquela aula (instalação, compile, scripts, etc.).

---

## 2. Extensões recomendadas (VS Code / Cursor)

Instale pelo painel **Extensions** (Ctrl/Cmd + Shift + X) ou pelo CLI, se preferir.

| Extensão                      | Publicador       | Para que serve neste curso                                                                                                           |
| ----------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Solidity**                  | Nomic Foundation | Syntax highlight, formatação e integração com **Hardhat** (`hardhat.config.js`, `contracts/`).                                       |
| **Prettier — Code formatter** | Prettier         | Formatação consistente de JS/HTML/CSS/JSON (alinhado ao `settings.json` do workspace, se existir).                                   |
| **Mermaid**                   | MermaidChart     | Visualizar e editar diagramas **Mermaid** (ex.: fluxogramas no `README.md`).                                                         |
| **ETHover**                   | tintinweb        | Ao passar o mouse sobre endereços Ethereum no código, mostra infos/ações úteis para ler e depurar endereços de contrato e carteiras. |

Exemplo de instalação via CLI (VS Code — ajuste para `cursor` se usar o CLI do Cursor):

```bash
code --install-extension NomicFoundation.hardhat-solidity
code --install-extension esbenp.prettier-vscode
code --install-extension MermaidChart.vscode-mermaid-chart
code --install-extension tintinweb.vscode-ethover
```

> Os IDs exatos podem mudar entre versões da loja; se algum comando falhar, busque pelo **nome** e **autor** na tabela acima.

---

## 3. Google Chrome em modo remote debugging

Útil para anexar o **debugger** do VS Code/Cursor à mesma instância do Chrome que tem a **MetaMask** (extensões não rodam no “Simple Browser” embutido).

### Comando completo (macOS)

```bash
open -n -a "Google Chrome" --args --remote-debugging-port=9222 --user-data-dir="/tmp/chrome_dev_test"
```

- **`--remote-debugging-port=9222`**: porta que o launch.json do workspace usa para **Attach**.
- **`--user-data-dir=...`**: perfil separado (não mistura com o Chrome do dia a dia); você pode trocar para uma pasta fixa, ex.: `"$HOME/chrome-debug-profile"`.

### Alias sugerido (zsh)

Edite `~/.zshrc` (ou `~/.bashrc` no Bash) e adicione, por exemplo:

```bash
# Chrome só para debug Web3 + MetaMask (porta 9222)
alias chrome-debug='open -n -a "Google Chrome" --args --remote-debugging-port=9222 --user-data-dir="$HOME/chrome-debug-profile"'
```

Depois:

```bash
source ~/.zshrc
chrome-debug
```

Abra `http://localhost:3000` nessa janela e use a configuração de debug **“Chrome: anexar (porta 9222)”** se estiver no mesmo workspace.

---

## 4. Instalar a MetaMask (carteira)

1. Abra o **Chrome** (de preferência a janela iniciada com `chrome-debug`, se for depurar com o editor).
2. Acesse o site oficial: [https://metamask.io](https://metamask.io) → **Download** → extensão **Chrome**, **ou** instale pela [Chrome Web Store](https://chrome.google.com/webstore) (busque “MetaMask” e confirme o desenvolvedor oficial).
3. **Criar uma nova carteira** ou **importar** com a frase secreta (apenas para estudo — nunca use frase de carteira real em rede local compartilhada).
4. Defina uma senha local da extensão quando pedido.
5. Para esta aula, na rede **Hardhat local** você pode **importar uma conta** usando uma **private key** impressa no terminal ao rodar `npm run chain` (contas de teste; não use em mainnet).

Depois de instalar, configure a rede local na MetaMask:

- **RPC:** `http://127.0.0.1:8545`
- **Chain ID:** `31337`
- **Símbolo nativo:** `ETH` (rótulo; são ETH fictícios na rede local)
- Importar uma conta com **private key** listada no terminal do `hardhat node` (ou usar conta já criada na extensão).

A MetaMask pode exibir **avisos** para rede custom com símbolo ETH — é comportamento esperado de segurança, não indica erro no Hardhat.

---

## 5. Checklist antes da demo

| Passo     | Comando / ação                                                                        |
| --------- | ------------------------------------------------------------------------------------- |
| Nó local  | `npm run chain` (manter aberto)                                                       |
| Deploy    | `npm run deploy:local` → copiar endereço para `CONTRACT_ADDRESS` em `frontend/app.js` |
| Front     | `npm run frontend` ou `npm run frontend:dev`                                          |
| Navegador | Chrome com debug, se for usar breakpoints → `chrome-debug` (ou comando `open` acima)  |
| MetaMask  | Rede **31337**, mesma conta/contas de teste que receberam ETH do nó                   |

---

## 6. Problemas comuns

- **Porta 9222 em uso:** feche outras instâncias do Chrome em debug ou mude a porta (e o `launch.json`).
- **Porta 3000 em uso:** encerre o outro `node frontend.js` ou mude a porta em `frontend.js` (e acesse a URL nova).
- **MetaMask sem rede:** use cadastro manual ou o fluxo `?showHardhatNetwork=1` descrito no `README.md`.

Para mais detalhes do fluxo didático, veja `README.md` na mesma pasta.
