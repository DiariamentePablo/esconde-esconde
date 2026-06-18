// client.js
const protocolo = location.protocol === "https:" ? "wss:" : "ws:";
const ws = new WebSocket(`${protocolo}//${location.host}`);

const statusEl = document.getElementById("status");
const connEl = document.getElementById("conn");
const reiniciarBtn = document.getElementById("reiniciar");
const voceEl = document.getElementById("voce");
const tabuleiroEl = document.getElementById("tabuleiro");

let estadoAtual = null;

// cria os botões do tabuleiro
for (let i = 0; i < 49; i++) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.dataset.pos = String(i);
  btn.textContent = "";
  btn.addEventListener("click", () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    // envia movimento para o servidor
    ws.send(JSON.stringify({ tipo: "movimento", destino: i }));
  });
  tabuleiroEl.appendChild(btn);
}

// função de renderização adaptada
function renderizar(estado) {
  estadoAtual = estado;
  statusEl.textContent = estado.mensagem || "";
  voceEl.textContent = estado.voce ? `Você é o ${estado.voce}` : "Espectador";
  reiniciarBtn.disabled = estado.status !== "fim";

  const botoes = tabuleiroEl.querySelectorAll("button");
  botoes.forEach((btn, i) => {
    let valor = "";

    if (estado.obstaculos.includes(i)) {
      valor = "🧱";
    }
    if (estado.procurador.pos === i) {
      valor = "👀";
    }
    if (estado.voce === "escondedor") {
      if (estado.escondedor.pos === i) {
        valor = "👤";
      }
    } else {
      if (estado.escondedorVisivel && estado.escondedor.pos === i) {
        valor = "👤";
      }
    }

    btn.textContent = valor;

    // habilita clique apenas se for sua vez
    const podeJogar = estado.status === "jogando" && estado.voce === estado.vez;
    btn.disabled = !podeJogar;
  });
}

// eventos do WebSocket
ws.addEventListener("open", () => {
  console.log("WebSocket conectado!");
  connEl.textContent = "Conectado";
});

ws.addEventListener("close", () => {
  connEl.textContent = "Desconectado";
  statusEl.textContent = "Conexão Perdida";
});

ws.addEventListener("message", (ev) => {
  let msg;
  try {
    msg = JSON.parse(ev.data);
  } catch {
    return;
  }
  if (msg.tipo === "estado") {
    renderizar(msg);
  }
});
