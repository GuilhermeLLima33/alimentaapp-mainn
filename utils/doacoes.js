export const FILTROS_DOACOES = [
  "Todas",
  "Em andamento",
  "Concluídas",
];

export const ORDENACOES_DOACOES = [
  "Mais recentes",
  "Mais antigas",
  "Maior valor",
  "Menor valor",
  "Maior quantidade",
  "Menor quantidade",
];

function normalizarTexto(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function obterDataMillis(valor) {
  if (typeof valor?.toMillis === "function") {
    return valor.toMillis();
  }

  if (typeof valor?.toDate === "function") {
    return valor.toDate().getTime();
  }

  if (valor instanceof Date) {
    return valor.getTime();
  }

  if (typeof valor === "number") {
    return valor;
  }

  const texto = String(valor || "");
  const dataBR = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto);

  if (dataBR) {
    const dia = Number(dataBR[1]);
    const mes = Number(dataBR[2]);
    const ano = Number(dataBR[3]);
    const data = new Date(ano, mes - 1, dia);

    return data.getFullYear() === ano &&
      data.getMonth() === mes - 1 &&
      data.getDate() === dia
      ? data.getTime()
      : NaN;
  }

  return texto ? new Date(texto).getTime() : NaN;
}

export function statusDoacaoValido(doacao) {
  const status = normalizarTexto(doacao?.status);
  const pagamento = normalizarTexto(doacao?.pagamentoStatus);
  const pagamentoConfirmado =
    doacao?.pagamentoConfirmado === true ||
    pagamento === "confirmado";
  const pagamentoPendente =
    pagamento === "aguardando_pagamento";
  const simulacaoConcluida =
    pagamento === "simulacao_concluida";
  const pagamentoFinalizado =
    pagamentoConfirmado || simulacaoConcluida;

  if (
    !String(doacao?.nome || "").trim() ||
    !Number.isFinite(obterDataMillis(doacao?.criadoEm))
  ) {
    return null;
  }

  if (
    ["em andamento", "pendente", "pending"].includes(status) &&
    pagamentoPendente
  ) {
    return "Em andamento";
  }

  if (
    (["concluida", "concluido"].includes(status) ||
      status === "em andamento") &&
    pagamentoFinalizado
  ) {
    return "Concluída";
  }

  return null;
}

export function criarDestinoDoacao(doacao) {
  const status = statusDoacaoValido(doacao);
  const doacaoId = String(doacao?.doacaoId || doacao?.id || "");

  if (!doacaoId) return null;

  if (status === "Em andamento") {
    if (doacao.tipoDoacao === "campanha") {
      const valorCentavos = Math.round(
        Number(doacao.total ?? doacao.precoAtual ?? 0) * 100
      );
      if (!Number.isSafeInteger(valorCentavos) || valorCentavos <= 0) {
        return null;
      }

      return {
        name: "TelaSeuPedido",
        params: {
          pedido: {
            fluxo: "doacaoCampanha",
            doacaoId,
            nomeCampanha: doacao.nome,
            valorCentavos,
          },
        },
      };
    }

    const itens = Array.isArray(doacao.itens) ? doacao.itens : [];
    if (itens.length === 0) return null;

    return {
      name: "TelaSeuPedido",
      params: {
        pedido: {
          fluxo: "carrinhoDoacoes",
          doacaoId,
          itens: itens.map((item) => {
            const id = item.produtoId || item.id;
            const preco = item.precoUnitario ?? item.preco;
            return {
              produtoId: id,
              id,
              nome: item.nome,
              quantidade: item.quantidade,
              unidade: item.unidade,
              precoUnitario: preco,
              preco,
              precoUnidade: item.precoUnidade,
              categoria: item.categoria,
              cidade: item.cidade,
              imagemChave: item.imagemChave,
              estabelecimento: item.estabelecimento,
              descricao: item.descricao,
            };
          }),
        },
      },
    };
  }

  if (status === "Concluída") {
    const subtotalCentavos = Math.round(
      Number(doacao.total ?? doacao.precoAtual ?? 0) * 100
    );
    if (!Number.isSafeInteger(subtotalCentavos) || subtotalCentavos < 0) {
      return null;
    }

    return {
      name: "TelaConfirmacaoDoacaoSimulada",
      params: {
        subtotalCentavos,
        totalCentavos: Number.isSafeInteger(doacao.totalSimuladoCentavos)
          ? doacao.totalSimuladoCentavos
          : subtotalCentavos,
        pagamento: doacao.formaPagamento || "pix",
        status:
          doacao.pagamentoStatus === "simulacao_concluida"
            ? "Simulação concluída"
            : status,
        parcelas: doacao.parcelas,
        valorParcelaCentavos: doacao.valorParcelaCentavos,
        ultimaParcelaCentavos: doacao.ultimaParcelaCentavos,
        jurosPercentual: doacao.jurosPercentual,
      },
    };
  }

  return null;
}

export function filtrarDoacoes(
  doacoes,
  filtro = "Todas",
  busca = ""
) {
  const pesquisa = normalizarTexto(busca);
  const statusFiltro =
    filtro === "Concluídas" ? "Concluída" : filtro;

  return (doacoes || []).filter((doacao) => {
    const status = statusDoacaoValido(doacao);

    if (!status || (statusFiltro !== "Todas" && status !== statusFiltro)) {
      return false;
    }

    const textoBusca = normalizarTexto([
      doacao.nome,
      doacao.descricao,
      doacao.estabelecimento,
      doacao.criadoPor,
    ].join(" "));

    return textoBusca.includes(pesquisa);
  });
}

function obterValor(doacao) {
  const valor = doacao.total ?? doacao.precoAtual ?? doacao.preco;

  if (typeof valor === "number") {
    return Number.isFinite(valor) ? valor : 0;
  }

  const texto = String(valor || "")
    .replace(/[^\d,.-]/g, "");
  const numero = Number(
    texto.includes(",")
      ? texto.replace(/\./g, "").replace(",", ".")
      : texto
  );

  return Number.isFinite(numero) ? numero : 0;
}

function obterQuantidade(doacao) {
  const quantidade = Number(
    doacao.quantidadeItens ??
    doacao.quantidade ??
    doacao.itens?.length ??
    0
  );

  return Number.isFinite(quantidade) ? quantidade : 0;
}

export function ordenarDoacoes(doacoes, ordenacao = "Mais recentes") {
  const ordenadores = {
    "Mais recentes": (a, b) =>
      obterDataMillis(b.criadoEm) - obterDataMillis(a.criadoEm),
    "Mais antigas": (a, b) =>
      obterDataMillis(a.criadoEm) - obterDataMillis(b.criadoEm),
    "Maior valor": (a, b) => obterValor(b) - obterValor(a),
    "Menor valor": (a, b) => obterValor(a) - obterValor(b),
    "Maior quantidade": (a, b) =>
      obterQuantidade(b) - obterQuantidade(a),
    "Menor quantidade": (a, b) =>
      obterQuantidade(a) - obterQuantidade(b),
  };
  const comparar = ordenadores[ordenacao] || ordenadores["Mais recentes"];

  return [...(doacoes || [])].sort(comparar);
}
