export function validarUrlFoto(url) {
  const valor = String(url || "").trim();
  if (!valor) return "";
  if (valor.length > 2048) {
    throw new Error("O link da foto deve ter no máximo 2048 caracteres.");
  }

  try {
    const endereco = new URL(valor);
    if (
      endereco.protocol !== "https:" ||
      !endereco.hostname ||
      endereco.username ||
      endereco.password
    ) {
      throw new Error();
    }
  } catch {
    throw new Error("Informe um link HTTPS válido para a foto.");
  }

  return valor;
}

export function validarDadosPerfil(dados) {
  const nome = String(dados?.nome || "").trim();
  const telefone = String(dados?.telefone || "").trim();
  const nascimento = String(dados?.nascimento || "").trim();

  if (nome.length < 2 || nome.length > 100) {
    throw new Error("O nome deve ter entre 2 e 100 caracteres.");
  }
  if (telefone.length > 20) {
    throw new Error("O telefone deve ter no máximo 20 caracteres.");
  }
  if (
    nascimento &&
    !/^\d{2}\/\d{2}\/\d{4}$/.test(nascimento)
  ) {
    throw new Error("Use o formato DD/MM/AAAA para a data de nascimento.");
  }

  return { nome, telefone, nascimento };
}
