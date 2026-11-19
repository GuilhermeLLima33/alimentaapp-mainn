const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const { transformSync } = require("@babel/core");

function carregarModulo(relativo) {
  const caminho = path.resolve(__dirname, "..", relativo);
  const fonte = fs.readFileSync(caminho, "utf8");
  const compilado = transformSync(fonte, {
    plugins: [require.resolve("@babel/plugin-transform-modules-commonjs")],
  }).code;
  const modulo = new Module(caminho, module);

  modulo.filename = caminho;
  modulo.paths = Module._nodeModulePaths(path.dirname(caminho));
  modulo._compile(compilado, caminho);

  return modulo.exports;
}

const {
  criarDestinoDoacao,
  filtrarDoacoes,
  ordenarDoacoes,
  statusDoacaoValido,
} = carregarModulo("utils/doacoes.js");

function criarDoacao(overrides = {}) {
  return {
    nome: "Doação de arroz",
    descricao: "Arroz integral para a comunidade",
    estabelecimento: "Mercado Comunitário",
    criadoPor: "usuario-1",
    criadoEm: new Date("2025-03-10T12:00:00.000Z"),
    status: "Em andamento",
    pagamentoStatus: "aguardando_pagamento",
    total: 25,
    quantidadeItens: 2,
    ...overrides,
  };
}

test("oculta doações sem confirmação ou etapa explícita de pagamento", () => {
  assert.equal(
    statusDoacaoValido(
      criarDoacao({ pagamentoStatus: undefined })
    ),
    null
  );
  assert.equal(
    statusDoacaoValido(
      criarDoacao({ pagamentoStatus: "bloqueado" })
    ),
    null
  );
  assert.equal(
    statusDoacaoValido(
      criarDoacao({
        status: "Concluída",
        pagamentoStatus: "aguardando_pagamento",
      })
    ),
    null
  );
});

test("classifica entrada no pagamento como em andamento e simulação finalizada como concluída", () => {
  assert.equal(
    statusDoacaoValido(criarDoacao()),
    "Em andamento"
  );
  assert.equal(
    statusDoacaoValido(
      criarDoacao({ status: "Pendente" })
    ),
    "Em andamento"
  );
  assert.equal(
    statusDoacaoValido(
      criarDoacao({ pagamentoStatus: "simulacao_concluida" })
    ),
    "Concluída"
  );
  assert.equal(
    statusDoacaoValido(
      criarDoacao({
        status: "Concluída",
        pagamentoStatus: "simulacao_concluida",
      })
    ),
    "Concluída"
  );
  assert.equal(
    statusDoacaoValido(
      criarDoacao({
        status: "Concluída",
        pagamentoStatus: "confirmado",
      })
    ),
    "Concluída"
  );
  assert.equal(
    statusDoacaoValido(
      criarDoacao({
        status: "Concluída",
        pagamentoConfirmado: true,
        pagamentoStatus: undefined,
      })
    ),
    "Concluída"
  );
});

test("mantém a doação monetária da campanha como em andamento e conclui após pagamento", () => {
  const campanha = criarDoacao({
    nome: "Campanha de inverno",
    descricao: "Doação em dinheiro para a campanha Campanha de inverno.",
    tipoDoacao: "campanha",
    campanhaId: "campanha-1",
    total: 25,
    quantidade: 1,
    unidade: "doação",
  });

  assert.equal(statusDoacaoValido(campanha), "Em andamento");
  assert.equal(
    statusDoacaoValido({
      ...campanha,
      pagamentoStatus: "simulacao_concluida",
    }),
    "Concluída"
  );
  assert.equal(
    statusDoacaoValido({
      ...campanha,
      status: "Concluída",
      pagamentoStatus: "aguardando_pagamento",
    }),
    null
  );
});

test("retoma pagamento de alimentos ou campanha sem rota intermediária", () => {
  const alimentos = criarDoacao({
    id: "doacao-alimentos",
    tipoDoacao: "agrupada",
    itens: [
      {
        produtoId: "arroz-1",
        nome: "Arroz",
        quantidade: 2,
        precoUnitario: 5,
      },
    ],
  });
  const destinoAlimentos = criarDestinoDoacao(alimentos);

  assert.equal(destinoAlimentos.name, "TelaSeuPedido");
  assert.equal(
    destinoAlimentos.params.pedido.fluxo,
    "carrinhoDoacoes"
  );
  assert.equal(
    destinoAlimentos.params.pedido.doacaoId,
    "doacao-alimentos"
  );
  assert.equal(
    Object.hasOwn(destinoAlimentos.params.pedido, "demonstracao"),
    false
  );
  assert.equal(
    Object.hasOwn(
      destinoAlimentos.params.pedido.itens[0],
      "demonstracao"
    ),
    false
  );

  const campanha = criarDoacao({
    id: "doacao-campanha",
    tipoDoacao: "campanha",
    nome: "Fundo emergencial",
    total: 25.5,
  });
  const destinoCampanha = criarDestinoDoacao(campanha);

  assert.equal(destinoCampanha.name, "TelaSeuPedido");
  assert.deepEqual(destinoCampanha.params.pedido, {
    fluxo: "doacaoCampanha",
    doacaoId: "doacao-campanha",
    nomeCampanha: "Fundo emergencial",
    valorCentavos: 2550,
  });
});

test("doação concluída abre a confirmação com o total e o pagamento salvos", () => {
  const concluida = criarDoacao({
    id: "doacao-concluida",
    status: "Concluída",
    pagamentoStatus: "simulacao_concluida",
    tipoDoacao: "campanha",
    total: 25.5,
    totalSimuladoCentavos: 2700,
    formaPagamento: "credito",
    parcelas: 3,
    valorParcelaCentavos: 900,
    ultimaParcelaCentavos: 900,
    jurosPercentual: 5,
  });
  const destino = criarDestinoDoacao(concluida);

  assert.equal(destino.name, "TelaConfirmacaoDoacaoSimulada");
  assert.equal(destino.params.subtotalCentavos, 2550);
  assert.equal(destino.params.totalCentavos, 2700);
  assert.equal(destino.params.pagamento, "credito");
  assert.equal(destino.params.parcelas, 3);
});

test("filtra por status e busca sem acentos em nome e descrição", () => {
  const emAndamento = criarDoacao();
  const concluida = criarDoacao({
    nome: "Cesta básica",
    descricao: "Cesta de alimentos para família",
    estabelecimento: "Associação",
    status: "Concluída",
    pagamentoStatus: "confirmado",
  });
  const invalida = criarDoacao({
    nome: "Registro sem pagamento",
    pagamentoStatus: undefined,
  });

  assert.deepEqual(
    filtrarDoacoes(
      [emAndamento, concluida, invalida],
      "Em andamento",
      "integral"
    ),
    [emAndamento]
  );
  assert.deepEqual(
    filtrarDoacoes(
      [emAndamento, concluida, invalida],
      "Concluídas"
    ),
    [concluida]
  );
  assert.deepEqual(
    filtrarDoacoes(
      [emAndamento, concluida, invalida],
      "Todas",
      "comunidade"
    ),
    [emAndamento]
  );
});

test("ordena os resultados mantendo os registros filtrados", () => {
  const antiga = criarDoacao({
    criadoEm: new Date("2025-01-01T12:00:00.000Z"),
    total: 10,
    quantidadeItens: 1,
  });
  const recente = criarDoacao({
    criadoEm: new Date("2025-03-01T12:00:00.000Z"),
    total: 40,
    quantidadeItens: 4,
  });
  const filtradas = filtrarDoacoes(
    [antiga, recente],
    "Todas",
    "arroz"
  );

  assert.deepEqual(ordenarDoacoes(filtradas, "Mais recentes"), [
    recente,
    antiga,
  ]);
  assert.deepEqual(ordenarDoacoes(filtradas, "Menor valor"), [
    antiga,
    recente,
  ]);
  assert.deepEqual(
    ordenarDoacoes(filtradas, "Maior quantidade"),
    [recente, antiga]
  );
});
