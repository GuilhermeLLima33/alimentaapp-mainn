const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const { transformSync } = require("@babel/core");

const caminho = path.resolve(__dirname, "..", "utils", "produtosAdmin.js");
const compilado = transformSync(fs.readFileSync(caminho, "utf8"), {
  plugins: [require.resolve("@babel/plugin-transform-modules-commonjs")],
}).code;
const modulo = new Module(caminho, module);
modulo.filename = caminho;
modulo.paths = Module._nodeModulePaths(path.dirname(caminho));
modulo._compile(compilado, caminho);

const {
  erroValidacaoProduto,
  filtrarProdutosAdmin,
  montarAlteracoesProdutoAdmin,
  montarDadosProdutoAdmin,
  precoParaNumero,
  validarUrlProduto,
} = modulo.exports;

test("converte preços digitados em formato brasileiro", () => {
  assert.equal(precoParaNumero("R$ 1.234,56"), 1234.56);
  assert.equal(precoParaNumero("4.90"), 4.9);
  assert.ok(Number.isNaN(precoParaNumero("abc")));
});

test("valida os campos obrigatórios e o link HTTPS", () => {
  const dados = {
    nome: "Arroz integral",
    descricao: "Arroz integral pacote 1 kg",
    categoria: "Mercearia",
    quantidade: "10",
    unidade: "pacotes",
    preco: "12,90",
    imagemUrl: "https://exemplo.com/arroz.jpg",
  };
  assert.equal(erroValidacaoProduto(dados), "");
  assert.match(
    erroValidacaoProduto({ ...dados, descricao: "" }),
    /descrição/
  );
  assert.match(validarUrlProduto("http://exemplo.com/x.jpg"), /HTTPS/);
  assert.match(
    erroValidacaoProduto({ ...dados, quantidade: "0" }),
    /quantidade/
  );
  assert.match(
    erroValidacaoProduto({ ...dados, preco: "0" }),
    /preço/
  );
  assert.equal(
    erroValidacaoProduto({ ...dados, quantidade: "0" }),
    "Informe uma quantidade entre 1 e 10.000."
  );
  assert.equal(
    erroValidacaoProduto(
      { ...dados, quantidade: "0" },
      { permitirEstoqueZerado: true }
    ),
    ""
  );
  assert.equal(
    erroValidacaoProduto(
      { ...dados, descricao: "", categoria: "", quantidade: "", unidade: "", preco: "" },
      {
        permitirEstoqueZerado: true,
        permitirCamposLegadosVazios: true,
      }
    ),
    ""
  );
});

test("filtra produtos por busca e status sem diferenciar acentos", () => {
  const produtos = [
    { nome: "Feijão carioca", descricao: "Pacote", status: "disponivel" },
    { nome: "Café", descricao: "Torrado", status: "indisponivel" },
  ];
  assert.equal(filtrarProdutosAdmin(produtos, "feijao").length, 1);
  assert.equal(
    filtrarProdutosAdmin(produtos, "", "Indisponíveis")[0].nome,
    "Café"
  );
});

test("gera registro no formato do catálogo da tela inicial", () => {
  const produto = montarDadosProdutoAdmin({
    nome: "Arroz integral",
    descricao: "Arroz pacote 1 kg",
    categoria: "Mercearia",
    quantidade: "12",
    unidade: "pacotes",
    preco: "12,90",
    imagemUrl: "https://exemplo.com/arroz.jpg",
    criadoPor: "admin-uid",
    criadoEm: "created",
    atualizadoEm: "updated",
  });
  assert.equal(produto.precoAtual, 12.9);
  assert.equal(produto.status, "disponivel");
  assert.equal(produto.adminCadastrado, true);
  assert.equal(produto.imagemUrl, "https://exemplo.com/arroz.jpg");
  assert.equal(produto.imagemAdminDefinida, true);
  assert.equal(
    montarDadosProdutoAdmin({
      nome: "Feijão",
      descricao: "Feijão carioca",
      categoria: "Mercearia",
      quantidade: "2",
      unidade: "kg",
      preco: "8,90",
      imagemUrl: "",
      criadoPor: "admin-uid",
      criadoEm: "created",
      atualizadoEm: "updated",
    }).imagemAdminDefinida,
    false
  );
});

test("altera a URL da imagem sem regravar campos legados não editados", () => {
  const alteracoes = montarAlteracoesProdutoAdmin({
    produto: {
      nome: "Óleo",
      imagemUrl: "",
      imagemAdminDefinida: false,
      demonstracao: false,
      criadoPor: "admin-uid",
    },
    nome: "Óleo",
    descricao: "",
    categoria: "",
    quantidade: "",
    unidade: "",
    preco: "",
    imagemUrl: "https://exemplo.com/oleo.jpg",
    atualizadoEm: "updated",
  });

  assert.deepEqual(alteracoes, {
    adminCadastrado: true,
    imagemUrl: "https://exemplo.com/oleo.jpg",
    imagemAdminDefinida: true,
    imagemChave: "",
    atualizadoEm: "updated",
  });
});
