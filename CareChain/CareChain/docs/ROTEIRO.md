# Roteiro do código — CareChain

Este documento explica **tudo o que acontece no código**, parte por parte, para que você
tenha total domínio na apresentação e consiga responder aos jurados com segurança. Leia na
ordem: primeiro o contrato (o coração do projeto), depois os scripts, o backend e o frontend.

---

## Parte 1 — O smart contract (`contracts/CareChainRegistry.sol`)

O contrato é a **fonte da verdade**: uma vez publicado na blockchain, suas regras não podem ser
alteradas e cada registro fica gravado de forma imutável. Ele é escrito em **Solidity 0.8.24**.

### 1.1 Tipos de dados

**`enum Status { Ativo, Explantado, EmRecall, PacienteFalecido }`**
Representa o ciclo de vida de um marca-passo. É essencial para a **rastreabilidade**: um dispositivo
pode ser marcado como `EmRecall` (recall do fabricante) ou `Explantado` (removido). Internamente um
`enum` é um número (0 a 3).

**`struct Marcapasso { ... }`**
É o "registro" de cada dispositivo. Campos importantes:
- `id`: número sequencial (é também a posição na lista geral).
- `pacienteHash` (`bytes32`): **hash** do identificador do paciente. Aqui está a proteção de dados —
  nunca guardamos o CPF/cartão SUS em si, só sua "impressão digital".
- `fabricante`, `modelo`, `numeroSerie`, `dataImplante`, `medicoResponsavel`: os dados de
  rastreabilidade do dispositivo.
- `hospital` (`address`): o endereço (carteira) do hospital que registrou — é o `msg.sender`.
- `status`: o `enum` acima.
- `registradoEm`: o `block.timestamp` do momento do registro (carimbo de tempo da blockchain).

### 1.2 Variáveis de estado (o que fica gravado na blockchain)

- `address public admin` — o **administrador** da rede (a Secretaria de Saúde). O `public` faz o
  Solidity criar automaticamente uma função de leitura `admin()`.
- `uint256 public taxaDeRegistro` — a **taxa** (em wei) cobrada por registro. Sustenta a rede.
- `bool public pausado` — um "disjuntor" de segurança (circuit breaker).
- `Marcapasso[] private _registros` — a **lista geral** de todos os dispositivos (as "transações
  gerais da rede"). É `private` para controlarmos como ela é lida (via funções `getRegistro` e
  `getTodosRegistros`).
- `mapping(address => bool) public hospitalCredenciado` — quem está autorizado a registrar.
- `mapping(address => uint256[]) private registrosPorHospital` — **este é o mapping que o professor
  pediu**: dado um endereço (hospital), devolve a lista de ids dos registros que ele fez. Serve para
  **filtrar as transações por um determinado endereço**.
- `mapping(bytes32 => uint256[]) private registrosPorPaciente` — rastreabilidade por paciente.
- `mapping(bytes32 => bool) public serialUtilizado` — impede cadastrar duas vezes o mesmo número de
  série (evita fraude/duplicidade).
- `uint256 public totalHospitaisCredenciados` — contador de hospitais ativos.

### 1.3 Eventos

Eventos são "logs" que a blockchain emite e que ficam indexáveis para sistemas off-chain (o nosso
backend). São eles que permitem **reconstruir toda a história da rede** sem precisar varrer o estado.
Os principais: `MarcapassoRegistrado`, `StatusAtualizado`, `HospitalCredenciado`, `Saque`,
`Deposito`, `AdminTransferido`, `TaxaAtualizada`, `RedePausada`.

Repare que em `MarcapassoRegistrado` marcamos `id`, `hospital` e `pacienteHash` como `indexed`.
Isso permite **filtrar eventos** por esses campos diretamente no nó (ex.: "todos os registros do
hospital X"). O EVM permite no máximo 3 campos `indexed` por evento — usamos exatamente 3.

### 1.4 Modificadores (controle de acesso)

- `apenasAdmin` → `require(msg.sender == admin, ...)`. Só o administrador passa.
- `apenasHospital` → `require(hospitalCredenciado[msg.sender], ...)`. Só hospitais credenciados.
- `quandoAtiva` → `require(!pausado, ...)`. Bloqueia quando a rede está pausada.

O modificador roda antes do corpo da função (o `_;` marca onde o corpo entra). É assim que
implementamos as **"funções de administrador que só podem ser acessadas se você for admin"**.

### 1.5 Construtor

```solidity
constructor(uint256 _taxaInicial) {
    admin = msg.sender;        // quem publica o contrato vira o admin
    taxaDeRegistro = _taxaInicial;
    emit AdminTransferido(address(0), msg.sender);
}
```

### 1.6 Funções de administrador (requisito do professor)

Todas usam `apenasAdmin`:
- `credenciarHospital(address)` / `revogarHospital(address)` — controla quem pode registrar.
- `atualizarTaxa(uint256)` — muda a taxa.
- **`sacar(address payable para, uint256 valor)`** — **o admin usa o dinheiro da carteira do
  contrato.** Verifica se há saldo, envia com `.call{value: valor}("")` e checa o sucesso. Emite
  `Saque`. É exatamente o "administrador que pode utilizar o dinheiro da carteira do contrato".
- `sacarTudo(address payable para)` — saca todo o saldo de uma vez.
- `transferirAdmin(address)` — passa a administração adiante.
- `definirPausa(bool)` — liga/desliga o disjuntor.

> **Por que usar `.call` em vez de `.transfer`?** Boa prática moderna de Solidity: `.transfer`
> tem limite fixo de gás (2300) que pode quebrar com carteiras que são contratos. `.call` é o
> padrão recomendado, sempre verificando o retorno (`require(ok)`).

### 1.7 Função principal — `registrarMarcapasso(...)` (payable)

É o coração da aplicação. Fluxo:
1. Modificadores `apenasHospital` e `quandoAtiva` garantem que só um hospital credenciado registra,
   e apenas com a rede ativa.
2. `require(msg.value >= taxaDeRegistro, ...)` — **cobra a taxa** (é uma função `payable`, recebe ETH).
3. Valida `pacienteHash` e `numeroSerie` não vazios.
4. Calcula `keccak256(numeroSerie)` e garante que o serial ainda não foi usado (anti-duplicidade).
5. Cria o `id` (= tamanho atual da lista) e faz `push` do novo `Marcapasso` na lista geral.
6. Atualiza os dois mappings de índice: `registrosPorHospital[msg.sender]` e
   `registrosPorPaciente[pacienteHash]`.
7. Emite o evento `MarcapassoRegistrado`.

O dinheiro pago fica **retido no contrato** e depois pode ser sacado pelo admin — é o ciclo que
liga a taxa (receita) ao saque (uso do dinheiro), fechando o requisito do professor de forma
coerente com o modelo de negócio.

### 1.8 `atualizarStatus(uint256 id, Status novoStatus)` — rastreabilidade

Permite mudar a situação de um dispositivo. A permissão é do **hospital que registrou** OU do
**admin**. É assim que um **recall** funciona na prática: o admin (ou o regulador) marca o
dispositivo/modelo como `EmRecall`, e isso fica registrado e rastreável para sempre.

### 1.9 `recallPorModelo(fabricante, modelo)` — recall em lote ⭐

O grande diferencial para o pitch. Só o **admin** aciona. Em **uma única transação**:
1. Calcula a "chave" do modelo: `keccak256(abi.encode(fabricante, modelo))`.
   Usamos `abi.encode` (e não `encodePacked`) porque com dois strings dinâmicos o
   `encodePacked` poderia gerar colisões (ex.: `"AB"+"C"` = `"A"+"BC"`); o `encode`
   preserva os limites de cada campo.
2. Percorre a lista geral e, para **cada dispositivo `Ativo` do modelo**, muda o status para
   `EmRecall` e emite `StatusAtualizado`.
3. Emite `RecallEmLote(fabricante, modelo, quantidadeAfetada, responsavel)` com o total.

Por que só dispositivos `Ativo`? Um dispositivo já explantado ou de paciente falecido não está
mais em uso — o recall não se aplica; e um já `EmRecall` não precisa ser re-marcado.

Custo: o loop é O(n) sobre a lista toda — adequado ao protótipo municipal. Em produção,
manteríamos um índice `modelo => ids` (mesma técnica do `registrosPorHospital`) para custo
proporcional apenas aos afetados. **Se os jurados perguntarem sobre escalabilidade do loop, essa
é a resposta.**

### 1.10 `receive() external payable`

Permite **financiar a rede** enviando ETH direto ao contrato (doações/orçamento público). Emite
`Deposito`. Demonstra o contrato **guardando dinheiro** — que só o admin pode movimentar.

### 1.11 Funções de leitura (view/pure)

- `totalRegistros()` — quantos dispositivos existem.
- `getRegistro(id)` — um registro específico.
- **`getTodosRegistros()`** — retorna **toda a lista** (as transações gerais da rede).
- **`getRegistrosPorHospital(address)`** — usa o mapping para **filtrar por hospital** (requisito
  do professor).
- `getRegistrosPorPaciente(bytes32)` — rastreabilidade por paciente.
- `saldoContrato()` — o saldo em wei acumulado na carteira do contrato.
- `calcularPacienteHash(string)` — helper `pure` para conferir o hash (mesma regra do on-chain).

---

## Parte 2 — Como cada requisito do professor foi atendido

| Pedido do professor | Onde está no código | Aplicável? |
|---|---|---|
| Admin que pode usar o dinheiro da carteira do contrato | `admin`, `sacar`, `sacarTudo`, `apenasAdmin` | ✅ Sim — via taxa de registro + saque |
| Mapping para filtrar transações de um determinado endereço/contrato | `registrosPorHospital` + `getRegistrosPorHospital` | ✅ Sim |
| Ver as transações gerais da rede | `_registros` + `getTodosRegistros` + eventos + backend `/api/eventos` | ✅ Sim |
| Funções de admin acessíveis só pelo admin | modificador `apenasAdmin` em 7 funções | ✅ Sim |

**Observação honesta para os jurados (caso perguntem):** o exemplo original do professor tratava
"dinheiro" no sentido genérico de um contrato que recebe/gasta ETH. Num registro médico, dinheiro
não é o foco — então **demos um sentido de negócio real a isso**: a taxa de registro custeia a
operação da rede pública, e o admin (Secretaria de Saúde) administra esse caixa. Assim o requisito
técnico foi cumprido **sem ser forçado**, ancorado no modelo de negócio (ver `MODELO_DE_NEGOCIO.md`).

---

## Parte 3 — Os testes (`test/CareChainRegistry.test.js`)

Rodam com `npm test` na rede em memória do Hardhat. Cada bloco `describe` cobre um aspecto:
- **Deploy e configuração inicial** — admin correto, taxa correta, começa vazio/despausado.
- **Controle de acesso** — só o admin credencia/atualiza taxa; não-admin é rejeitado.
- **Registro** — registra pagando a taxa; rejeita hospital não credenciado, taxa insuficiente e
  serial duplicado; a taxa acumula no saldo do contrato.
- **Mapping de filtro por hospital** — confere que cada hospital vê só os seus registros e que a
  lista geral traz todos.
- **Rastreabilidade e recall** — hospital atualiza status; admin marca `EmRecall`; terceiro é
  bloqueado; rastreia todos os dispositivos de um paciente.
- **Recall em lote por modelo** — o admin atinge todos os dispositivos ativos do modelo em uma
  transação; não re-marca explantados; emite um `StatusAtualizado` por dispositivo + o resumo
  `RecallEmLote`; não-admin é bloqueado; modelo inexistente afeta 0 sem reverter.
- **Saque pelo admin** — admin saca parte/tudo; não-admin é bloqueado; não saca além do saldo.
- **Pausa** — bloqueia registros quando pausada e volta ao normal ao despausar.

Esses testes são a sua "rede de segurança" e também uma ótima forma de mostrar aos jurados que o
contrato se comporta como esperado (você pode rodar `npm test` ao vivo).

---

## Parte 4 — Scripts (`scripts/`)

- **`deploy.js`** — publica o contrato, define a taxa inicial (0,01 ETH) e **gera dois arquivos**:
  `deployments/localhost.json` (usado pelo backend) e `frontend/contract-info.js` (usado pelo dApp).
  Assim, frontend e backend sempre apontam para o endereço recém-publicado, sem edição manual.
- **`seed.js`** — popula a rede com dados fictícios do **Hospital do Coração** e da **Santa Casa**:
  credencia os dois hospitais, registra 6 marca-passos e simula um **recall** do dispositivo id 0.
  Ao final imprime um resumo (total, filtro por hospital, saldo).

---

## Parte 5 — Backend (`backend/server.js`)

Papel: **camada de leitura e indexação** (não guarda chave privada nenhuma).
1. Conecta ao nó RPC com `ethers.JsonRpcProvider` e carrega o contrato (endereço + ABI).
2. **Indexa o histórico**: com `queryFilter` varre os eventos desde o bloco 0 e monta uma linha do
   tempo em memória.
3. **Escuta em tempo real**: com `contrato.on(...)` adiciona novos eventos à linha do tempo.
4. Expõe uma **API REST** (Express):
   - `GET /api/status` — estatísticas da rede (total, saldo, taxa, admin, hospitais).
   - `GET /api/registros` e `/api/registros/:id` — os registros.
   - `GET /api/hospital/:address/registros` — filtro por hospital (usa o mapping do contrato).
   - `GET /api/paciente/:hash/registros` — rastreabilidade por paciente.
   - `GET /api/recalls` — dispositivos em recall.
   - `GET /api/eventos` — a linha do tempo das transações gerais da rede.

Isto ilustra o padrão real de Web 3.0: **escritas assinadas pela carteira do usuário** + **backend
como indexador** para leituras rápidas e relatórios.

---

## Parte 6 — Frontend (`frontend/`)

dApp em HTML/CSS/JS puro + **ethers.js** (via CDN). Sem etapa de build — fácil de rodar na demo.
- **`index.html`** — estrutura: painel de status, abas (Registrar, Consultar/Rastrear, Rede,
  Painel Admin) e área de mensagens.
- **`app.js`** — lógica:
  - `conectar()` — pede a conta ao **MetaMask** (`eth_requestAccounts`), cria a instância de leitura
    (com o provider) e a de escrita (com o signer).
  - `detectarPapel()` — descobre se a carteira é **admin**, **hospital credenciado** ou visitante,
    e ajusta a interface.
  - `registrar()` — calcula o `pacienteHash` **no navegador**, chama `registrarMarcapasso` pagando a
    taxa e espera a confirmação.
  - `rastrearPaciente()` / `listarTodos()` — leituras que preenchem a tabela.
  - `comAdmin(fn)` — envelopa as ações do painel admin (credenciar, taxa, sacar, recall, pausar).
  - `carregarEventos()` — busca a linha do tempo no backend (`/api/eventos`).
- **`serve.js`** — servidor estático mínimo (sem dependências) em `http://localhost:8080`.
- **`contract-info.js`** — gerado pelo deploy; carrega o endereço + ABI no navegador.

---

## Parte 7 — Resumo do fluxo de uma transação (ponta a ponta)

1. O hospital abre o dApp e conecta o MetaMask.
2. Preenche o formulário e clica em "Registrar".
3. O navegador calcula `keccak256` do identificador do paciente (dado sensível **não** sai do
   navegador).
4. O `app.js` chama `registrarMarcapasso(...)` com `value` = taxa. O **MetaMask pede assinatura**.
5. A transação vai para a blockchain; o contrato valida (credenciamento, taxa, serial), grava o
   `Marcapasso`, atualiza os mappings e **emite o evento**.
6. O **backend** capta o evento e atualiza a linha do tempo; o **frontend** atualiza os cartões de
   status.
7. Qualquer pessoa pode auditar/rastrear — inclusive filtrar por hospital ou por paciente.
