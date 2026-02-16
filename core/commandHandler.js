const fs = require("fs");
const path = require("path");
const { reply } = require("./utils");

module.exports = async (sock, msg, text) => {
  try {
    // Split command and args
    const args = text.trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // Define prefix
    const prefix = "."; // from your bot setup

    if (!command.startsWith(prefix)) return;

    const cmdName = command.slice(prefix.length);

    // Search commands folder
    const categories = fs.readdirSync(path.join(__dirname, "../commands"));

    let found = false;

    for (let category of categories) {
      const categoryPath = path.join(__dirname, "../commands", category);
      if (!fs.lstatSync(categoryPath).isDirectory()) continue;

      const files = fs.readdirSync(categoryPath);

      for (let file of files) {
        if (!file.endsWith(".js")) continue;

        const commandModule = require(path.join(categoryPath, file));

        if (commandModule.name === cmdName || (commandModule.alias && commandModule.alias.includes(cmdName))) {
          await commandModule.execute(sock, msg, args);
          found = true;
          break;
        }
      }
      if (found) break;
    }

    if (!found) {
      await reply(sock, msg, "❌ Command not found. Use .help to see available commands.");
    }
  } catch (err) {
    console.error(err);
    await reply(sock, msg, "❌ Error executing command.");
  }
};
