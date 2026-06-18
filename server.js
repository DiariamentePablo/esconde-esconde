const express = require("express");
const http = require("http");
const path = require("path");
const { WebSocketServer, WebSocket } = require("ws");

const PORT = 3000;

const app = express();
const servidor = http.createServer(app);
const wss = new WebSocketServer({ server: servidor });

const jogadores = new Map();
let tabuleiro = Array(49).fill("");
let vez = "X";
let status = "aguardando";
let vencedor = null;

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
})

function simbolosAtivos() {
    const ativos = [];
    for (const [socket, dados] of jogadores) {
        if (socket.readyState === WebSocket.OPEN && dados.simbolo) {
            ativos.push(dados.simbolo);
        }
    }
    return ativos;
}

function atribuirSimbolo() {
    const ativos = simbolosAtivos();
    if (!ativos.includes("X")) return "X";
    if (!ativos.includes("O")) return "O";
    return null;
}

function enviar(socket, obj) {
    if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(obj));
    }
}

function mensagemStatus() {
    if (status === "aguardando") return "Aguardando segundo jogador";
    if (status === "fim" && vencedor === "empate") return "Empate";
    if (status === "fim" && vencedor) return `${vencedor} venceu!`;
    return `Vez de ${vez}`;
}

function broadcastEstado() {
    for (const [socket, dados] of jogadores) {
        enviar(socket, {
            tipo: "estado",
            tabuleiro,
            vez,
            voce: dados.simbolo,
            status,
            vencedor,
            mensagem: mensagemStatus()
        })
    }
}

function vencedorDoTabuleiro() {
    for (const [a, b, c] of LINHAS) {
        if (tabuleiro[a] && tabuleiro[a] === tabuleiro[b] && tabuleiro[b] === tabuleiro[c]) {
            return tabuleiro[a];
        }
    }
    return null;
}

function tabuleiroCheio() {
    return tabuleiro.every((c) => c !== "");
}

function processarJogada(socket, posicao) {
    const dados = jogadores.get(socket);
    if (!dados?.simbolo) return;
    if (status !== "jogando") return;
    if (dados.simbolo !== vez) return;
    if (!Number.isInteger(posicao) || posicao < 0 || posicao > 8) return;
    if (tabuleiro[posicao]) return;

    tabuleiro[posicao] = dados.simbolo;
    const ganhou = vencedorDoTabuleiro();
    if (ganhou) {
        status = "fim";
        vencedor = ganhou;
    } else if (tabuleiroCheio()) {
        status = "fim";
        vencedor = "empate";
    } else {
        vez = vez === "X" ? "O" : "X";
    }
    broadcastEstado();
}

wss.on("connection", (socket) => {
    const simbolo = atribuirSimbolo();
    jogadores.set(socket, { simbolo });
    console.log(simbolosAtivos(), status);
    if (simbolosAtivos().length === 2 && status !== "fim") {
        status = "jogando";
    }
    enviar(socket, {
        tipo: "estado",
        tabuleiro,
        vez,
        voce: simbolo,
        status,
        vencedor,
        mensagem: simbolo ? simbolo === "X" ? "Você é o X. Aguardando o O..." : "Você é o O..." : "Partida cheia. Você está assistindo"
    });
    broadcastEstado();

    socket.on("message", (raw) => {
        let msg;
        try {
            msg = JSON.parse(String(raw));
        } catch (err) {
            enviar(socket, { tipo: "erro", texto: "Envie JSON válido" });
            return;
        }

        if (msg.tipo === "jogada") {
            processarJogada(socket, Number(msg.posicao));
            return;
        }
    })

    socket.on("close", () => {

    })
})

servidor.listen(PORT, () => {
    console.log(`Esconde-Esconde: http://localhost:${PORT}`);
})