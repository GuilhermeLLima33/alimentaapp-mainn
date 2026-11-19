const IMAGENS = {
  cesta: require("../assets/images/tabIcons/cesta-basica.png"),
  arroz: require("../assets/images/tabIcons/arroz.png"),
  leite: require("../assets/images/tabIcons/leite.png"),
  alface: require("../assets/images/tabIcons/alface.png"),
  cafe: require("../assets/images/tabIcons/cafe.png"),
};

const META_MAXIMA_CAMPANHA = 100000000;

export const CATEGORIAS_CAMPANHA = [
  "Alimentos",
  "Cestas básicas",
  "Escolas",
  "Institucional",
  "Emergencial",
];

export const FILTROS_CAMPANHA = [
  "Todas",
  "Ativa",
  "Pausada",
  "Encerrada",
];

export function statusCampanhaPermitidos(statusAtual) {
  if (statusAtual === "Ativa") {
    return ["Ativa", "Pausada", "Encerrada"];
  }

  if (statusAtual === "Pausada") {
    return ["Pausada", "Ativa", "Encerrada"];
  }

  if (statusAtual === "Encerrada") {
    return ["Encerrada"];
  }

  return [];
}

export function transicaoStatusCampanhaPermitida(
  statusAtual,
  proximoStatus
) {
  return statusCampanhaPermitidos(statusAtual)
    .includes(proximoStatus);
}

export function imagemCampanha(campanha) {
  if (!campanha) {
    return null;
  }

  const imagemUrl =
    campanha?.imagemUrl ||
    campanha?.imageUrl;

  if (
    typeof imagemUrl === "string" &&
    imagemUrl.trim()
  ) {
    return { uri: imagemUrl.trim() };
  }

  if (campanha?.imagemChave === null) {
    return null;
  }

  return IMAGENS[campanha?.imagemChave] || IMAGENS.cesta;
}

export function formatarMoedaBR(valor) {
  return Number(valor || 0).toLocaleString(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL",
    }
  );
}

export function textoNormalizado(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function dataBRValida(valor) {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(valor)) {
    return null;
  }

  const [dia, mes, ano] = valor
    .split("/")
    .map(Number);

  const data = new Date(
    ano,
    mes - 1,
    dia
  );

  return (
    data.getFullYear() === ano &&
    data.getMonth() === mes - 1 &&
    data.getDate() === dia
  )
    ? data
    : null;
}

export function validarPeriodoCampanha(inicio, termino) {
  const dataInicio = dataBRValida(inicio);
  const dataTermino = dataBRValida(termino);

  if (!dataInicio || !dataTermino) {
    return "Digite datas válidas no formato dd/mm/aaaa.";
  }

  if (dataTermino < dataInicio) {
    return "A data de término não pode ser anterior à data de início.";
  }

  return "";
}

export function validarUrlImagem(valor) {
  const texto = String(valor || "").trim();

  if (!texto) {
    return "";
  }

  try {
    const url = new URL(texto);

    if (
      url.protocol !== "https:" ||
      !url.hostname ||
      url.username ||
      url.password
    ) {
      throw new Error("URL de imagem inválida.");
    }
  } catch {
    return "Informe um link HTTPS público e direto para a imagem.";
  }

  return "";
}

export function campanhaVisivelParaCliente(campanha) {
  return campanha?.exemplo !== true;
}

export function filtrarCampanhas(
  campanhas,
  busca = "",
  filtro = "Todas"
) {
  const pesquisa = textoNormalizado(
    String(busca || "").trim()
  );

  return (campanhas || [])
    .filter(campanhaVisivelParaCliente)
    .filter((campanha) => {
      const texto = textoNormalizado(
        `${campanha.nome || ""} ${campanha.descricao || ""}`
      );

      return (
        texto.includes(pesquisa) &&
        (
          filtro === "Todas" ||
          campanha.status === filtro
        )
      );
    });
}

export function montarDadosNovaCampanha({
  nome,
  descricao,
  categoria,
  inicio,
  termino,
  meta,
  imagemUrl,
  criadoPor,
  criadoEm,
  atualizadoEm,
}) {
  return {
    nome: nome.trim(),
    descricao: descricao.trim(),
    categoria,
    inicio,
    termino,
    meta,
    status: "Ativa",
    imagemChave: null,
    imagemUrl: imagemUrl?.trim() || null,
    exemplo: false,
    criadoPor,
    criadoEm,
    atualizadoEm,
  };
}

export function moedaParaNumero(texto) {
  const limpo = String(texto || "")
    .replace(/[^0-9,\.]/g, "");

  if (!limpo) {
    return 0;
  }

  const numero = Number(
    limpo
      .replace(/\./g, "")
      .replace(",", ".")
  );

  return (
    Number.isFinite(numero) &&
    numero >= 0 &&
    numero <= META_MAXIMA_CAMPANHA
  )
    ? numero
    : NaN;
}