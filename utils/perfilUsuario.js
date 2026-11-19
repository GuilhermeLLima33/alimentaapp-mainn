import {
  updateProfile,
} from "firebase/auth";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { auth } from "../firebase";
import { db } from "../firebaseDb";
import {
  lerPerfilLocal,
  salvarPerfilLocal,
} from "./perfilLocal";
import {
  validarDadosPerfil,
  validarUrlFoto,
} from "./validacaoPerfil";

const TEMPO_LIMITE_SALVAMENTO_MS = 20000;

async function aguardarResposta(operacao, mensagem) {
  let temporizador;
  try {
    return await Promise.race([
      operacao,
      new Promise((_, rejeitar) => {
        temporizador = setTimeout(
          () => rejeitar(new Error(mensagem)),
          TEMPO_LIMITE_SALVAMENTO_MS
        );
      }),
    ]);
  } finally {
    clearTimeout(temporizador);
  }
}

export async function carregarPerfilUsuario(uid) {
  if (!uid) {
    throw new Error("Entre na sua conta novamente.");
  }

  const local = await lerPerfilLocal(uid);
  const snapshot = await getDoc(doc(db, "perfis", uid));
  const remoto = snapshot.exists() ? snapshot.data() : {};
  const fotoSalva =
    remoto.fotoUrl ||
    auth.currentUser?.photoURL ||
    local.fotoUri ||
    "";

  const perfil = {
    ...local,
    ...remoto,
    nome:
      remoto.nome ||
      local.nome ||
      auth.currentUser?.displayName ||
      "",
    telefone: remoto.telefone ?? local.telefone ?? "",
    nascimento: remoto.nascimento ?? local.nascimento ?? "",
    fotoUri: /^https:\/\//i.test(fotoSalva) ? fotoSalva : null,
  };

  await salvarPerfilLocal(uid, perfil);

  return perfil;
}

export async function salvarPerfilUsuario(uid, dados) {
  if (!uid || auth.currentUser?.uid !== uid) {
    throw new Error("Entre na sua conta novamente.");
  }

  const campos = validarDadosPerfil(dados);
  const fotoUrl = validarUrlFoto(dados.fotoUrl);

  const referencia = doc(db, "perfis", uid);
  const perfil = {
    ...campos,
    fotoUrl,
    atualizadoEm: serverTimestamp(),
  };

  await aguardarResposta(
    setDoc(referencia, perfil, { merge: true }),
    "O Firestore não respondeu. Verifique a conexão e se as regras do Firestore foram publicadas."
  );
  if (auth.currentUser?.uid !== uid) {
    throw new Error("A sessão terminou antes de concluir o salvamento.");
  }
  await aguardarResposta(
    updateProfile(auth.currentUser, {
      displayName: campos.nome,
      photoURL: fotoUrl || null,
    }),
    "O Firebase Auth demorou para atualizar o perfil. Tente novamente."
  );

  const perfilLocal = {
    ...campos,
    fotoUri: fotoUrl || null,
  };
  await salvarPerfilLocal(uid, perfilLocal);

  return perfilLocal;
}
