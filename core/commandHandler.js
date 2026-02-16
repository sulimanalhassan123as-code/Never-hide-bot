const config = require("../config");
const { getText, reply } = require("./utils");
const { buildMenu } = require("./menuBuilder");

exports.handleCommand = async (sock, msg) => {
  const text = getText(msg);
  if (!text.startsWith(config.PREFIX)) return;

  const args = text.slice(1).trim().split(" ");
  const cmd = args.shift().toLowerCase();

  switch (cmd) {
    case "menu":
      await reply(sock, msg, buildMenu(120, 15));
      break;

    case "ping":
      await reply(sock, msg, "🏓 Pong! Bot alive.");
      break;

    case "alive":
      await reply(
        sock,
        msg,
        `✅ ${config.BOT_NAME} is running smoothly.`
      );
      break;

    default:
      await reply(sock, msg, "❌ Unknown command. Type .menu");
  }
};
