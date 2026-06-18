const express = require("express");
const http = require("http");
const path = require("path");
const { WebSocketServer, WebSocket } = require("ws");

const PORT = 3000;
const TAM = 7;
const TOTAL_CASAS = TAM * TAM;

const app = express();
app.use(express.static(__dirname));

const servidor = http.createServer(app);
const wss = new WebSocketServer({ server: servidor });

const jogadores = new Map();
let estado = null;

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// utilidades
function enviar(socket, obj) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(obj));
  }
}
function broadcastEstado() {
  for (const [socket, dados] of jogadores) {
    const visivel = {
      ...estado,
      voce: dados.papel,
      // escondedor só visível para ele mesmo ou se procurador está adjacente
      escondedorVisivel:
        dados.papel === "escondedor" ||
        (dados.papel === "procurador" && estado.escondedorVisivel),
    };
    enviar(socket, { tipo: "estado", ...visivel });
  }
}
function posToCoord(pos) {
  return { x: pos % TAM, y: Math.floor(pos / TAM) };
}
function coordToPos(x, y) {
  return y * TAM + x;
}
function adjacentes(pos) {
  const { x, y } = posToCoord(pos);
  const coords = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < TAM && ny >= 0 && ny < TAM) {
        coords.push(coordToPos(nx, ny));
      }
    }
  }
  return coords;
}
function ortogonais(pos) {
  const { x, y } = posToCoord(pos);
  const coords = [];
  [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dy])=>{
    const nx = x+dx, ny=y+dy;
    if(nx>=0 && nx<TAM && ny>=0 && ny<TAM){
      coords.push(coordToPos(nx,ny));
    }
  });
  return coords;
}

// inicializa partida
function iniciarPartida() {
  const centro = coordToPos(3, 3);
  const obstaculos = [];
  while (obstaculos.length < 5) {
    const pos = Math.floor(Math.random() * TOTAL_CASAS);
    if (pos !== centro && !obstaculos.includes(pos)) {
      obstaculos.push(pos);
    }
  }
  estado = {
    status: "jogando",
    procurador: { pos: centro, movimentos: 0 },
    escondedor: { pos: null },
    vez: "escondedor", // escondedor escolhe posição inicial
    obstaculos,
    escondedorVisivel: false,
    mensagem: "Escondedor escolha sua posição inicial",
  };
}

// processa movimento
function processarMovimento(socket, destino) {
  const dados = jogadores.get(socket);
  if (!dados?.papel) return;
  if (estado.status !== "jogando") return;
  if (dados.papel !== estado.vez) return;

  const atual = dados.papel === "procurador" ? estado.procurador : estado.escondedor;
  if (estado.obstaculos.includes(destino)) return;

  // regras de movimento
  if (dados.papel === "escondedor") {
    if (atual.pos === null) {
      // primeira escolha: não pode estar adjacente ao procurador
      if (adjacentes(estado.procurador.pos).includes(destino) || destino === estado.procurador.pos) return;
      atual.pos = destino;
      estado.vez = "procurador";
      estado.mensagem = "Vez do procurador";
    } else {
      if (!adjacentes(atual.pos).includes(destino)) return;
      atual.pos = destino;
      estado.vez = "procurador";
      estado.mensagem = "Vez do procurador";
    }
  } else if (dados.papel === "procurador") {
    if (!ortogonais(atual.pos).includes(destino)) return;
    atual.pos = destino;
    atual.movimentos += 1;
    if (atual.movimentos >= 2) {
      atual.movimentos = 0;
      estado.vez = "escondedor";
      estado.mensagem = "Vez do escondedor";
    } else {
      estado.mensagem = "Procurador pode mover novamente";
    }
  }

  // checa visibilidade
  estado.escondedorVisivel = adjacentes(estado.procurador.pos).includes(estado.escondedor.pos);

  // checa captura
  if (estado.escondedor.pos !== null && estado.procurador.pos === estado.escondedor.pos) {
    estado.status = "fim";
    estado.mensagem = "Procurador capturou o escondedor!";
  }

  broadcastEstado();
}

wss.on("connection", (socket) => {
  let papel = null;
  if (![...jogadores.values()].some((j) => j.papel === "procurador")) {
    papel = "procurador";
  } else if (![...jogadores.values()].some((j) => j.papel === "escondedor")) {
    papel = "escondedor";
  }
  jogadores.set(socket, { papel });

  if (papel === "procurador" && estado === null) {
    iniciarPartida();
  }

  enviar(socket, {
    tipo: "estado",
    ...estado,
    voce: papel,
    escondedorVisivel:
      papel === "escondedor" ||
      (papel === "procurador" && estado.escondedorVisivel),
  });
  broadcastEstado();

  socket.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      enviar(socket, { tipo: "erro", texto: "Envie JSON válido" });
      return;
    }
    if (msg.tipo === "movimento") {
      processarMovimento(socket, Number(msg.destino));
    }
  });

  socket.on("close", () => {
    jogadores.delete(socket);
  });
});

servidor.listen(PORT, () => {
    console.log(`Esconde-Esconde: http://localhost:${PORT}`);
});
