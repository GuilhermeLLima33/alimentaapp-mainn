const PONTOS_POR_REAL = 1;
const PONTOS_POR_QUILO = 5;
const PONTOS_POR_UNIDADE = 2;

const REGRAS_CONQUISTAS = [
  {
    id: "primeira-doacao",
    nome: "Sua primeira doação!",
    descricao: "Faça sua primeira doação.",
    liberar: ({ quantidade }) => quantidade >= 1,
  },
  {
    id: "dez-doacoes",
    nome: "Você realizou 10 doações",
    descricao: "Complete 10 doações.",
    liberar: ({ quantidade }) => quantidade >= 10,
  },
  {
    id: "doacao-em-dinheiro",
    nome: "Apoio financeiro",
    descricao: "Faça uma doação em dinheiro.",
    liberar: ({ dinheiro }) => dinheiro > 0,
  },
  {
    id: "doacao-de-alimentos",
    nome: "Alimento que transforma",
    descricao: "Faça uma doação de alimentos.",
    liberar: ({ alimentos }) => alimentos.length > 0,
  },
];

function obterCampanha(campanhas, campanhaId) {
  return campanhas.find((campanha) => campanha.id === campanhaId);
}

export function calcularResumoDoacoes(doacoes, campanhas) {
  const listaDoacoes = Array.isArray(doacoes) ? doacoes : [];
  const listaCampanhas = Array.isArray(campanhas) ? campanhas : [];
  const alimentos = listaDoacoes.filter(
    (doacao) => doacao.tipo === "alimento"
  );
  const doacoesEmDinheiro = listaDoacoes.filter(
    (doacao) => doacao.tipo === "dinheiro"
  );
  const totaisAlimentos = alimentos.reduce((totais, doacao) => {
    const unidade = String(doacao.unidade || "unidades");
    totais[unidade] = (totais[unidade] || 0) + Number(doacao.valor || 0);
    return totais;
  }, {});
  const totalDinheiro = doacoesEmDinheiro.reduce(
    (total, doacao) => total + Number(doacao.valor || 0),
    0
  );
  const pontos =
    Math.floor(totalDinheiro) * PONTOS_POR_REAL +
    alimentos.reduce((total, doacao) => {
      const valor = Number(doacao.valor || 0);
      return (
        total +
        Math.floor(
          valor *
            (doacao.unidade === "kg"
              ? PONTOS_POR_QUILO
              : PONTOS_POR_UNIDADE)
        )
      );
    }, 0);

  return {
    quantidade: listaDoacoes.length,
    totalDinheiro,
    totaisAlimentos,
    pontos,
    doacoes: listaDoacoes.map((doacao) => ({
      ...doacao,
      campanha: obterCampanha(listaCampanhas, doacao.campanhaId),
    })),
  };
}

export function obterConquistasDoacoes(doacoes, campanhas) {
  const resumo = calcularResumoDoacoes(doacoes, campanhas);
  const contexto = {
    quantidade: resumo.quantidade,
    dinheiro: resumo.totalDinheiro,
    alimentos: Object.values(resumo.totaisAlimentos).filter(
      (quantidade) => quantidade > 0
    ),
  };

  return REGRAS_CONQUISTAS.map((regra) => ({
    id: regra.id,
    nome: regra.nome,
    descricao: regra.descricao,
    desbloqueada: regra.liberar(contexto),
  }));
}

export function calcularTotalConquistas(doacoes, campanhas) {
  return obterConquistasDoacoes(doacoes, campanhas).filter(
    (conquista) => conquista.desbloqueada
  ).length;
}

export function formatarValorDoacao(doacao) {
  const valor = Number(doacao?.valor || 0);
  if (!Number.isFinite(valor)) return "—";

  if (doacao?.tipo === "dinheiro") {
    return valor.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  const quantidade = Number.isInteger(valor)
    ? String(valor)
    : valor.toLocaleString("pt-BR");
  return `${quantidade} ${doacao?.unidade || "unidades"}`;
}

export function formatarResumoDoacoes(resumo) {
  const alimentos = Object.entries(resumo?.totaisAlimentos || {})
    .map(([unidade, quantidade]) => {
      const formatado = Number.isInteger(quantidade)
        ? String(quantidade)
        : Number(quantidade).toLocaleString("pt-BR");
      return `${formatado} ${unidade}`;
    })
    .join(", ");

  return {
    alimentos: alimentos || "Nenhum",
    dinheiro: Number(resumo?.totalDinheiro || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    }),
  };
}
