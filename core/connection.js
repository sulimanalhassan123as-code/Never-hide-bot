const makeWASocket = require("@whiskeysockets/baileys").default;
const { useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");
const { Boom } = require("@hapi/boom");

async function startConnection() {
  const { state, saveCreds } = await useMultiFileAuthState("session");

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    logger: pino({ level: "silent" }),
    browser: ["NEVER HIDE SUPER BOT", "Chrome", "1.0.0"],
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "close") {
      const shouldReconnect =
        new Boom(lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;

      console.log("Connection closed. Reconnecting:", shouldReconnect);

      if (shouldReconnect) {
        startConnection();
      }
    } else if (connection === "open") {
      console.log("🤖 NEVER HIDE SUPER BOT is ONLINE");
    }
  });

  return sock;
}

module.exports = startConnection;
