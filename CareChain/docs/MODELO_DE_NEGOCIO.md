# Modelo de negócio — CareChain

> "Um registro global, seguro e rastreável para dispositivos médicos implantáveis, começando
> pelos marca-passos."

---

## 1. O problema (e por que ele importa)

Marca-passos e outros dispositivos cardíacos implantáveis (CDI, ressincronizadores) são
equipamentos de suporte à vida. Hoje, as informações críticas sobre cada dispositivo —
fabricante, modelo, lote, número de série, data do implante, hospital e médico responsável —
ficam **fragmentadas** entre:

- o **fabricante** (que sabe o que produziu, mas nem sempre onde foi parar);
- o **hospital** (que tem o prontuário, mas isolado no seu sistema);
- o **paciente** (que muitas vezes só tem um cartãozinho de papel);
- o **regulador** (ANVISA), com dados agregados e defasados.

Quando um fabricante emite um **recall** (evento real e recorrente no setor), descobrir **quais
pacientes** têm o dispositivo afetado é um processo lento, manual e incompleto. Isso custa vidas
e dinheiro. Não existe hoje uma **base única, imutável e verificável** para essa informação.

## 2. Proposta de valor

O CareChain oferece um **registro imutável e auditável** de cada dispositivo, no qual:

- cada implante é gravado por um **hospital credenciado**, com assinatura digital (carteira);
- o dado é **imutável** (não pode ser adulterado ou apagado) e **carimbado no tempo**;
- a **rastreabilidade** é instantânea: dado um paciente, quais dispositivos; dado um modelo em
  recall, quais pacientes e hospitais;
- a **privacidade** é preservada (só o hash do paciente vai on-chain — LGPD).

## 3. Por que blockchain (e não um banco de dados comum)?

Esta é a pergunta central de qualquer projeto Web 3.0 — a resposta honesta:

| Requisito | Banco de dados central | Blockchain |
|---|---|---|
| Imutabilidade / prova de integridade | Depende de confiar no administrador | Garantida por design |
| Múltiplas partes que **não confiam** entre si (fabricantes, hospitais, SUS, planos, reguladores) | Alguém precisa "ser o dono" | Registro compartilhado, sem dono único |
| Auditoria pública e verificável | Logs internos, adulteráveis | Verificável por qualquer um |
| Interoperabilidade entre instituições/países | Integrações ponto a ponto | Padrão comum de leitura |

O valor não é "usar blockchain por moda", e sim resolver o problema de **confiança entre
múltiplas instituições independentes** — exatamente onde a blockchain é a ferramenta certa. Um
banco de dados exigiria eleger um "dono da verdade"; num registro nacional/global de saúde, isso
é politicamente e tecnicamente inviável.

## 4. Atores da rede

- **Administrador** (no protótipo, a Secretaria Municipal de Saúde de Maceió): credencia hospitais,
  define a taxa, administra o caixa da rede e pode acionar recalls. *No código: `admin`.*
- **Hospitais credenciados** (Hospital do Coração, Santa Casa…): registram os implantes. *No código:
  `hospitalCredenciado`.*
- **Fabricantes**: fornecem os dados do dispositivo e disparam recalls (via admin/regulador).
- **Pacientes / médicos**: beneficiários da rastreabilidade.
- **Reguladores (ANVISA/SUS)**: auditam e consultam.

## 5. Modelo de receita (como a rede se sustenta)

A blockchain tem custo operacional (infraestrutura, gás em redes públicas, manutenção). O CareChain
prevê uma **taxa de registro** por dispositivo — implementada no contrato como `taxaDeRegistro`,
cobrada na função `registrarMarcapasso` e acumulada na carteira do contrato. O administrador
(Secretaria de Saúde) **saca** esses fundos (`sacar`/`sacarTudo`) para custear a operação.

> É exatamente esse ciclo — **taxa (entrada) → caixa do contrato → saque pelo admin (uso)** — que
> atende, com sentido de negócio, ao requisito do professor de "um admin que usa o dinheiro da
> carteira do contrato".

Fontes de receita possíveis (escala real):
1. **Taxa por registro** paga por hospitais/fabricantes (o que o protótipo demonstra).
2. **Assinatura institucional** (SaaS) para fabricantes/planos que querem dashboards e alertas.
3. **Financiamento público** (SUS) via depósito direto no contrato (`receive()`), tratando o
   registro como infraestrutura de saúde pública.

No protótipo municipal, o modelo mais realista é **financiamento público + taxa simbólica**, já que
o registro é um bem público de saúde.

## 6. Estratégia de crescimento (do municipal ao global)

O problema descrito é **global**; a estratégia é começar pequeno e escalar:

1. **Municipal (este protótipo)** — Maceió/AL, âncora no Hospital do Coração. Poucos hospitais,
   governança simples (Secretaria como admin). Prova de conceito e validação regulatória local.
2. **Estadual** — rede de Alagoas, mais hospitais, integração com a Secretaria Estadual.
3. **Nacional** — padrão integrado ao SUS/ANVISA; o `admin` passa a ser uma governança federada
   (consórcio), não um único endereço.
4. **Global** — interoperabilidade entre registros nacionais; fabricantes multinacionais registram
   na origem.

A migração de "um admin único" para "governança federada" já está prevista na função
`transferirAdmin` (e, em produção, evoluiria para um contrato multi-assinatura/DAO).

## 7. Diferenciais competitivos

- **Foco no recall**: rastreabilidade reversa (modelo → pacientes) que os sistemas atuais não fazem
  bem.
- **Privacidade por design** (hash on-chain, PII off-chain) — pronto para LGPD.
- **Credenciamento**: só entidades autorizadas escrevem, mantendo a qualidade do dado.
- **Neutralidade**: nenhum fabricante ou hospital "é dono" da base.

## 8. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Dado de entrada incorreto (garbage in) | Credenciamento + responsabilização por assinatura digital |
| Privacidade de dados de saúde | Só hash on-chain; PII fica off-chain no hospital |
| Custo de gás em rede pública | Rede permissionada/L2 + taxa de registro |
| Adoção institucional lenta | Começar municipal com um parceiro âncora (Hospital do Coração) |
| Governança centralizada demais | Evoluir `admin` único → multisig/consórcio federado |

## 9. Indicadores de sucesso (KPIs)

- Nº de hospitais credenciados e de dispositivos registrados.
- Tempo médio para identificar pacientes afetados por um recall (meta: de semanas para segundos).
- % de implantes do município registrados na rede.
- Custo por registro vs. valor de saúde pública gerado.

## 10. Resumo de uma frase (pitch)

**CareChain é a "certidão de nascimento" imutável de cada marca-passo — um registro público,
seguro e rastreável que transforma um recall de um pesadelo logístico em uma consulta de segundos,
protegendo a vida do paciente e a privacidade dos seus dados.**
