# Roteiro de apresentação — CareChain

Guia prático para o **pitch de 5 minutos** com avaliadores externos de grandes empresas:
estrutura minuto a minuto, **demonstração ao vivo enxuta**, e perguntas prováveis com respostas.
Objetivo: nota máxima e vencer o pitch. 🎯

---

## 1. Estrutura do pitch (5 min cravados)

Em 5 minutos, cada segundo conta. A regra: **problema forte → demo com clímax no recall →
modelo de negócio em uma frase → fecho**. Não explique código no pitch; guarde para as perguntas.

| Tempo | Bloco | O que dizer |
|---|---|---|
| 0:00–0:45 | **Problema** | "Marca-passo é suporte à vida. Quando um fabricante emite um recall, encontrar os pacientes afetados leva **semanas** — cartõezinhos de papel, sistemas isolados. Pessoas morrem esperando ser encontradas." |
| 0:45–1:30 | **Solução + por que blockchain** | "CareChain: cada implante vira um registro imutável, assinado digitalmente pelo hospital. Blockchain porque fabricantes, hospitais, SUS e ANVISA **não confiam entre si** — ninguém pode ser o 'dono da verdade'." |
| 1:30–3:45 | **Demo ao vivo (o coração do pitch)** | Versão enxuta da seção 3: registrar 1 dispositivo (MetaMask assina) → **recall em lote em 1 clique** → rastrear paciente em segundos. |
| 3:45–4:30 | **Modelo de negócio** | "Taxa por registro custeia a rede pública; a Secretaria administra o caixa — tudo on-chain e auditável. Começamos em Maceió com o Hospital do Coração; o desenho escala para o SUS e para o mundo." |
| 4:30–5:00 | **Fecho** | "CareChain transforma um recall de um pesadelo logístico em uma consulta de segundos. É a certidão de nascimento imutável de cada marca-passo." |

### Demo enxuta para os 2min15s (dentro do pitch)

1. **(20s)** Dashboard aberto: "esses números vêm direto da blockchain."
2. **(45s)** Conta Hospital do Coração → registra 1 marca-passo → **MetaMask pede assinatura**:
   "quem assina é o hospital; ninguém falsifica."
3. **(45s)** Conta admin → aba Administração → **Recall em lote**: fabricante `Medtronic`,
   modelo `Azure XT DR MRI SureScan` → 1 clique → vários dispositivos ficam vermelhos
   (**EmRecall**) na consulta. Frase: "um recall que levava semanas, em **uma transação**."
4. **(25s)** Rastrear paciente → todos os dispositivos dele em segundos.

---

## 2. Antes de começar (checklist técnico)

Deixe **tudo já rodando** antes de subir ao palco (evita esperar `npm install` na frente dos
jurados):

- [ ] `npm install` já executado.
- [ ] Terminal A: `npm run node` (blockchain local no ar).
- [ ] Terminal B: `npm run deploy:local` e `npm run seed:local` já rodados.
- [ ] Terminal C: `npm run backend` (API no ar).
- [ ] Terminal D: `npm run frontend` (dApp em http://localhost:8080).
- [ ] MetaMask conectado à rede Hardhat (Chain ID 31337), com as contas #0 (admin), #1 (Hospital
      do Coração) e #2 (Santa Casa) importadas.
- [ ] (Opcional forte) `npm test` já rodado uma vez — deixe o resultado verde à mão para mostrar.

> Dica: tenha a aba do **dApp** e um **terminal com `npm test`** prontos para alternar.

---

## 3. Roteiro da demonstração ao vivo (passo a passo)

### Ato 1 — A rede e a confiança (30s)
1. Mostre o dApp aberto. Aponte os **cartões de status**: X marca-passos, 2 hospitais credenciados,
   saldo do contrato, taxa por registro.
2. Diga: "Esses dados vêm **direto da blockchain**, não de um banco nosso."

### Ato 2 — Registrar um marca-passo (assinatura na carteira) (90s)
3. No MetaMask, selecione a conta **#1 (Hospital do Coração)**. Note o selo "Hospital credenciado".
4. Aba **Registrar** → preencha:
   - Paciente: `SUS-700-9001`
   - Fabricante: `Medtronic` · Modelo: `Azure XT DR MRI` · Série: `MDT-AZ-2025-DEMO`
   - Data e médico à escolha.
5. Clique em **Registrar**. **O MetaMask abre pedindo assinatura** — este é o momento "Web 3.0":
   "quem está assinando é o hospital, com a carteira dele; ninguém falsifica isso."
6. Confirme. O contador de registros sobe e o saldo do contrato aumenta pela taxa.

### Ato 3 — Controle de acesso (o que só o admin/hospital pode fazer) (60s)
7. Troque para uma conta **não credenciada** (#3) e tente registrar → **falha** ("hospital não
   credenciado"). Mostra que a rede é confiável.
8. Vá à aba **Painel Admin** com a conta #3 e tente credenciar → **falha** (não é admin).

### Ato 4 — O poder do admin: dinheiro e credenciamento (60s)
9. Troque para a conta **#0 (admin)** — selo "Administrador".
10. Painel Admin → **Credenciar hospital** (cole um endereço #3) → agora #3 vira credenciado.
11. Painel Admin → **Sacar do contrato**: mostre o admin **usando o dinheiro da carteira do
    contrato** (a taxa acumulada). Explique: "é assim que a rede pública se sustenta."

### Ato 5 — O momento decisivo: RECALL EM LOTE (90s)
12. Aba **Administração** → cartão **Recall em lote por modelo**: fabricante `Medtronic`,
    modelo `Azure XT DR MRI SureScan` → **Acionar recall em lote**. Confirme no MetaMask.
13. Aba **Consultar** → **Listar todos**: TODOS os dispositivos daquele modelo — em **hospitais
    diferentes** — aparecem de uma vez com o selo vermelho **EmRecall**. Uma transação, toda a
    rede notificada.
14. Aba **Consultar** → digite o identificador do paciente e clique **Rastrear paciente**: em
    **segundos**, todos os dispositivos daquele paciente aparecem.
15. Frase de impacto: "Um recall que hoje leva semanas para rastrear, aqui é **uma transação** —
    e o registro é imutável e auditável."

### Ato 6 — As "transações gerais da rede" (30s)
16. Aba **Rede**: mostre a **linha do tempo** de eventos (registros, credenciamentos, recall)
    indexada pelo backend. "Toda a história da rede, verificável."

### (Opcional) Ato 7 — Testes automatizados (30s)
17. Volte ao terminal e rode `npm test`. Mostre a suíte **verde**: "o comportamento do contrato
    está coberto por testes."

---

## 4. Como o projeto atende ao que o professor pediu (fale isto)

- **Admin que usa o dinheiro do contrato** → funções `sacar`/`sacarTudo` (Ato 4, passo 11).
- **Mapping para filtrar transações por endereço** → `registrosPorHospital` /
  `getRegistrosPorHospital` (mostre via aba Consultar ou o endpoint `/api/hospital/:address/registros`).
- **Ver transações gerais da rede** → `getTodosRegistros` + aba **Rede** (linha do tempo de eventos).
- **Funções restritas ao admin** → modificador `apenasAdmin` (Ato 3, passo 8, mostra o bloqueio).

Se perguntarem sobre "dinheiro" num sistema de saúde: explique que demos a ele um **sentido de
negócio real** (taxa que custeia a rede pública), cumprindo o requisito **sem forçar**.

---

## 5. Perguntas prováveis dos jurados (e respostas)

**"Por que blockchain e não um banco de dados?"**
Porque o problema é de **confiança entre instituições independentes** (fabricantes, hospitais, SUS,
ANVISA) que não vão aceitar um "dono único" da base. Blockchain dá imutabilidade e auditoria
pública sem um dono central. Num sistema com uma só organização, um banco bastaria — aqui não é o
caso.

**"E a LGPD / privacidade do paciente?"**
Nenhum dado pessoal vai para a blockchain. Guardamos só o **hash** (keccak256) do identificador do
paciente. O dado sensível fica off-chain, no hospital. O hash permite rastrear/verificar sem expor
o cidadão.

**"Isso escala? Blockchain não é lento/caro?"**
No protótipo usamos rede local. Em produção usaríamos uma **rede permissionada** ou uma **L2** (custo
e velocidade adequados). E a leitura pesada é feita pelo **backend indexador**, não sobrecarregando a
cadeia.

**"Quem paga por isso?"**
Taxa de registro por dispositivo (demonstrada) + financiamento público (SUS) via depósito no
contrato. O admin administra esse caixa.

**"O que impede um hospital de registrar dado falso?"**
Só hospitais **credenciados** escrevem, e cada escrita é **assinada** pela carteira do hospital —
há responsabilização. O credenciamento é controlado pelo admin.

**"E se a carteira do admin for comprometida?"**
No protótipo o admin é um endereço único. Em produção evoluiria para **multi-assinatura/consórcio**
(a função `transferirAdmin` já prepara essa transição de governança).

**"O número de série pode ser duplicado?"**
Não — o contrato guarda `serialUtilizado` e **rejeita** duplicatas (há teste automatizado para isso).

**"O recall em lote percorre a lista toda; isso escala?"**
No protótipo municipal, sim (volume pequeno). Em produção manteríamos um índice
`modelo => ids` — a mesma técnica já usada em `registrosPorHospital` — para custo proporcional
apenas aos dispositivos afetados. A limitação é conhecida e a solução é a mesma já aplicada no
próprio contrato.

---

## 6. Frases-âncora para decorar

- "A blockchain aqui não é moda: é a ferramenta certa para **confiança entre partes que não confiam
  entre si**."
- "Transformamos o recall de um **pesadelo logístico** em uma **consulta de segundos**."
- "Privacidade por design: o paciente é um **hash**, nunca um dado exposto."
- "Do municipal ao global: começamos em Maceió, no Hospital do Coração, mas o problema é do mundo
  todo."
