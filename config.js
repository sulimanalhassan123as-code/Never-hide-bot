require("dotenv").config();

module.exports = {
  prefix: process.env.PREFIX || ".",
  botName: process.env.BOT_NAME || "NEVER HIDE SUPER BOT",
  aiApiUrl: process.env.AI_API_URL,
  aiApiKey: process.env.AI_API_KEY,
  sessionName: process.env.SESSION_NAME || "session",
};
