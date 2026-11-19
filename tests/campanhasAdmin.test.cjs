const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const babel = require("@babel/core");

const raizProjeto = path.resolve(__dirname, "..");
const arquivoUtil = path.join(
  raizProjeto,
  "utils",
  "campanhasAdmin.js"
);

require.extensions[".png"] = (modulo, arquivo) => {
  modulo.exports = arquivo;
};

const codigoTranspilado = babel.transformFileSync(arquivoUtil, {
  configFile: false,
  babelrc: false,
  plugins: [
    require.resolve("@babel/plugin-transform-modules-commonjs"),
  ],
}).code;

const moduloUtil = new Module(arquivoUtil, module);
moduloUtil.filename = arquivoUtil;
moduloUtil.paths = Module._nodeModulePaths(
  path.dirname(arquivoUtil)
);
moduloUtil._compile(codigoTranspilado, arquivoUtil);

const {
  campanhaVisivelParaCliente,
  filtrarCampanhas,
  imagemCampanha,
  montarDadosNovaCampanha,
  moedaParaNumero,
  validarPeriodoCampanha,
  validarUrlImagem,
  transicaoStatusCampanhaPermitida,
} = moduloUtil.exports;

function dadosBase(overrides = {}) {
  return {
    nome: "  Campanha de alimentos  ",
    descricao: "  Apoio alimentar para famílias.  ",
    categoria: "Alimentos",
    inicio: "01/12/2026",
    termino: "31/12/2026",
    meta: 500,
    criadoPor: "admin-123",
    criadoEm: "created-at",
    atualizadoEm: "updated-at",
    ...overrides,
  };
}

test("aceita datas válidas e rejeita datas impossíveis ou invertidas", () => {
  assert.equal(validarPeriodoCampanha("01/12/2026", "31/12/2026"), "");
  assert.equal(
    validarPeriodoCampanha("31/02/2026", "01/03/2026"),
    "Digite datas válidas no formato dd/mm/aaaa."
  );
  assert.equal(
    validarPeriodoCampanha("15/12/2026", "14/12/2026"),
    "A data de término não pode ser anterior à data de início."
  );
});

test("aceita somente links HTTPS públicos para imagens", () => {
  assert.equal(validarUrlImagem(""), "");
  assert.equal(
    validarUrlImagem(" https://images.example.com/campanha.png "),
    ""
  );
  assert.notEqual(
    validarUrlImagem("http://images.example.com/campanha.png"),
    ""
  );
  assert.notEqual(validarUrlImagem("isto não é um link"), "");
});

test("limita a meta ao máximo permitido pelas regras do Firestore", () => {
  assert.equal(moedaParaNumero("100.000.000,00"), 100000000);
  assert.equal(moedaParaNumero("99.999.999,99"), 99999999.99);
  assert.ok(Number.isNaN(moedaParaNumero("100.000.000,01")));
  assert.ok(Number.isNaN(moedaParaNumero("999999999999999999999999999")));
});

test("cria campanha ativa e visível sem imagem", () => {
  const campanha = montarDadosNovaCampanha(dadosBase());

  assert.equal(campanha.status, "Ativa");
  assert.equal(campanha.exemplo, false);
  assert.equal(campanha.imagemUrl, null);
  assert.equal(campanha.imagemPath, undefined);
  assert.equal(campanha.imagemChave, null);
  assert.equal(campanha.nome, "Campanha de alimentos");
  assert.equal(campanhaVisivelParaCliente(campanha), true);
  assert.equal(imagemCampanha(campanha), null);
});

test("cria campanha ativa e visível com link público de imagem", () => {
  const campanha = montarDadosNovaCampanha(
    dadosBase({
      imagemUrl: "  https://images.example.com/campanha.png  ",
    })
  );

  assert.equal(campanha.status, "Ativa");
  assert.equal(campanha.exemplo, false);
  assert.deepEqual(imagemCampanha(campanha), {
    uri: "https://images.example.com/campanha.png",
  });
  assert.equal(campanha.imagemPath, undefined);
  assert.equal(campanhaVisivelParaCliente(campanha), true);
});

test("não publica modelos demonstrativos para clientes", () => {
  assert.equal(
    campanhaVisivelParaCliente({ status: "Ativa", exemplo: true }),
    false
  );
});

test("filtra a mesma lista real por status e busca, ignorando exemplos", () => {
  const campanhas = [
    {
      id: "ativa",
      nome: "Campanha de alimentos",
      descricao: "Arrecadação para o bairro",
      status: "Ativa",
    },
    {
      id: "pausada",
      nome: "Apoio escolar",
      descricao: "Alimentos para estudantes",
      status: "Pausada",
    },
    {
      id: "encerrada",
      nome: "Campanha antiga",
      descricao: "Doações encerradas",
      status: "Encerrada",
    },
    {
      id: "exemplo",
      nome: "Campanha de alimentos demonstrativa",
      descricao: "Não foi criada no sistema",
      status: "Ativa",
      exemplo: true,
    },
  ];

  assert.deepEqual(
    filtrarCampanhas(campanhas).map(({ id }) => id),
    ["ativa", "pausada", "encerrada"]
  );
  assert.deepEqual(
    filtrarCampanhas(campanhas, "estudantes", "Pausada")
      .map(({ id }) => id),
    ["pausada"]
  );
  assert.deepEqual(
    filtrarCampanhas(campanhas, "bairro", "Encerrada"),
    []
  );
});

test("aplica transições permitidas e torna campanha encerrada terminal", () => {
  assert.equal(
    transicaoStatusCampanhaPermitida("Ativa", "Pausada"),
    true
  );
  assert.equal(
    transicaoStatusCampanhaPermitida("Pausada", "Ativa"),
    true
  );
  assert.equal(
    transicaoStatusCampanhaPermitida("Ativa", "Encerrada"),
    true
  );
  assert.equal(
    transicaoStatusCampanhaPermitida("Pausada", "Encerrada"),
    true
  );
  assert.equal(
    transicaoStatusCampanhaPermitida("Encerrada", "Encerrada"),
    true
  );
  assert.equal(
    transicaoStatusCampanhaPermitida("Encerrada", "Ativa"),
    false
  );
  assert.equal(
    transicaoStatusCampanhaPermitida("Encerrada", "Pausada"),
    false
  );
});
