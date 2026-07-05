const { expect } = require("chai");
const { ethers } = require("hardhat");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

/**
 * Suíte de testes do CareChainRegistry.
 * Rode com:  npm test
 *
 * Os testes cobrem:
 *  - deploy e configuração inicial (admin, taxa)
 *  - controle de acesso (apenasAdmin, apenasHospital)
 *  - credenciamento/revogação de hospitais
 *  - registro de marca-passo (taxa, serial duplicado, campos obrigatórios)
 *  - o mapping de filtro por hospital (requisito do professor)
 *  - a leitura geral da rede (getTodosRegistros)
 *  - rastreabilidade (atualização de status / recall)
 *  - saque pelo admin (requisito do professor) e bloqueio para não-admin
 *  - pausa da rede e transferência de admin
 */
describe("CareChainRegistry", function () {
  let contrato;
  let admin, hospitalCoracao, hospitalOutro, atacante;
  const TAXA = ethers.parseEther("0.01");

  // hash de um paciente fictício (LGPD: nunca guardamos o dado em si)
  const pacienteA = ethers.keccak256(ethers.toUtf8Bytes("SUS-700000000000001"));
  const pacienteB = ethers.keccak256(ethers.toUtf8Bytes("SUS-700000000000002"));

  beforeEach(async function () {
    [admin, hospitalCoracao, hospitalOutro, atacante] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("CareChainRegistry");
    contrato = await Factory.deploy(TAXA);
    await contrato.waitForDeployment();
  });

  describe("Deploy e configuração inicial", function () {
    it("define quem faz o deploy como administrador", async function () {
      expect(await contrato.admin()).to.equal(admin.address);
    });

    it("define a taxa de registro inicial", async function () {
      expect(await contrato.taxaDeRegistro()).to.equal(TAXA);
    });

    it("começa despausado e sem registros", async function () {
      expect(await contrato.pausado()).to.equal(false);
      expect(await contrato.totalRegistros()).to.equal(0n);
    });
  });

  describe("Controle de acesso — funções de administrador", function () {
    it("permite que o admin credencie um hospital", async function () {
      await expect(contrato.credenciarHospital(hospitalCoracao.address))
        .to.emit(contrato, "HospitalCredenciado")
        .withArgs(hospitalCoracao.address, anyValue);
      expect(await contrato.hospitalCredenciado(hospitalCoracao.address)).to.equal(true);
      expect(await contrato.totalHospitaisCredenciados()).to.equal(1n);
    });

    it("impede que um não-admin credencie hospitais", async function () {
      await expect(
        contrato.connect(atacante).credenciarHospital(hospitalCoracao.address)
      ).to.be.revertedWith("CareChain: acao restrita ao administrador");
    });

    it("impede que um não-admin atualize a taxa", async function () {
      await expect(
        contrato.connect(atacante).atualizarTaxa(ethers.parseEther("1"))
      ).to.be.revertedWith("CareChain: acao restrita ao administrador");
    });

    it("permite ao admin revogar um hospital", async function () {
      await contrato.credenciarHospital(hospitalCoracao.address);
      await contrato.revogarHospital(hospitalCoracao.address);
      expect(await contrato.hospitalCredenciado(hospitalCoracao.address)).to.equal(false);
      expect(await contrato.totalHospitaisCredenciados()).to.equal(0n);
    });

    it("permite ao admin transferir a administração", async function () {
      await expect(contrato.transferirAdmin(hospitalCoracao.address))
        .to.emit(contrato, "AdminTransferido")
        .withArgs(admin.address, hospitalCoracao.address);
      expect(await contrato.admin()).to.equal(hospitalCoracao.address);
    });
  });

  describe("Registro de marca-passo", function () {
    beforeEach(async function () {
      await contrato.credenciarHospital(hospitalCoracao.address);
    });

    it("registra um marca-passo pagando a taxa", async function () {
      await expect(
        contrato
          .connect(hospitalCoracao)
          .registrarMarcapasso(
            pacienteA,
            "Medtronic",
            "Azure XT DR MRI",
            "SN-001-AZURE",
            1719792000,
            "Dr. Carlos Andrade CRM-AL 1234",
            { value: TAXA }
          )
      )
        .to.emit(contrato, "MarcapassoRegistrado")
        .withArgs(
          0,
          hospitalCoracao.address,
          pacienteA,
          "Medtronic",
          "Azure XT DR MRI",
          "SN-001-AZURE",
          1719792000,
          TAXA
        );

      expect(await contrato.totalRegistros()).to.equal(1n);
      const reg = await contrato.getRegistro(0);
      expect(reg.fabricante).to.equal("Medtronic");
      expect(reg.hospital).to.equal(hospitalCoracao.address);
      expect(reg.status).to.equal(0n); // Ativo
    });

    it("impede registro de hospital NÃO credenciado", async function () {
      await expect(
        contrato
          .connect(hospitalOutro)
          .registrarMarcapasso(
            pacienteA,
            "Biotronik",
            "Edora 8",
            "SN-XYZ",
            1719792000,
            "Dra. Ana",
            { value: TAXA }
          )
      ).to.be.revertedWith("CareChain: hospital nao credenciado");
    });

    it("rejeita registro com taxa insuficiente", async function () {
      await expect(
        contrato
          .connect(hospitalCoracao)
          .registrarMarcapasso(
            pacienteA,
            "Medtronic",
            "Azure",
            "SN-002",
            1719792000,
            "Dr. Carlos",
            { value: ethers.parseEther("0.001") }
          )
      ).to.be.revertedWith("CareChain: taxa de registro insuficiente");
    });

    it("rejeita número de série duplicado", async function () {
      await contrato
        .connect(hospitalCoracao)
        .registrarMarcapasso(pacienteA, "Medtronic", "Azure", "SN-DUP", 1719792000, "Dr. Carlos", {
          value: TAXA,
        });
      await expect(
        contrato
          .connect(hospitalCoracao)
          .registrarMarcapasso(pacienteB, "Medtronic", "Azure", "SN-DUP", 1719792000, "Dr. Carlos", {
            value: TAXA,
          })
      ).to.be.revertedWith("CareChain: numero de serie ja registrado");
    });

    it("acumula a taxa no saldo do contrato", async function () {
      await contrato
        .connect(hospitalCoracao)
        .registrarMarcapasso(pacienteA, "Medtronic", "Azure", "SN-003", 1719792000, "Dr. Carlos", {
          value: TAXA,
        });
      expect(await contrato.saldoContrato()).to.equal(TAXA);
    });
  });

  describe("Mapping de filtro por hospital (requisito do professor)", function () {
    beforeEach(async function () {
      await contrato.credenciarHospital(hospitalCoracao.address);
      await contrato.credenciarHospital(hospitalOutro.address);
    });

    it("filtra corretamente os registros feitos por cada hospital", async function () {
      await contrato
        .connect(hospitalCoracao)
        .registrarMarcapasso(pacienteA, "Medtronic", "Azure", "SN-A", 1719792000, "Dr. Carlos", {
          value: TAXA,
        });
      await contrato
        .connect(hospitalCoracao)
        .registrarMarcapasso(pacienteB, "Biotronik", "Edora", "SN-B", 1719792000, "Dr. Carlos", {
          value: TAXA,
        });
      await contrato
        .connect(hospitalOutro)
        .registrarMarcapasso(pacienteA, "Boston", "Accolade", "SN-C", 1719792000, "Dra. Ana", {
          value: TAXA,
        });

      const idsCoracao = await contrato.getRegistrosPorHospital(hospitalCoracao.address);
      const idsOutro = await contrato.getRegistrosPorHospital(hospitalOutro.address);
      expect(idsCoracao.map(Number)).to.deep.equal([0, 1]);
      expect(idsOutro.map(Number)).to.deep.equal([2]);
    });

    it("retorna a lista geral da rede com todos os registros", async function () {
      await contrato
        .connect(hospitalCoracao)
        .registrarMarcapasso(pacienteA, "Medtronic", "Azure", "SN-A", 1719792000, "Dr. Carlos", {
          value: TAXA,
        });
      await contrato
        .connect(hospitalOutro)
        .registrarMarcapasso(pacienteB, "Boston", "Accolade", "SN-C", 1719792000, "Dra. Ana", {
          value: TAXA,
        });
      const todos = await contrato.getTodosRegistros();
      expect(todos.length).to.equal(2);
      expect(todos[0].fabricante).to.equal("Medtronic");
      expect(todos[1].fabricante).to.equal("Boston");
    });
  });

  describe("Rastreabilidade e recall", function () {
    beforeEach(async function () {
      await contrato.credenciarHospital(hospitalCoracao.address);
      await contrato
        .connect(hospitalCoracao)
        .registrarMarcapasso(pacienteA, "Medtronic", "Azure", "SN-R", 1719792000, "Dr. Carlos", {
          value: TAXA,
        });
    });

    it("o hospital que registrou pode atualizar o status", async function () {
      await expect(contrato.connect(hospitalCoracao).atualizarStatus(0, 1)) // Explantado
        .to.emit(contrato, "StatusAtualizado")
        .withArgs(0, 1, hospitalCoracao.address);
      const reg = await contrato.getRegistro(0);
      expect(reg.status).to.equal(1n);
    });

    it("o admin pode marcar um dispositivo como EmRecall", async function () {
      await contrato.atualizarStatus(0, 2); // EmRecall
      const reg = await contrato.getRegistro(0);
      expect(reg.status).to.equal(2n);
    });

    it("um terceiro sem permissão NÃO pode alterar o status", async function () {
      await expect(
        contrato.connect(atacante).atualizarStatus(0, 2)
      ).to.be.revertedWith("CareChain: sem permissao para alterar status");
    });

    it("rastreia todos os dispositivos de um paciente", async function () {
      await contrato
        .connect(hospitalCoracao)
        .registrarMarcapasso(pacienteA, "Biotronik", "Edora", "SN-R2", 1719792000, "Dr. Carlos", {
          value: TAXA,
        });
      const ids = await contrato.getRegistrosPorPaciente(pacienteA);
      expect(ids.map(Number)).to.deep.equal([0, 1]);
    });
  });

  describe("Recall em lote por modelo", function () {
    beforeEach(async function () {
      await contrato.credenciarHospital(hospitalCoracao.address);
      await contrato.credenciarHospital(hospitalOutro.address);
      // 3 dispositivos do modelo alvo (2 no Coração, 1 no Outro) + 1 de outro modelo
      await contrato
        .connect(hospitalCoracao)
        .registrarMarcapasso(pacienteA, "Medtronic", "Azure XT", "SN-L1", 1719792000, "Dr. Carlos", {
          value: TAXA,
        });
      await contrato
        .connect(hospitalCoracao)
        .registrarMarcapasso(pacienteB, "Medtronic", "Azure XT", "SN-L2", 1719792000, "Dr. Carlos", {
          value: TAXA,
        });
      await contrato
        .connect(hospitalOutro)
        .registrarMarcapasso(pacienteA, "Medtronic", "Azure XT", "SN-L3", 1719792000, "Dra. Ana", {
          value: TAXA,
        });
      await contrato
        .connect(hospitalOutro)
        .registrarMarcapasso(pacienteB, "Biotronik", "Edora 8", "SN-L4", 1719792000, "Dra. Ana", {
          value: TAXA,
        });
    });

    it("o admin marca TODOS os dispositivos ativos do modelo em uma transação", async function () {
      await expect(contrato.recallPorModelo("Medtronic", "Azure XT"))
        .to.emit(contrato, "RecallEmLote")
        .withArgs("Medtronic", "Azure XT", 3, admin.address);

      for (const id of [0, 1, 2]) {
        expect((await contrato.getRegistro(id)).status).to.equal(2n); // EmRecall
      }
      // o modelo diferente NÃO é afetado
      expect((await contrato.getRegistro(3)).status).to.equal(0n); // Ativo
    });

    it("não re-marca dispositivos que não estão ativos", async function () {
      // explanta o id 1 antes do recall
      await contrato.connect(hospitalCoracao).atualizarStatus(1, 1); // Explantado
      await expect(contrato.recallPorModelo("Medtronic", "Azure XT"))
        .to.emit(contrato, "RecallEmLote")
        .withArgs("Medtronic", "Azure XT", 2, admin.address);
      expect((await contrato.getRegistro(1)).status).to.equal(1n); // segue Explantado
    });

    it("emite StatusAtualizado para cada dispositivo afetado", async function () {
      const tx = await contrato.recallPorModelo("Medtronic", "Azure XT");
      const receipt = await tx.wait();
      const eventos = receipt.logs
        .map((l) => {
          try {
            return contrato.interface.parseLog(l);
          } catch {
            return null;
          }
        })
        .filter((e) => e && e.name === "StatusAtualizado");
      expect(eventos.length).to.equal(3);
    });

    it("um não-admin NÃO pode acionar recall em lote", async function () {
      await expect(
        contrato.connect(atacante).recallPorModelo("Medtronic", "Azure XT")
      ).to.be.revertedWith("CareChain: acao restrita ao administrador");
    });

    it("recall de modelo inexistente afeta 0 dispositivos (sem reverter)", async function () {
      await expect(contrato.recallPorModelo("Acme", "Inexistente"))
        .to.emit(contrato, "RecallEmLote")
        .withArgs("Acme", "Inexistente", 0, admin.address);
    });
  });

  describe("Saque pelo administrador (requisito do professor)", function () {
    beforeEach(async function () {
      await contrato.credenciarHospital(hospitalCoracao.address);
      // gera saldo no contrato com 3 registros
      for (let i = 0; i < 3; i++) {
        await contrato
          .connect(hospitalCoracao)
          .registrarMarcapasso(
            ethers.keccak256(ethers.toUtf8Bytes("P" + i)),
            "Medtronic",
            "Azure",
            "SN-W" + i,
            1719792000,
            "Dr. Carlos",
            { value: TAXA }
          );
      }
    });

    it("o admin consegue sacar parte do saldo do contrato", async function () {
      const saldoAntes = await contrato.saldoContrato();
      expect(saldoAntes).to.equal(TAXA * 3n);
      await expect(
        contrato.sacar(admin.address, TAXA)
      ).to.changeEtherBalances([contrato, admin], [-TAXA, TAXA]);
    });

    it("o admin consegue sacar todo o saldo", async function () {
      await expect(contrato.sacarTudo(admin.address))
        .to.emit(contrato, "Saque")
        .withArgs(admin.address, TAXA * 3n);
      expect(await contrato.saldoContrato()).to.equal(0n);
    });

    it("um não-admin NÃO consegue sacar", async function () {
      await expect(
        contrato.connect(atacante).sacar(atacante.address, TAXA)
      ).to.be.revertedWith("CareChain: acao restrita ao administrador");
    });

    it("não permite sacar mais do que o saldo", async function () {
      await expect(
        contrato.sacar(admin.address, ethers.parseEther("999"))
      ).to.be.revertedWith("CareChain: saldo insuficiente");
    });
  });

  describe("Pausa da rede (circuit breaker)", function () {
    beforeEach(async function () {
      await contrato.credenciarHospital(hospitalCoracao.address);
    });

    it("bloqueia registros quando pausada", async function () {
      await contrato.definirPausa(true);
      await expect(
        contrato
          .connect(hospitalCoracao)
          .registrarMarcapasso(pacienteA, "Medtronic", "Azure", "SN-P", 1719792000, "Dr. Carlos", {
            value: TAXA,
          })
      ).to.be.revertedWith("CareChain: rede pausada");
    });

    it("volta a permitir registros ao despausar", async function () {
      await contrato.definirPausa(true);
      await contrato.definirPausa(false);
      await contrato
        .connect(hospitalCoracao)
        .registrarMarcapasso(pacienteA, "Medtronic", "Azure", "SN-P2", 1719792000, "Dr. Carlos", {
          value: TAXA,
        });
      expect(await contrato.totalRegistros()).to.equal(1n);
    });
  });
});
