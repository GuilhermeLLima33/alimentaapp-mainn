export const CATEGORIAS_PRODUTO = [
  "Mercearia",
  "Hortifruti",
  "Bebidas",
  "Padarias",
  "Refeições",
  "Outros",
];

export const UNIDADES_PRODUTO = [
  "unidades",
  "kg",
  "cestas",
  "pacotes",
  "litros",
];

export const FILTROS_PRODUTO = [
  "Todas",
  "Disponíveis",
  "Indisponíveis",
];

export function validarUrlProduto(valor) {
  const texto = String(valor || "").trim();
  if (!texto) return "";
  if (texto.length > 2048) {
    return "O link da imagem deve ter no máximo 2048 caracteres.";
  }

  try {
    const url = new URL(texto);
    if (
      url.protocol !== "https:" ||
      !url.hostname ||
      url.username ||
      url.password
    ) {
      throw new Error();
    }
  } catch {
    return "Informe um link HTTPS público e direto para a imagem.";
  }

  return "";
}

export function precoParaNumero(valor) {
  const texto = String(valor || "")
    .trim()
    .replace(/\s|R\$/g, "");
  const normalizado = texto.includes(",")
    ? texto.replace(/\./g, "").replace(",", ".")
    : texto;
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : NaN;
}

export function formatarPrecoProduto(valor) {
  return `R$ ${Number(valor).toFixed(2).replace(".", ",")}`;
}

export function erroValidacaoProduto(
  dados,
  {
    permitirEstoqueZerado = false,
    permitirCamposLegadosVazios = false,
  } = {}
) {
  if (String(dados.nome || "").trim().length < 3) {
    return "Informe um nome com pelo menos 3 caracteres.";
  }
  if (String(dados.nome || "").trim().length > 100) {
    return "O nome deve ter no máximo 100 caracteres.";
  }
  if (
    !permitirCamposLegadosVazios &&
    String(dados.descricao || "").trim().length < 5
  ) {
    return "Informe uma descrição com pelo menos 5 caracteres.";
  }
  if (String(dados.descricao || "").trim().length > 300) {
    return "A descrição deve ter no máximo 300 caracteres.";
  }
  if (
    !CATEGORIAS_PRODUTO.includes(dados.categoria) &&
    !(permitirCamposLegadosVazios && !dados.categoria)
  ) {
    return "Selecione uma categoria válida.";
  }
  const quantidade = Number(dados.quantidade);
  if (
    !Number.isFinite(quantidade) ||
    quantidade < (permitirEstoqueZerado ? 0 : 1) ||
    quantidade > 10000
  ) {
    if (
      !(permitirCamposLegadosVazios && !String(dados.quantidade || "").trim())
    ) {
      return `Informe uma quantidade entre ${permitirEstoqueZerado ? 0 : 1} e 10.000.`;
    }
  }
  if (
    !UNIDADES_PRODUTO.includes(dados.unidade) &&
    !(permitirCamposLegadosVazios && !dados.unidade)
  ) {
    return "Selecione uma unidade válida.";
  }
  const preco = precoParaNumero(dados.preco);
  if (
    (!Number.isFinite(preco) || preco <= 0 || preco > 100000000) &&
    !(permitirCamposLegadosVazios && !String(dados.preco || "").trim())
  ) {
    return "Informe um preço maior que R$ 0,00.";
  }
  return validarUrlProduto(dados.imagemUrl);
}

export function montarAlteracoesProdutoAdmin({
  produto,
  nome,
  descricao,
  categoria,
  quantidade,
  unidade,
  preco,
  imagemUrl,
  atualizadoEm,
}) {
  const alteracoes = {
    adminCadastrado: true,
    imagemUrl: String(imagemUrl || "").trim(),
    imagemAdminDefinida: Boolean(String(imagemUrl || "").trim()),
    imagemChave: "",
    atualizadoEm,
  };
  const atualizarSeMudou = (campo, valorNovo, valorAntigo) => {
    if (valorNovo !== valorAntigo) alteracoes[campo] = valorNovo;
  };
  const textoNormalizado = (valor) => String(valor || "").trim();

  atualizarSeMudou(
    "nome",
    textoNormalizado(nome),
    textoNormalizado(produto.nome)
  );
  atualizarSeMudou(
    "descricao",
    textoNormalizado(descricao),
    textoNormalizado(produto.descricao)
  );
  atualizarSeMudou(
    "categoria",
    textoNormalizado(categoria),
    textoNormalizado(produto.categoria)
  );
  atualizarSeMudou(
    "unidade",
    textoNormalizado(unidade),
    textoNormalizado(produto.unidade)
  );

  const quantidadeNova = String(quantidade || "").trim() ? Number(quantidade) : null;
  const quantidadeAntiga =
    produto.quantidade == null ? null : Number(produto.quantidade);
  if (quantidadeNova !== quantidadeAntiga) {
    alteracoes.quantidade = quantidadeNova;
    alteracoes.status =
      quantidadeNova === 0
        ? "esgotado"
        : produto.status === "indisponivel"
          ? "indisponivel"
          : "disponivel";
  }

  const precoNovo = String(preco || "").trim()
    ? precoParaNumero(preco)
    : null;
  const precoAntigo = produto.precoAtual != null
    ? Number(produto.precoAtual)
    : precoParaNumero(produto.preco);
  if (
    precoNovo !== null &&
    Number.isFinite(precoNovo) &&
    precoNovo !== precoAntigo
  ) {
    alteracoes.preco = formatarPrecoProduto(precoNovo);
    alteracoes.precoAtual = precoNovo;
    alteracoes.precoReferencia = precoNovo;
    alteracoes.precoUnidade = unidade;
  } else if (
    textoNormalizado(unidade) !== textoNormalizado(produto.unidade) &&
    Number.isFinite(precoAntigo) &&
    precoAntigo > 0
  ) {
    alteracoes.precoUnidade = unidade;
  }

  return alteracoes;
}

export function filtrarProdutosAdmin(
  produtos,
  busca = "",
  filtro = "Todas"
) {
  const pesquisa = String(busca || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  return (produtos || []).filter((produto) => {
    const texto = `${produto.nome || ""} ${produto.descricao || ""} ${
      produto.categoria || ""
    }`
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    const statusCorreto =
      filtro === "Todas" ||
      (filtro === "Disponíveis" && produto.status === "disponivel") ||
      (filtro === "Indisponíveis" && produto.status !== "disponivel");

    return statusCorreto && texto.includes(pesquisa);
  });
}

export function montarDadosProdutoAdmin({
  nome,
  descricao,
  categoria,
  quantidade,
  unidade,
  preco,
  imagemUrl,
  status = "disponivel",
  criadoPor,
  criadoEm,
  atualizadoEm,
  ultimaDoacaoId,
  demonstracao = false,
}) {
  const precoAtual = precoParaNumero(preco);
  const url = String(imagemUrl || "").trim();

  return {
    nome: String(nome).trim(),
    estabelecimento: "Alimenta+",
    categoria,
    quantidade: Number(quantidade),
    unidade,
    cidade: "Suzano - SP",
    descricao: String(descricao || "").trim(),
    validade: "",
    preco: formatarPrecoProduto(precoAtual),
    precoAtual,
    precoAntigo: "",
    precoReferencia: precoAtual,
    precoUnidade: unidade,
    imagemChave: "",
    imagemUrl: url,
    status: Number(quantidade) === 0
      ? "esgotado"
      : status === "indisponivel"
        ? "indisponivel"
        : "disponivel",
    demonstracao,
    adminCadastrado: true,
    imagemAdminDefinida: Boolean(url),
    criadoPor,
    criadoEm,
    atualizadoEm,
    ...(ultimaDoacaoId ? { ultimaDoacaoId } : {}),
  };
}
