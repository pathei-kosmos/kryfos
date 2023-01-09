const wsc = new WebSocket("ws://" + window.location.host + "/chat");
const form = document.querySelector("form");
const input = document.querySelector("#msg-input");
const msgArea = document.querySelector(".msg-area");
let pseudo = "";
let connectedUsers = [];

function playSound(url) {
  const audio = new Audio(url);
  audio.play();
};

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const txt = input.value;
  if (txt.length > 0) {
    sendMsg(txt);
    input.value = "";
  }
});

function sendMsg(txt) {
  wsc.send(JSON.stringify({ event: "message", payload: txt, author: pseudo }));
}

setInterval(() => {
  wsc.send(JSON.stringify({ event: "ping" }));
}, 29000);

wsc.addEventListener("close", () => {
  console.log("disconnected");
  window.location.replace("/logout");
});

wsc.addEventListener("message", (msg) => {
  const data = JSON.parse(msg.data);

  if (data.event === "pong") {
    return;
  }

  if (data.event === "message") {
    playSound('../../sounds/soap.mp3');
    let card = document.createElement("div");
    card.className = "msg-card";

    let cardPseudo = document.createElement("span");

    let cardMsg = document.createElement("p");

    cardPseudo.innerText = `${data.author} → `;
    card.appendChild(cardPseudo);

    cardMsg.innerText = data.payload;
    card.appendChild(cardMsg);

    msgArea.appendChild(card);

    msgArea.scrollTop = msgArea.scrollHeight - msgArea.clientHeight;
  }

  if (data.event === "pseudo") {
    pseudo = data.payload;
  }

  if (data.event === "connectedUsers") {
    playSound('../../sounds/popalert.mp3');
    showConnectedUsers(data.payload);
  }
});
