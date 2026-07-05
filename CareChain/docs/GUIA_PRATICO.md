# Guia prático — rodando e entendendo TUDO no CareChain

Este guia te leva pela mão: o que cada terminal faz, quem é cada persona, e um roteiro de
exercícios que aciona **todas** as funcionalidades do sistema — sempre explicando o que está
acontecendo no código por baixo.

---

## 1. Por que 4 terminais? (a anatomia do sistema)

Cada terminal roda **um componente independente** da arquitetura. Em produção, cada um seria um
servidor diferente; na sua máquina, são 4 processos:

```
Terminal 1                Terminal 2               Terminal 3            Terminal 4
npm run node              deploy + seed            npm run backend       npm run frontend
┌───────────────┐        ┌───────────────┐        ┌───────────────┐    ┌───────────────┐
│ A BLOCKCHAIN  │ ◄────── │ Scripts que   │        │ API REST +    │    │ Servidor web  │
│ (nó Hardhat,  │  envia  │ publicam o    │        │ indexador de  │    │ que entrega   │
│ porta 8545)   │  txs    │ contrato e    │        │ eventos       │    │ HTML/CSS/JS   │
│               │         │ populam dados │        │ (porta 3001)  │    │ (porta 8080)  │
│ Fica rodando  │         │ RODAM E       │        │ Fica rodando  │    │ Fica rodando  │
│ para sempre   │         │ TERMINAM      │        │ para sempre   │    │ para sempre   │
└───────────────┘        └───────────────┘        └──────┬────────┘    └──────┬────────┘
        ▲                                                 │                    │
        └────────────── lê eventos e estado ──────────────┘                    │
        ▲                                                                      │
        └───────── o NAVEGADOR (MetaMask) assina e envia transações ◄──────────┘
```

- **Terminal 1 — `npm run node`**: é a **blockchain em si**. Um nó Ethereum local (Hardhat) que
  minera blocos, guarda o estado e escuta na porta 8545. Tudo o mais conversa com ele. Se ele
  cai, "a rede" deixa de existir. Por isso fica rodando para sempre.
- **Terminal 2 — `deploy` e `seed`**: são **scripts que rodam e terminam** (por isso o prompt
  volta). O `deploy` publica o contrato na blockchain do Terminal 1; o `seed` envia várias
  transações para popular dados de demonstração.
- **Terminal 3 — `npm run backend`**: a **camada de leitura** (API REST na porta 3001). Escuta os
  eventos do contrato e monta a linha do tempo da aba "Atividade da rede".
- **Terminal 4 — `npm run frontend`**: um **servidor web simples** (porta 8080) que só entrega os
  arquivos HTML/CSS/JS ao navegador. Quem interage com a blockchain é o **navegador** (via
  MetaMask), não esse servidor.

> **Analogia:** o Terminal 1 é o cartório; o 2 é o despachante que registrou a escritura e saiu;
> o 3 é o site de consultas do cartório; o 4 é só a gráfica que imprime o formulário. O MetaMask
> é a sua caneta com firma reconhecida.

---

## 2. Por que já existiam transações antes de mexer no site?

Porque **você as criou ao rodar `npm run seed:local`** (Terminal 2). O seed é um script de
demonstração que envia ~10 transações reais para a blockchain local:

1. **2 credenciamentos** — o admin credencia o Hospital do Coração (conta #1) e a Santa Casa
   (conta #2). → função `credenciarHospital`, evento `HospitalCredenciado`.
2. **6 registros de marca-passo** — 4 pelo Hospital do Coração, 2 pela Santa Casa, cada um
   pagando a taxa de 0,01 ETH. → função `registrarMarcapasso`, evento `MarcapassoRegistrado`.
3. **1 recall em lote** — o admin aciona `recallPorModelo("Medtronic", "Azure XT DR MRI
   SureScan")`, que marca os 3 dispositivos ativos desse modelo como `EmRecall` de uma vez.
   → eventos `StatusAtualizado` (um por dispositivo) + `RecallEmLote` (o resumo).

E por que o site "sabe" disso tudo? Dois mecanismos:
- Os **cartões e tabelas** leem o **estado atual** direto do contrato (`totalRegistros`,
  `getTodosRegistros`...).
- A **aba Atividade da rede** mostra os **eventos históricos**: quando o backend sobe, ele faz
  `queryFilter(evento, 0, "latest")` — ou seja, varre a blockchain **desde o bloco 0** e
  reconstrói toda a história. É uma propriedade essencial de blockchain: **nada se perde**;
  qualquer um pode auditar o passado inteiro.

> Quer ver a rede "nascer limpa"? Pare o Terminal 1 (Ctrl+C), suba de novo `npm run node` e rode
> só o `npm run deploy:local` (sem o seed). Tudo estará zerado. O seed existe só para você não
> apresentar um sistema vazio no pitch.

---

## 3. As personas (e qual conta do MetaMask usar)

O `npm run node` imprime 20 contas com 10.000 ETH cada. O seed dá papel a três delas:

| Persona | Conta | Quem é na história | O que pode fazer |
|---|---|---|---|
| 🏛 **Admin** — Secretaria Municipal de Saúde | **Account #0** | Fez o deploy do contrato (o construtor define `admin = msg.sender`) | Credenciar/revogar hospitais, atualizar taxa, **sacar o caixa**, recall (individual e em lote), pausar a rede, transferir a administração |
| 🏥 **Hospital do Coração** | **Account #1** | Credenciado pelo seed | Registrar marca-passos (pagando a taxa), atualizar status dos **seus** registros |
| 🏥 **Santa Casa de Maceió** | **Account #2** | Credenciado pelo seed | Idem |
| 🚫 **Clínica não credenciada** | **Account #3** | Ninguém a credenciou | Nada de escrita — serve para demonstrar os bloqueios |
| 👤 **Cidadão / auditor** | qualquer conta (ou nenhuma) | Público | Só leitura: consultar, rastrear, auditar a linha do tempo |

Importe no MetaMask as chaves privadas das contas #0, #1 e #3 (impressas no Terminal 1).
Dica: renomeie-as no MetaMask para "Admin-Secretaria", "Hospital Coração", "Clínica X" — fica
ótimo no telão.

---

## 4. Roteiro guiado — acionando TODAS as funcionalidades

Pré-requisito: os 4 terminais rodando e o site aberto em http://localhost:8080.

### Bloco A — Cidadão (sem privilégio nenhum) · só leitura

**A1. Os cartões do topo.** Abra o site. Dispositivos: 6 · Hospitais: 2 · Caixa: 0,06 ETH ·
Taxa: 0,01 ETH. *No código:* o `app.js` chama `totalRegistros()`, `totalHospitaisCredenciados()`,
`saldoContrato()` e `taxaDeRegistro()` — funções `view`, que **não custam gás** e não precisam de
carteira.

**A2. Listar tudo.** Aba *Consultar & rastrear* → **Listar todos**. Repare: 3 dispositivos
Medtronic Azure estão **EmRecall** (o seed acionou o recall em lote). *No código:*
`getTodosRegistros()` devolve o array `_registros` inteiro.

**A3. Rastrear um paciente.** Digite `SUS-700-1001` → **Rastrear paciente**. Aparece 1
dispositivo. *No código:* o navegador calcula `keccak256("SUS-700-1001")` e chama
`getRegistrosPorPaciente(hash)` — o mapping `registrosPorPaciente` devolve os ids. **O
identificador em si nunca foi para a blockchain**, só o hash (LGPD).

**A4. Auditar a história.** Aba *Atividade da rede*: a linha do tempo mostra credenciamentos,
registros e o recall em lote — em ordem de bloco. *No código:* o backend indexou tudo com
`queryFilter` desde o bloco 0 (seção 2 acima).

**A5. A API crua (opcional, mas impressiona).** No navegador ou curl:
- `http://localhost:3001/api/status` — estatísticas gerais
- `http://localhost:3001/api/registros` — todos os registros em JSON
- `http://localhost:3001/api/recalls` — só os dispositivos em recall
- `http://localhost:3001/api/eventos` — a linha do tempo bruta

### Bloco B — Hospital do Coração (Account #1) · escrita autorizada

**B1. Conectar.** MetaMask na Account #1 → **Conectar carteira**. O chip muda para **"Hospital
credenciado"**. *No código:* `detectarPapel()` compara sua conta com `admin()` e consulta
`hospitalCredenciado(sua_conta)`.

**B2. Registrar um marca-passo.** Aba *Registrar implante*:
- Paciente: `SUS-700-9001` · Fabricante: `Abbott` · Modelo: `Assurity MRI`
- Série: `ABT-2025-PITCH` · Data: hoje · Médico: `Dra. Você — CRM-AL 0001`

Clique em **Registrar na blockchain** → o **MetaMask abre pedindo assinatura** e mostrando o
valor (0,01 ETH de taxa + gás). Confirme. Toast verde, contador vai a 7, caixa vai a 0,07 ETH.
*No código:* `registrarMarcapasso` é `payable`; validou credenciamento (`apenasHospital`), taxa
(`msg.value >= taxaDeRegistro`), serial inédito (`serialUtilizado`), gravou o struct, atualizou
os mappings e emitiu o evento — que o backend capta em tempo real (veja o log no Terminal 3!).

**B3. Tentar fraudar um serial duplicado.** Registre de novo com a **mesma série**
`ABT-2025-PITCH`. O MetaMask nem deixa: a transação reverte com *"numero de serie ja
registrado"*. *No código:* `require(!serialUtilizado[serialKey])`.

**B4. Atualizar o status de um registro seu.** Aba *Administração* → cartão *Status individual*
→ ID do registro que você criou (6) → `Explantado` → confirmar. Funciona **mesmo sem ser admin**,
porque `atualizarStatus` permite `msg.sender == m.hospital` (o hospital dono do registro).

### Bloco C — Clínica não credenciada (Account #3) · os bloqueios

**C1. Tentar registrar.** Troque o MetaMask para a Account #3 (a página recarrega — chip
"Visitante"). Tente registrar um dispositivo → **falha: "hospital nao credenciado"**. *No
código:* o modificador `apenasHospital` barrou.

**C2. Tentar ser admin.** Aba *Administração* → tente credenciar a si mesmo ou sacar → o próprio
site avisa que sua carteira não é o administrador; se forçar, o contrato reverte com *"acao
restrita ao administrador"* (`apenasAdmin`). **Ponto de ouro para o pitch: a segurança não está
no site, está no contrato.** Mesmo que alguém hackeie o frontend, a blockchain rejeita.

### Bloco D — Admin / Secretaria (Account #0) · o poder e o dinheiro

**D1. Credenciar a clínica.** Troque para a Account #0 (chip "Administrador"). *Administração* →
*Credenciamento* → cole o endereço da Account #3 → **Credenciar**. Cartão "Hospitais" vai a 3.
*No código:* `credenciarHospital` (só admin), evento `HospitalCredenciado`. (Se quiser, volte à
#3 e mostre que agora ela consegue registrar. Depois **Revogar** para desfazer.)

**D2. Atualizar a taxa.** *Taxa de registro* → `0.02` → confirmar. O cartão do topo atualiza.
*No código:* `atualizarTaxa`, evento `TaxaAtualizada`.

**D3. 💥 O RECALL EM LOTE (clímax do pitch).** *Recall em lote por modelo*:
- Fabricante: `Biotronik` · Modelo: `Edora 8 DR-T` → **Acionar recall em lote** → confirmar.

Vá em *Consultar* → *Listar todos*: o Edora ficou vermelho. E na *Atividade da rede*, aparece o
evento **RecallEmLote** com a contagem. *No código:* `recallPorModelo` percorre a lista, marca
cada dispositivo `Ativo` do modelo como `EmRecall` (um `StatusAtualizado` por dispositivo) e
emite o resumo `RecallEmLote`. **Uma transação → toda a rede notificada.**

**D4. 💰 Sacar o caixa (o requisito do professor).** *Tesouraria* → destino: seu próprio endereço
(Account #0) → valor: `0.05` (ou vazio para sacar tudo) → **Sacar do contrato**. O cartão "Caixa
da rede" diminui e o saldo da sua conta no MetaMask aumenta. *No código:* `sacar` verifica
`apenasAdmin` e o saldo, transfere com `.call{value:}` e emite `Saque`. É o admin **usando o
dinheiro da carteira do contrato**.

**D5. Circuit breaker.** *Circuit breaker* → **Pausar rede**. Volte à conta #1 e tente registrar
→ falha *"rede pausada"*. Volte à #0 → **Retomar**. *No código:* `definirPausa` + modificador
`quandoAtiva`.

Com isso você acionou **todas** as funções do contrato, exceto duas administrativas que pode
testar por conta própria: `transferirAdmin` (passa o "cargo" para outro endereço — cuidado, a
Account #0 perde o poder!) e o `receive()` (envie ETH direto ao endereço do contrato pelo
MetaMask e veja o evento `Deposito`).

---

## 5. Mapa rápido: ação no site → função no contrato

| Ação na interface | Função Solidity | Quem pode | Evento emitido |
|---|---|---|---|
| Cartões de métricas | `totalRegistros`, `saldoContrato`, `taxaDeRegistro`, `totalHospitaisCredenciados` | qualquer um (view) | — |
| Registrar implante | `registrarMarcapasso` (payable) | hospital credenciado | `MarcapassoRegistrado` |
| Listar todos | `getTodosRegistros` | qualquer um | — |
| Rastrear paciente | `getRegistrosPorPaciente` | qualquer um | — |
| Status individual | `atualizarStatus` | admin **ou** hospital dono | `StatusAtualizado` |
| Recall em lote | `recallPorModelo` | só admin | `StatusAtualizado` (xN) + `RecallEmLote` |
| Credenciar / Revogar | `credenciarHospital` / `revogarHospital` | só admin | `HospitalCredenciado` / `HospitalRevogado` |
| Atualizar taxa | `atualizarTaxa` | só admin | `TaxaAtualizada` |
| Sacar | `sacar` / `sacarTudo` | só admin | `Saque` |
| Pausar / Retomar | `definirPausa` | só admin | `RedePausada` |
| (enviar ETH ao contrato) | `receive()` | qualquer um | `Deposito` |

## 6. Se algo der errado

| Sintoma | Causa | Solução |
|---|---|---|
| `ECONNREFUSED 127.0.0.1:8545` | Terminal 1 não está rodando | Suba `npm run node` primeiro e deixe aberto |
| MetaMask com erro de nonce/travado | Você reiniciou o Terminal 1 (a chain zerou) e o MetaMask lembra da antiga | MetaMask → Configurações → Avançado → **Limpar dados da aba de atividade** (por conta) |
| Site diz "Contrato não configurado" | Faltou o deploy | `npm run deploy:local` (ele regenera o `frontend/contract-info.js`) |
| Aba Atividade vazia / "Backend indisponível" | Terminal 3 não está rodando | `npm run backend` |
| Registrei mas a tabela não mudou | A tabela não recarrega sozinha | Clique em **Listar todos** de novo |
| Reiniciei o nó e o site mostra dados velhos | Deploy antigo apontando para chain nova | Rode deploy + seed de novo e recarregue a página (F5) |
