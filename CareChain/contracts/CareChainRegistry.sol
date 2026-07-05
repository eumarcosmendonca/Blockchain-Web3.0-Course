// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title CareChainRegistry
 * @author Gabriel Seixas — Disciplina Blockchain e Web 3.0 (UFAL/AL) — Prof. Leandro Sales
 * @notice Registro seguro e rastreabilidade de marca-passos na blockchain.
 *
 * PROBLEMA QUE RESOLVE
 * --------------------
 * Hoje não existe uma solução escalável que registre, de forma global, imutável e
 * verificável, quem fabricou um marca-passo, qual o modelo, número de série, em que
 * paciente foi implantado, por qual hospital e por qual médico. Quando um fabricante
 * emite um RECALL de um lote/modelo, é muito difícil rastrear todos os pacientes
 * afetados. O CareChain coloca esse registro em uma blockchain: imutável, auditável
 * e disponível para toda a rede de saúde.
 *
 * PROTÓTIPO (escopo reduzido)
 * ---------------------------
 * Rede MUNICIPAL de Maceió/AL, usando como referência o Hospital do Coração.
 * A Secretaria Municipal de Saúde atua como ADMINISTRADOR (admin) da rede.
 * Hospitais precisam ser CREDENCIADOS pelo admin para poderem registrar dispositivos.
 *
 * REQUISITOS DO PROFESSOR (mapeados no código)
 * --------------------------------------------
 *  1) Contrato com um ADMINISTRADOR que pode usar o dinheiro da carteira do contrato
 *     -> `admin`, modificador `apenasAdmin`, funções `sacar` / `sacarTudo`.
 *  2) MAPPING para filtrar as transações feitas por um determinado endereço/contrato
 *     -> `registrosPorHospital` (mapping address => uint256[]).
 *  3) Ver as transações GERAIS da rede
 *     -> array `_registros` + `getTodosRegistros()` + eventos indexáveis.
 *  4) Funções de administrador que só podem ser acessadas se você for admin
 *     -> `credenciarHospital`, `revogarHospital`, `atualizarTaxa`, `sacar`,
 *        `transferirAdmin`, `definirPausa`, todas com o modificador `apenasAdmin`.
 *
 * PRIVACIDADE (LGPD)
 * ------------------
 * Nenhum dado pessoal do paciente é gravado em texto puro on-chain. Só o HASH
 * (keccak256) do identificador do paciente (ex.: cartão SUS/CPF) é armazenado.
 * Os dados sensíveis ficam off-chain no sistema do hospital; a blockchain guarda
 * apenas a "impressão digital" que permite verificar/rastrear sem expor o cidadão.
 */
contract CareChainRegistry {
    // ------------------------------------------------------------------
    // Tipos
    // ------------------------------------------------------------------

    /// @notice Ciclo de vida de um marca-passo (essencial para rastreabilidade).
    enum Status {
        Ativo, // 0 - implantado e em funcionamento
        Explantado, // 1 - removido do paciente
        EmRecall, // 2 - fabricante/regulador emitiu recall do modelo/lote
        PacienteFalecido // 3 - registro encerrado por óbito do paciente
    }

    /// @notice Estrutura imutável que representa um marca-passo registrado.
    struct Marcapasso {
        uint256 id; // identificador sequencial (índice na lista geral)
        bytes32 pacienteHash; // hash do identificador do paciente (LGPD, sem PII)
        string fabricante; // ex.: "Medtronic", "Biotronik", "Boston Scientific"
        string modelo; // ex.: "Azure XT DR MRI"
        string numeroSerie; // número de série único do dispositivo
        uint256 dataImplante; // data da cirurgia (timestamp unix informado)
        address hospital; // endereço do hospital que registrou (msg.sender)
        string medicoResponsavel; // médico/cirurgião responsável (CRM ou nome)
        Status status; // situação atual do dispositivo
        uint256 registradoEm; // timestamp do bloco em que foi registrado
    }

    // ------------------------------------------------------------------
    // Estado
    // ------------------------------------------------------------------

    /// @notice Administrador da rede (Secretaria Municipal de Saúde).
    address public admin;

    /// @notice Taxa (em wei) cobrada por cada registro. Custeia a operação da rede.
    uint256 public taxaDeRegistro;

    /// @notice Circuit breaker: quando true, novos registros ficam bloqueados.
    bool public pausado;

    /// @dev Lista GERAL de todos os marca-passos da rede (transações gerais).
    Marcapasso[] private _registros;

    /// @notice Hospitais autorizados a registrar dispositivos.
    mapping(address => bool) public hospitalCredenciado;

    /// @dev REQUISITO DO PROFESSOR: mapping para filtrar por endereço.
    ///      hospital => lista de ids de registros feitos por ele.
    mapping(address => uint256[]) private registrosPorHospital;

    /// @dev Rastreabilidade por paciente: hash do paciente => ids dos seus dispositivos.
    mapping(bytes32 => uint256[]) private registrosPorPaciente;

    /// @dev Evita cadastro duplicado do mesmo número de série (keccak256 do serial).
    mapping(bytes32 => bool) public serialUtilizado;

    /// @notice Quantos hospitais estão credenciados no momento.
    uint256 public totalHospitaisCredenciados;

    // ------------------------------------------------------------------
    // Eventos (permitem indexar todas as "transações" da rede off-chain)
    // ------------------------------------------------------------------

    event HospitalCredenciado(address indexed hospital, uint256 timestamp);
    event HospitalRevogado(address indexed hospital, uint256 timestamp);
    event MarcapassoRegistrado(
        uint256 indexed id,
        address indexed hospital,
        bytes32 indexed pacienteHash,
        string fabricante,
        string modelo,
        string numeroSerie,
        uint256 dataImplante,
        uint256 valorPago
    );
    event StatusAtualizado(uint256 indexed id, Status novoStatus, address responsavel);
    event RecallEmLote(
        string fabricante,
        string modelo,
        uint256 quantidadeAfetada,
        address responsavel
    );
    event TaxaAtualizada(uint256 taxaAnterior, uint256 novaTaxa);
    event Saque(address indexed para, uint256 valor);
    event Deposito(address indexed de, uint256 valor);
    event AdminTransferido(address indexed anterior, address indexed novo);
    event RedePausada(bool pausado);

    // ------------------------------------------------------------------
    // Modificadores (controle de acesso)
    // ------------------------------------------------------------------

    /// @dev Restringe a função ao administrador da rede.
    modifier apenasAdmin() {
        require(msg.sender == admin, "CareChain: acao restrita ao administrador");
        _;
    }

    /// @dev Restringe a função a hospitais credenciados.
    modifier apenasHospital() {
        require(hospitalCredenciado[msg.sender], "CareChain: hospital nao credenciado");
        _;
    }

    /// @dev Bloqueia a ação quando a rede está pausada.
    modifier quandoAtiva() {
        require(!pausado, "CareChain: rede pausada");
        _;
    }

    // ------------------------------------------------------------------
    // Construtor
    // ------------------------------------------------------------------

    /**
     * @param _taxaInicial Taxa inicial (em wei) por registro. Pode ser 0.
     * @dev Quem faz o deploy vira o administrador (a Secretaria de Saúde).
     */
    constructor(uint256 _taxaInicial) {
        admin = msg.sender;
        taxaDeRegistro = _taxaInicial;
        emit AdminTransferido(address(0), msg.sender);
    }

    // ------------------------------------------------------------------
    // Funções de ADMINISTRADOR (só o admin acessa)
    // ------------------------------------------------------------------

    /// @notice Credencia um hospital, autorizando-o a registrar marca-passos.
    function credenciarHospital(address hospital) external apenasAdmin {
        require(hospital != address(0), "CareChain: endereco invalido");
        require(!hospitalCredenciado[hospital], "CareChain: ja credenciado");
        hospitalCredenciado[hospital] = true;
        totalHospitaisCredenciados++;
        emit HospitalCredenciado(hospital, block.timestamp);
    }

    /// @notice Revoga o credenciamento de um hospital.
    function revogarHospital(address hospital) external apenasAdmin {
        require(hospitalCredenciado[hospital], "CareChain: hospital nao credenciado");
        hospitalCredenciado[hospital] = false;
        totalHospitaisCredenciados--;
        emit HospitalRevogado(hospital, block.timestamp);
    }

    /// @notice Atualiza a taxa cobrada por registro.
    function atualizarTaxa(uint256 novaTaxa) external apenasAdmin {
        uint256 anterior = taxaDeRegistro;
        taxaDeRegistro = novaTaxa;
        emit TaxaAtualizada(anterior, novaTaxa);
    }

    /**
     * @notice REQUISITO DO PROFESSOR: o admin pode usar o dinheiro do contrato.
     *         Saca um valor do saldo do contrato para um endereço.
     * @param para  Destinatário dos fundos.
     * @param valor Quantia (em wei) a sacar.
     */
    function sacar(address payable para, uint256 valor) external apenasAdmin {
        require(para != address(0), "CareChain: endereco invalido");
        require(valor <= address(this).balance, "CareChain: saldo insuficiente");
        (bool ok, ) = para.call{value: valor}("");
        require(ok, "CareChain: falha na transferencia");
        emit Saque(para, valor);
    }

    /// @notice Saca todo o saldo do contrato para um endereço.
    function sacarTudo(address payable para) external apenasAdmin {
        require(para != address(0), "CareChain: endereco invalido");
        uint256 saldo = address(this).balance;
        require(saldo > 0, "CareChain: saldo zerado");
        (bool ok, ) = para.call{value: saldo}("");
        require(ok, "CareChain: falha na transferencia");
        emit Saque(para, saldo);
    }

    /// @notice Transfere a administração da rede para outro endereço.
    function transferirAdmin(address novoAdmin) external apenasAdmin {
        require(novoAdmin != address(0), "CareChain: endereco invalido");
        address anterior = admin;
        admin = novoAdmin;
        emit AdminTransferido(anterior, novoAdmin);
    }

    /// @notice Pausa ou retoma a rede (circuit breaker de segurança).
    function definirPausa(bool estado) external apenasAdmin {
        pausado = estado;
        emit RedePausada(estado);
    }

    // ------------------------------------------------------------------
    // Função principal: REGISTRAR marca-passo (paga a taxa)
    // ------------------------------------------------------------------

    /**
     * @notice Registra um novo marca-passo na blockchain. Só hospitais credenciados.
     * @dev É `payable`: o hospital paga a taxa de registro, que fica no contrato
     *      e depois pode ser sacada pelo admin (modelo de sustentação da rede).
     * @param pacienteHash     Hash (keccak256) do identificador do paciente (LGPD).
     * @param fabricante       Fabricante do dispositivo.
     * @param modelo           Modelo do dispositivo.
     * @param numeroSerie      Número de série único.
     * @param dataImplante     Data da cirurgia (timestamp unix).
     * @param medicoResponsavel Médico/cirurgião responsável (CRM ou nome).
     * @return id Identificador do registro criado.
     */
    function registrarMarcapasso(
        bytes32 pacienteHash,
        string calldata fabricante,
        string calldata modelo,
        string calldata numeroSerie,
        uint256 dataImplante,
        string calldata medicoResponsavel
    ) external payable apenasHospital quandoAtiva returns (uint256 id) {
        require(msg.value >= taxaDeRegistro, "CareChain: taxa de registro insuficiente");
        require(pacienteHash != bytes32(0), "CareChain: pacienteHash obrigatorio");
        require(bytes(numeroSerie).length > 0, "CareChain: numero de serie obrigatorio");

        bytes32 serialKey = keccak256(abi.encodePacked(numeroSerie));
        require(!serialUtilizado[serialKey], "CareChain: numero de serie ja registrado");
        serialUtilizado[serialKey] = true;

        id = _registros.length;
        _registros.push(
            Marcapasso({
                id: id,
                pacienteHash: pacienteHash,
                fabricante: fabricante,
                modelo: modelo,
                numeroSerie: numeroSerie,
                dataImplante: dataImplante,
                hospital: msg.sender,
                medicoResponsavel: medicoResponsavel,
                status: Status.Ativo,
                registradoEm: block.timestamp
            })
        );

        registrosPorHospital[msg.sender].push(id);
        registrosPorPaciente[pacienteHash].push(id);

        emit MarcapassoRegistrado(
            id,
            msg.sender,
            pacienteHash,
            fabricante,
            modelo,
            numeroSerie,
            dataImplante,
            msg.value
        );
    }

    /**
     * @notice Atualiza a situação de um dispositivo (rastreabilidade).
     * @dev Pode ser chamada pelo hospital que registrou OU pelo admin
     *      (ex.: o admin marca um modelo como EmRecall).
     */
    function atualizarStatus(uint256 id, Status novoStatus) external {
        require(id < _registros.length, "CareChain: registro inexistente");
        Marcapasso storage m = _registros[id];
        require(
            msg.sender == admin || msg.sender == m.hospital,
            "CareChain: sem permissao para alterar status"
        );
        m.status = novoStatus;
        emit StatusAtualizado(id, novoStatus, msg.sender);
    }

    /**
     * @notice RECALL EM LOTE: marca como EmRecall todos os dispositivos ATIVOS
     *         de um mesmo fabricante+modelo, em uma única transação.
     * @dev Só o admin (autoridade sanitária) pode acionar. É o cenário real de
     *      um recall: o fabricante notifica o regulador, que atinge de uma vez
     *      todos os pacientes afetados na rede.
     *
     *      Só dispositivos `Ativo` são afetados — um dispositivo já explantado
     *      ou de paciente falecido não está mais em uso, e um já EmRecall não
     *      precisa ser marcado de novo.
     *
     *      Custo: percorre a lista toda (O(n)). Adequado ao protótipo municipal;
     *      em produção manteríamos um índice modelo => ids (mesma técnica do
     *      registrosPorHospital) para custo proporcional só aos afetados.
     * @return afetados Quantidade de dispositivos marcados neste recall.
     */
    function recallPorModelo(string calldata fabricante, string calldata modelo)
        external
        apenasAdmin
        returns (uint256 afetados)
    {
        bytes32 alvo = keccak256(abi.encode(fabricante, modelo));
        uint256 n = _registros.length;
        for (uint256 i = 0; i < n; i++) {
            Marcapasso storage m = _registros[i];
            if (
                m.status == Status.Ativo &&
                keccak256(abi.encode(m.fabricante, m.modelo)) == alvo
            ) {
                m.status = Status.EmRecall;
                emit StatusAtualizado(i, Status.EmRecall, msg.sender);
                afetados++;
            }
        }
        emit RecallEmLote(fabricante, modelo, afetados, msg.sender);
    }

    // ------------------------------------------------------------------
    // Recebimento direto de fundos (doações/financiamento da rede)
    // ------------------------------------------------------------------

    /// @notice Permite financiar a rede enviando ETH diretamente ao contrato.
    receive() external payable {
        emit Deposito(msg.sender, msg.value);
    }

    // ------------------------------------------------------------------
    // Funções de LEITURA (view) — usadas pelo frontend e pelo backend
    // ------------------------------------------------------------------

    /// @notice Total de marca-passos registrados na rede.
    function totalRegistros() external view returns (uint256) {
        return _registros.length;
    }

    /// @notice Retorna um registro específico pelo id.
    function getRegistro(uint256 id) external view returns (Marcapasso memory) {
        require(id < _registros.length, "CareChain: registro inexistente");
        return _registros[id];
    }

    /// @notice Retorna TODOS os registros da rede (transações gerais).
    /// @dev Adequado para o protótipo (volume pequeno). Em produção usaríamos
    ///      paginação e/ou indexação de eventos off-chain (ver backend).
    function getTodosRegistros() external view returns (Marcapasso[] memory) {
        return _registros;
    }

    /// @notice REQUISITO DO PROFESSOR: filtra os registros por um hospital (endereço).
    function getRegistrosPorHospital(address hospital)
        external
        view
        returns (uint256[] memory)
    {
        return registrosPorHospital[hospital];
    }

    /// @notice Rastreabilidade: retorna os ids de dispositivos de um paciente.
    function getRegistrosPorPaciente(bytes32 pacienteHash)
        external
        view
        returns (uint256[] memory)
    {
        return registrosPorPaciente[pacienteHash];
    }

    /// @notice Saldo atual (em wei) acumulado na carteira do contrato.
    function saldoContrato() external view returns (uint256) {
        return address(this).balance;
    }

    /// @notice Helper de leitura para calcular o hash de um paciente (mesma regra do on-chain).
    /// @dev Útil para o frontend conferir o hash. keccak256 do identificador em texto.
    function calcularPacienteHash(string calldata identificador)
        external
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(identificador));
    }
}
