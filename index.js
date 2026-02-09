const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");

const qrcode = require("qrcode-terminal");
const moment = require("moment-timezone");

const OWNER_NUMBER = "233248503631@s.whatsapp.net"; // change later

function log(text) {
  console.log(`[${new Date().toLocaleTimeString()}] ${text}`);
}

async function startBot() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState("session");

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      connectTimeoutMs: 60_000
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
      try {
        const { connection, qr, lastDisconnect } = update;

        if (qr) {
          log("Scan QR code below:");
          qrcode.generate(qr, { small: true });
        }

        if (connection === "open") {
          log("Bot connected successfully ✅");
        }

        if (connection === "close") {
          const code =
            lastDisconnect?.error?.output?.statusCode;

          log("Connection closed ❌");

          if (code !== DisconnectReason.loggedOut) {
            log("Reconnecting...");
            startBot();
          } else {
            log("Logged out. Scan QR again.");
          }
        }
      } catch (err) {
        log("Connection error: " + err.message);
      }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
      try {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const sender = msg.key.participant || from;

        const text =
          msg.message.conversation ||
          msg.message.extendedTextMessage?.text ||
          "";

        if (!text.startsWith(".")) return;

        const cmd = text.trim().toLowerCase();

        if (cmd === ".ping") {
          await sock.sendMessage(from, { text: "🏓 Pong!" });
        }

        if (cmd === ".menu") {
          await sock.sendMessage(from, {
            text:
              "🤖 *Bot Menu*\n\n" +
              ".ping\n" +
              ".menu\n" +
              ".time\n" +
              ".date\n" +
              ".alive\n" +
              ".owner"
          });
        }

        if (cmd === ".time") {
          const time = moment().tz("Africa/Accra").format("HH:mm:ss");
          await sock.sendMessage(from, { text: `⏰ Time: ${time}` });
        }

        if (cmd === ".date") {
          const date = moment().tz("Africa/Accra").format("dddd, DD MMM YYYY");
          await sock.sendMessage(from, { text: `📅 Date: ${date}` });
        }

        if (cmd === ".alive") {
          await sock.sendMessage(from, { text: "✅ Bot is running." });
        }

        if (cmd === ".owner") {
          await sock.sendMessage(from, { text: "👑 Owner: NeverHide" });
        }

        if (cmd === ".restart" && sender === OWNER_NUMBER) {
          await sock.sendMessage(from, { text: "♻️ Restarting bot..." });
          process.exit(0);
        }

      } catch (err) {
        log("Message error: " + err.message);
      }
    });

  } catch (err) {
    log("Startup failed: " + err.message);
    setTimeout(startBot, 5000);
  }
}

startBot();
