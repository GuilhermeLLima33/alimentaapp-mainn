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

const dados = carregarModulo("data/mockDoacoesPerfil.js");
const calculos = carregarModulo("utils/mockDoacoesPerfil.js");

test("calcula contagem, totais por tipo e pontos a partir dos mocks", () => {
  const resumo = calculos.calcularResumoDoacoes(
    dados.MOCK_DOACOES_PERFIL,
    dados.MOCK_CAMPANHAS_PERFIL
  );

  assert.equal(resumo.quantidade, 4);
  assert.deepEqual(resumo.totaisAlimentos, {
    kg: 12,
    unidades: 8,
  });
  assert.equal(resumo.totalDinheiro, 35.5);
  assert.equal(resumo.pontos, 111);
  assert.equal(
    calculos.calcularTotalConquistas(
      dados.MOCK_DOACOES_PERFIL,
      dados.MOCK_CAMPANHAS_PERFIL
    ),
    3
  );
});

test("reflete alterações nos dados e libera marcos de conquista", () => {
  const doacoesAtualizadas = [
    ...dados.MOCK_DOACOES_PERFIL,
    ...Array.from({ length: 6 }, (_, indice) => ({
      id: `mock-adicional-${indice}`,
      campanhaId: "cestas-comunidade",
      tipo: "alimento",
      valor: 1,
      unidade: "kg",
      data: "2026-11-01T12:00:00.000Z",
      status: "Concluída",
    })),
  ];
  const resumo = calculos.calcularResumoDoacoes(
    doacoesAtualizadas,
    dados.MOCK_CAMPANHAS_PERFIL
  );

  assert.equal(resumo.quantidade, 10);
  assert.equal(resumo.totaisAlimentos.kg, 18);
  assert.equal(resumo.pontos, 141);
  assert.equal(
    calculos.calcularTotalConquistas(
      doacoesAtualizadas,
      dados.MOCK_CAMPANHAS_PERFIL
    ),
    4
  );
});

test("campanhas mock incluem nome, tipo e valor", () => {
  for (const campanha of dados.MOCK_CAMPANHAS_PERFIL) {
    assert.ok(campanha.nome);
    assert.ok(["alimento", "dinheiro"].includes(campanha.tipo));
    assert.ok(Number.isFinite(campanha.valor) && campanha.valor > 0);
  }
});
