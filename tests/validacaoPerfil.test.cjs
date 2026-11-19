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
  validarDadosPerfil,
  validarUrlFoto,
} = carregarModulo("utils/validacaoPerfil.js");

test("valida e normaliza os campos persistidos do perfil", () => {
  assert.deepEqual(
    validarDadosPerfil({
      nome: "  Ana Lima ",
      telefone: "11999999999",
      nascimento: "01/02/1990",
    }),
    {
      nome: "Ana Lima",
      telefone: "11999999999",
      nascimento: "01/02/1990",
    }
  );
  assert.throws(
    () => validarDadosPerfil({ nome: "A" }),
    /entre 2 e 100/
  );
  assert.throws(
    () =>
      validarDadosPerfil({
        nome: "Ana",
        nascimento: "1990-02-01",
      }),
    /DD\/MM\/AAAA/
  );
});

test("aceita links HTTPS de imagem sem exigir upload ao Storage", () => {
  assert.equal(
    validarUrlFoto(" https://imagens.exemplo.com/foto.jpg "),
    "https://imagens.exemplo.com/foto.jpg"
  );
  assert.equal(validarUrlFoto(""), "");
  assert.throws(
    () => validarUrlFoto("http://imagens.exemplo.com/foto.jpg"),
    /link HTTPS válido/
  );
  assert.throws(
    () => validarUrlFoto("não é um link"),
    /link HTTPS válido/
  );
  assert.throws(
    () => validarUrlFoto("https://usuario:senha@exemplo.com/foto.jpg"),
    /link HTTPS válido/
  );
});
