const { commands } = require("./core/commandHandler");
const { getText, reply } = require("./core/utils");
const venom = require("venom-bot"); // Or your WhatsApp client

venom
  .create("session")
  .then((client) => {
    client.onMessage(async (msg) => {
      const text = getText(msg);
      if (!text.startsWith(".")) return; // Only commands with prefix

      const args = text.slice(1).trim().split(/ +/);
      const cmdName = args.shift().toLowerCase();

      const command = commands.get(cmdName);
      if (!command) return;

      try {
        await command.execute(client, msg, args);
      } catch (err) {
        console.error(err);
        await reply(client, msg, "❌ Error running this command.");
      }
    });
  })
  .catch((err) => console.error(err));
