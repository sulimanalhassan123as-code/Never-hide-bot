require("dotenv").config();
const startConnection = require("./core/connection");
const commandHandler = require("./core/commandHandler");
const { getText, reply } = require("./core/utils");

async function main() {
  const sock = await startConnection();

  // Listen to messages
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];

    // Ignore system messages
    if (!msg.message || msg.key.fromMe) return;

    // Get the text
    const text = getText(msg);

    if (!text) return;

    // Pass message to command handler
    await commandHandler(sock, msg, text);
  });
}

main().catch(console.error);
