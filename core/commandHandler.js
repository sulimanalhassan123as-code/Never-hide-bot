const fs = require("fs");
const path = require("path");

const commandFolders = fs.readdirSync(path.join(__dirname, "../commands"));

const commands = new Map();

// Load all commands dynamically
for (const folder of commandFolders) {
  const commandFiles = fs.readdirSync(path.join(__dirname, "../commands", folder)).filter(f => f.endsWith(".js"));
  for (const file of commandFiles) {
    const command = require(`../commands/${folder}/${file}`);
    commands.set(command.name, command);
    if (command.alias) command.alias.forEach(a => commands.set(a, command));
  }
}

module.exports = { commands };
