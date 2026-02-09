import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason
} from "@whiskeysockets/baileys";

import P from "pino";
import readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("session");

  const sock = makeWASocket({
    auth: state,
    logger: P({ level: "silent" }),
    printQRInTerminal: false,
    browser: ["Ubuntu", "Chrome", "22.04"]
  });

  // Save session automatically
  sock.ev.on("creds.update", saveCreds);

  // Ask for phone number and generate pairing code
  if (!sock.authState.creds.registered) {
    rl.question(
      "Enter WhatsApp number with country code (e.g. 233XXXXXXXXX): ",
      async (number) => {
        try {
          const code = await sock.requestPairingCode(number.trim());
          console.log("\n🔐 PAIRING CODE:", code);
          console.log("👉 Open WhatsApp → Linked Devices → Link with phone number\n");
          rl.close();
        } catch (err) {
          console.error("❌ Failed to get pairing code:", err.message);
          process.exit(1);
        }
      }
    );
  }

  // Connection handler
  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "open") {
      console.log("✅ WhatsApp connected successfully");
    }

    if (connection === "close") {
      const reason = lastDisconnect?.error?.output?.statusCode;
      console.log("⚠️ Connection closed. Reconnecting...");

      if (reason !== DisconnectReason.loggedOut) {
        startBot();
      } else {
        console.log("❌ Logged out. Delete session folder and restart.");
      }
    }
  });

  // Message listener (basic command)
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text;

    if (text === ".ping") {
      await sock.sendMessage(msg.key.remoteJid, {
        text: "🏓 Pong! Bot is alive."
      });
    }
  });
}

startBot();
