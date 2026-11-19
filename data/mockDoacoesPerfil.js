export const MOCK_CAMPANHAS_PERFIL = [
  {
    id: "cestas-comunidade",
    nome: "Cestas para a comunidade",
    tipo: "alimento",
    valor: 100,
    unidade: "kg",
  },
  {
    id: "refeicoes-solidarias",
    nome: "Refeições solidárias",
    tipo: "alimento",
    valor: 500,
    unidade: "unidades",
  },
  {
    id: "fundo-emergencial",
    nome: "Fundo emergencial",
    tipo: "dinheiro",
    valor: 10000,
    unidade: "R$",
  },
];

export const MOCK_DOACOES_PERFIL = [
  {
    id: "mock-doacao-01",
    campanhaId: "cestas-comunidade",
    tipo: "alimento",
    valor: 12,
    unidade: "kg",
    data: "2026-11-18T12:00:00.000Z",
    status: "Concluída",
  },
  {
    id: "mock-doacao-02",
    campanhaId: "fundo-emergencial",
    tipo: "dinheiro",
    valor: 25.5,
    unidade: "R$",
    data: "2026-11-14T12:00:00.000Z",
    status: "Concluída",
  },
  {
    id: "mock-doacao-03",
    campanhaId: "refeicoes-solidarias",
    tipo: "alimento",
    valor: 8,
    unidade: "unidades",
    data: "2026-11-10T12:00:00.000Z",
    status: "Concluída",
  },
  {
    id: "mock-doacao-04",
    campanhaId: "fundo-emergencial",
    tipo: "dinheiro",
    valor: 10,
    unidade: "R$",
    data: "2026-11-05T12:00:00.000Z",
    status: "Concluída",
  },
];
