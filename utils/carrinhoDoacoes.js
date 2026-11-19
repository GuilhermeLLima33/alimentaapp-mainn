import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { auth } from "../firebase";
import { db } from "../firebaseDb";
import { obterPrecoAtual } from "./precosProdutos";
import {
  atualizarQuantidadeLocal,
  limparCarrinhoLocal,
  lerCarrinhoLocal,
  removerDoCarrinhoLocal,
  salvarNoCarrinhoLocal,
  usarCarrinhoLocal,
} from "./carrinhoLocal";
import {
  criarAtualizacaoDoacaoConcluida,
  criarDadosDoacaoCampanha,
  criarDadosDoacaoAgrupada,
  validarQuantidadeCarrinho,
} from "./carrinhoCalculos";

const LIMITE_ITENS_CARRINHO = 50;

function usuarioAutenticado(uid) {
  const usuario = auth.currentUser;

  if (!usuario || (uid && usuario.uid !== uid)) {
    throw new Error("Faça login novamente para usar o carrinho.");
  }

  return usuario.uid;
}

function obterPrecoProduto(produto) {
  return Math.max(0, obterPrecoAtual(produto) ?? 0);
}

function criarItemCarrinho(produtoId, produto, quantidade) {
  const imagemUrl =
    produto.imagemAdminDefinida === true &&
    typeof produto.imagemUrl === "string" &&
    /^https:\/\//i.test(produto.imagemUrl.trim())
      ? produto.imagemUrl.trim()
      : "";

  return {
    produtoId,
    quantidade,
    nome: produto.nome || "Alimento",
    unidade: produto.unidade || "unidades",
    precoUnitario: obterPrecoProduto(produto),
    precoUnidade: produto.precoUnidade || produto.unidade || "unidade",
    categoria: produto.categoria || "Outros",
    cidade: produto.cidade || "A combinar",
    imagemChave: produto.imagemChave || "",
    imagemUrl,
    imagemAdminDefinida: Boolean(imagemUrl),
    estabelecimento: produto.estabelecimento || "Doador",
    descricao: produto.descricao || "",
    demonstracao: produto.demonstracao === true,
    disponibilidade: lerEstoque(produto),
  };
}

function podeUsarCarrinhoLocal(erro) {
  return ["permission-denied", "unavailable"].includes(erro?.code);
}

function lerEstoque(produto) {
  const estoque = Number(produto.quantidade);

  return Number.isFinite(estoque) && estoque >= 0 ? estoque : 0;
}

function normalizarAssinatura(itens = []) {
  return [...itens]
    .map((item) => ({
      produtoId: String(item.produtoId || item.id || ""),
      quantidade: Number(item.quantidade),
      precoUnitario:
        Math.round(Number(item.precoUnitario || 0) * 100) / 100,
    }))
    .sort((a, b) => a.produtoId.localeCompare(b.produtoId));
}

export async function adicionarProdutoAoCarrinho(
  produtoId,
  quantidade,
  uid,
  produtoConhecido
) {
  const dono = usuarioAutenticado(uid);
  const id = String(produtoId || "");

  if (!id || !Number.isInteger(Number(quantidade)) || Number(quantidade) < 1) {
    throw new Error("Escolha uma quantidade válida.");
  }

  const carrinhoRef = doc(db, "carrinhos", dono);
  const alimentoRef = doc(db, "alimentos", id);

  if (await usarCarrinhoLocal(dono)) {
    if (!produtoConhecido) {
      throw new Error("Não foi possível validar o alimento para o carrinho.");
    }

    await salvarNoCarrinhoLocal(
      dono,
      criarItemCarrinho(id, produtoConhecido, 0),
      quantidade
    );
    return "local";
  }

  try {
    await runTransaction(db, async (transacao) => {
      const [alimentoSnapshot, carrinhoSnapshot] = await Promise.all([
        transacao.get(alimentoRef),
        transacao.get(carrinhoRef),
      ]);

      if (!alimentoSnapshot.exists()) {
        throw new Error("Este alimento não está mais disponível.");
      }

      const produto = alimentoSnapshot.data();
      const estoque = lerEstoque(produto);
      const itensAtuais = Array.isArray(carrinhoSnapshot.data()?.itens)
        ? carrinhoSnapshot.data().itens
        : [];
      const itemAtual = itensAtuais.find((item) => item.produtoId === id);
      const quantidadeFinal =
        Number(quantidade) + Number(itemAtual?.quantidade || 0);

      if (
        produto.status !== "disponivel" ||
        !validarQuantidadeCarrinho(quantidadeFinal, estoque)
      ) {
        throw new Error(
          `Disponibilidade insuficiente. Restam ${estoque} ${produto.unidade || "unidades"}.`
        );
      }

      if (!itemAtual && itensAtuais.length >= LIMITE_ITENS_CARRINHO) {
        throw new Error(
          `O carrinho aceita no máximo ${LIMITE_ITENS_CARRINHO} produtos diferentes.`
        );
      }

      const novoItem = criarItemCarrinho(id, produto, quantidadeFinal);
      const itens = [
        ...itensAtuais.filter((item) => item.produtoId !== id),
        novoItem,
      ];

      transacao.set(carrinhoRef, {
        criadoPor: dono,
        criadoEm: carrinhoSnapshot.exists()
          ? carrinhoSnapshot.data().criadoEm || serverTimestamp()
          : serverTimestamp(),
        atualizadoEm: serverTimestamp(),
        itens,
      });
    });
    return "firestore";
  } catch (erro) {
    if (!podeUsarCarrinhoLocal(erro) || !produtoConhecido) throw erro;

    await salvarNoCarrinhoLocal(
      dono,
      criarItemCarrinho(id, produtoConhecido, 0),
      quantidade
    );
    return "local";
  }
}

export async function alterarQuantidadeNoCarrinho(
  produtoId,
  quantidade,
  uid
) {
  const dono = usuarioAutenticado(uid);
  const id = String(produtoId || "");
  const novaQuantidade = Number(quantidade);

  if (!id || !Number.isInteger(novaQuantidade) || novaQuantidade < 1) {
    throw new Error("A quantidade deve ser pelo menos 1.");
  }

  const carrinhoRef = doc(db, "carrinhos", dono);
  const alimentoRef = doc(db, "alimentos", id);

  if (await usarCarrinhoLocal(dono)) {
    await atualizarQuantidadeLocal(dono, id, novaQuantidade);
    return "local";
  }

  try {
    await runTransaction(db, async (transacao) => {
      const [alimentoSnapshot, carrinhoSnapshot] = await Promise.all([
        transacao.get(alimentoRef),
        transacao.get(carrinhoRef),
      ]);

      if (!carrinhoSnapshot.exists() || !alimentoSnapshot.exists()) {
        throw new Error("O alimento não está mais disponível.");
      }

      const produto = alimentoSnapshot.data();
      const estoque = lerEstoque(produto);
      const itensAtuais = Array.isArray(carrinhoSnapshot.data().itens)
        ? carrinhoSnapshot.data().itens
        : [];

      if (
        produto.status !== "disponivel" ||
        !validarQuantidadeCarrinho(novaQuantidade, estoque)
      ) {
        throw new Error(
          `Quantidade acima do estoque atual. Restam ${estoque} ${produto.unidade || "unidades"}.`
        );
      }

      if (!itensAtuais.some((item) => item.produtoId === id)) {
        throw new Error("Este alimento não está no carrinho.");
      }

      const itens = itensAtuais.map((item) =>
        item.produtoId === id
          ? criarItemCarrinho(id, produto, novaQuantidade)
          : item
      );

      transacao.update(carrinhoRef, {
        itens,
        atualizadoEm: serverTimestamp(),
      });
    });
    return "firestore";
  } catch (erro) {
    if (!podeUsarCarrinhoLocal(erro)) throw erro;
    await atualizarQuantidadeLocal(dono, id, novaQuantidade);
    return "local";
  }
}

export async function removerProdutoDoCarrinho(produtoId, uid) {
  const dono = usuarioAutenticado(uid);
  const carrinhoRef = doc(db, "carrinhos", dono);

  if (await usarCarrinhoLocal(dono)) {
    await removerDoCarrinhoLocal(dono, String(produtoId));
    return "local";
  }

  try {
    await runTransaction(db, async (transacao) => {
      const carrinhoSnapshot = await transacao.get(carrinhoRef);

      if (!carrinhoSnapshot.exists()) return;

      const itensAtuais = Array.isArray(carrinhoSnapshot.data().itens)
        ? carrinhoSnapshot.data().itens
        : [];

      transacao.update(carrinhoRef, {
        itens: itensAtuais.filter(
          (item) => item.produtoId !== String(produtoId)
        ),
        atualizadoEm: serverTimestamp(),
      });
    });
    return "firestore";
  } catch (erro) {
    if (!podeUsarCarrinhoLocal(erro)) throw erro;
    await removerDoCarrinhoLocal(dono, String(produtoId));
    return "local";
  }
}

export async function sincronizarCarrinhoLocal(uid) {
  const dono = usuarioAutenticado(uid);
  if (!(await usarCarrinhoLocal(dono))) return null;

  const itensLocais = await lerCarrinhoLocal(dono);
  const carrinhoRef = doc(db, "carrinhos", dono);

  try {
    const itensSincronizados = await runTransaction(
      db,
      async (transacao) => {
        const carrinhoSnapshot = await transacao.get(carrinhoRef);
        const itensRemotos = Array.isArray(carrinhoSnapshot.data()?.itens)
          ? carrinhoSnapshot.data().itens
          : [];
        const mapaItens = new Map(
          itensRemotos.map((item) => [item.produtoId, item])
        );

        itensLocais.forEach((item) => {
          const itemRemoto = mapaItens.get(item.produtoId);
          mapaItens.set(item.produtoId, {
            ...item,
            quantidade:
              Number(item.quantidade) + Number(itemRemoto?.quantidade || 0),
          });
        });

        const itensParaSincronizar = [...mapaItens.values()];
        if (itensParaSincronizar.length > LIMITE_ITENS_CARRINHO) {
          throw new Error(
            `O carrinho aceita no máximo ${LIMITE_ITENS_CARRINHO} produtos diferentes.`
          );
        }

        const referencias = itensParaSincronizar.map((item) =>
          doc(db, "alimentos", item.produtoId)
        );
        const snapshots = await Promise.all(
          referencias.map((referencia) => transacao.get(referencia))
        );
        const itensAtualizados = snapshots.map((snapshot, index) => {
          const item = itensParaSincronizar[index];
          if (!snapshot.exists()) {
            throw new Error(`${item.nome} não está mais disponível.`);
          }

          const produto = snapshot.data();
          if (
            produto.status !== "disponivel" ||
            !validarQuantidadeCarrinho(
              item.quantidade,
              lerEstoque(produto)
            )
          ) {
            throw new Error(
              `Estoque insuficiente para ${produto.nome || item.nome}. Revise a quantidade do carrinho.`
            );
          }

          return criarItemCarrinho(
            item.produtoId,
            produto,
            item.quantidade
          );
        });

        transacao.set(carrinhoRef, {
          criadoPor: dono,
          criadoEm: carrinhoSnapshot.exists()
            ? carrinhoSnapshot.data().criadoEm || serverTimestamp()
            : serverTimestamp(),
          atualizadoEm: serverTimestamp(),
          itens: itensAtualizados,
        });

        return itensAtualizados;
      }
    );

    await limparCarrinhoLocal(dono);
    return itensSincronizados;
  } catch (erro) {
    if (podeUsarCarrinhoLocal(erro)) return false;
    throw erro;
  }
}

function validarEstruturaItensCarrinho(itens) {
  if (!Array.isArray(itens) || itens.length === 0) {
    throw new Error("Adicione pelo menos um alimento ao carrinho.");
  }

  if (
    itens.length > LIMITE_ITENS_CARRINHO ||
    itens.some(
      (item) =>
        typeof item.produtoId !== "string" ||
        !item.produtoId ||
        !Number.isInteger(Number(item.quantidade)) ||
        Number(item.quantidade) < 1
    ) ||
    new Set(itens.map((item) => item.produtoId)).size !== itens.length
  ) {
    throw new Error(
      "O carrinho contém itens inválidos. Revise-o e tente novamente."
    );
  }
}

async function validarItensCarrinho(
  transacao,
  itensCarrinho,
  itensEsperados
) {
  validarEstruturaItensCarrinho(itensCarrinho);

  const referencias = itensCarrinho.map((item) =>
    doc(db, "alimentos", item.produtoId)
  );
  const snapshots = await Promise.all(
    referencias.map((referencia) => transacao.get(referencia))
  );
  const itensAtualizados = snapshots.map((snapshot, index) => {
    const itemCarrinho = itensCarrinho[index];

    if (!snapshot.exists()) {
      throw new Error(`${itemCarrinho.nome} não está mais disponível.`);
    }

    const produto = snapshot.data();
    const estoque = lerEstoque(produto);

    if (
      produto.status !== "disponivel" ||
      !validarQuantidadeCarrinho(itemCarrinho.quantidade, estoque)
    ) {
      throw new Error(
        `Estoque insuficiente para ${produto.nome || itemCarrinho.nome}. Restam ${estoque} ${produto.unidade || "unidades"}.`
      );
    }

    return {
      produtoId: itemCarrinho.produtoId,
      ...criarItemCarrinho(
        itemCarrinho.produtoId,
        produto,
        itemCarrinho.quantidade
      ),
    };
  });

  if (
    !Array.isArray(itensEsperados) ||
    JSON.stringify(normalizarAssinatura(itensEsperados)) !==
      JSON.stringify(normalizarAssinatura(itensAtualizados))
  ) {
    throw new Error(
      "O carrinho ou os preços mudaram. Revise os itens antes de continuar."
    );
  }

  return { referencias, snapshots, itensAtualizados };
}

export async function iniciarDoacaoCarrinho(itensEsperados, uid) {
  const dono = usuarioAutenticado(uid);
  if (await usarCarrinhoLocal(dono)) {
    throw new Error(
      "Sincronize o carrinho com o Firestore antes de iniciar o pagamento."
    );
  }

  const carrinhoRef = doc(db, "carrinhos", dono);
  const doacaoRef = doc(collection(db, "minhasDoacoes"));

  return runTransaction(db, async (transacao) => {
    const carrinhoSnapshot = await transacao.get(carrinhoRef);
    if (!carrinhoSnapshot.exists()) {
      throw new Error("O carrinho está vazio.");
    }

    const itensCarrinho = Array.isArray(carrinhoSnapshot.data().itens)
      ? carrinhoSnapshot.data().itens
      : [];
    const { itensAtualizados } = await validarItensCarrinho(
      transacao,
      itensCarrinho,
      itensEsperados
    );
    const dadosDoacao = criarDadosDoacaoAgrupada(itensAtualizados, dono);

    transacao.set(doacaoRef, {
      ...dadosDoacao,
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    });

    return { doacaoId: doacaoRef.id, total: dadosDoacao.total };
  });
}

export async function iniciarDoacaoCampanha(
  valorCentavos,
  campanha,
  uid
) {
  const dono = usuarioAutenticado(uid);
  const dadosDoacao = criarDadosDoacaoCampanha(
    valorCentavos,
    campanha,
    dono
  );
  const doacaoRef = doc(collection(db, "minhasDoacoes"));

  await runTransaction(db, async (transacao) => {
    transacao.set(doacaoRef, {
      ...dadosDoacao,
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    });
  });

  return { doacaoId: doacaoRef.id, total: dadosDoacao.total };
}

export async function concluirDoacaoCampanha(
  doacaoId,
  uid,
  dadosPagamento
) {
  const dono = usuarioAutenticado(uid);
  if (typeof doacaoId !== "string" || !doacaoId) {
    throw new Error("Não foi possível localizar a doação em andamento.");
  }

  const doacaoRef = doc(db, "minhasDoacoes", doacaoId);

  return runTransaction(db, async (transacao) => {
    const snapshot = await transacao.get(doacaoRef);
    if (!snapshot.exists()) {
      throw new Error("A doação em andamento não foi encontrada.");
    }

    const doacao = snapshot.data();
    if (
      doacao.criadoPor !== dono ||
      doacao.tipoDoacao !== "campanha"
    ) {
      throw new Error("Você não pode concluir esta doação de campanha.");
    }

    if (
      doacao.status === "Concluída" &&
      doacao.pagamentoStatus === "simulacao_concluida"
    ) {
      return { doacaoId, total: doacao.total };
    }

    const atualizacao = criarAtualizacaoDoacaoConcluida(
      doacao,
      dadosPagamento
    );
    transacao.update(doacaoRef, {
      ...atualizacao,
      atualizadoEm: serverTimestamp(),
    });

    return { doacaoId, total: doacao.total };
  });
}

export async function concluirDoacaoCarrinho(
  doacaoId,
  itensEsperados,
  uid,
  dadosPagamento
) {
  const dono = usuarioAutenticado(uid);
  if (typeof doacaoId !== "string" || !doacaoId) {
    throw new Error("Não foi possível localizar a doação em andamento.");
  }

  const carrinhoRef = doc(db, "carrinhos", dono);
  const doacaoRef = doc(db, "minhasDoacoes", doacaoId);

  return runTransaction(db, async (transacao) => {
    const doacaoSnapshot = await transacao.get(doacaoRef);
    if (!doacaoSnapshot.exists()) {
      throw new Error("A doação em andamento não foi encontrada.");
    }

    const dadosDoacao = doacaoSnapshot.data();
    if (dadosDoacao.criadoPor !== dono) {
      throw new Error("Você não pode concluir esta doação.");
    }

    if (
      dadosDoacao.status === "Concluída" &&
      dadosDoacao.pagamentoStatus === "simulacao_concluida"
    ) {
      return { doacaoId, total: dadosDoacao.total };
    }

    const atualizacaoConclusao = criarAtualizacaoDoacaoConcluida(
      dadosDoacao,
      dadosPagamento
    );
    const carrinhoSnapshot = await transacao.get(carrinhoRef);
    const itensDoacao = Array.isArray(dadosDoacao.itens)
      ? dadosDoacao.itens
      : [];
    if (
      !Array.isArray(itensEsperados) ||
      JSON.stringify(normalizarAssinatura(itensDoacao)) !==
        JSON.stringify(normalizarAssinatura(itensEsperados))
    ) {
      throw new Error(
        "Os itens desta doação não correspondem ao pedido de pagamento."
      );
    }

    const { referencias, snapshots, itensAtualizados } =
      await validarItensCarrinho(
        transacao,
        itensDoacao,
        itensEsperados
      );

    if (
      JSON.stringify(normalizarAssinatura(itensDoacao)) !==
      JSON.stringify(normalizarAssinatura(itensAtualizados))
    ) {
      throw new Error(
        "Os itens ou preços da doação em andamento mudaram. Volte e revise o pedido."
      );
    }

    itensAtualizados.forEach((item, index) => {
      const estoqueAtual = lerEstoque(snapshots[index].data());
      const estoqueRestante = estoqueAtual - item.quantidade;

      transacao.update(referencias[index], {
        quantidade: estoqueRestante,
        status: estoqueRestante === 0 ? "esgotado" : "disponivel",
        atualizadoEm: serverTimestamp(),
        ultimaDoacaoId: doacaoId,
      });
    });

    transacao.update(doacaoRef, {
      ...atualizacaoConclusao,
      atualizadoEm: serverTimestamp(),
    });

    const itensCarrinho = carrinhoSnapshot.exists() &&
      Array.isArray(carrinhoSnapshot.data().itens)
      ? carrinhoSnapshot.data().itens
      : [];
    if (
      carrinhoSnapshot.exists() &&
      JSON.stringify(normalizarAssinatura(itensCarrinho)) ===
        JSON.stringify(normalizarAssinatura(itensDoacao))
    ) {
      transacao.update(carrinhoRef, {
        itens: [],
        atualizadoEm: serverTimestamp(),
      });
    }

    return { doacaoId, total: dadosDoacao.total };
  });
}

export { LIMITE_ITENS_CARRINHO };