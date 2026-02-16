const config = require("../config");

exports.buildMenu = (users = 0, groups = 0) => {
  return `
╔════════════════════════════╗
║   🤖 ${config.BOT_NAME}   ║
╠════════════════════════════╣
║ 👥 Group Management        ║
║ 🔐 Admin Controls          ║
║ ⚠️ Warning System          ║
║ 🎮 Games Arena             ║
║ 💰 Economy Center          ║
║ 📚 Learning Hub            ║
║ 🤲 Prayer Corner           ║
║ 🎵 Entertainment Zone      ║
║ 🤖 AI Assistant            ║
╠════════════════════════════╣
║ Users: ${users}
║ Groups: ${groups}
║ Version: 1.0.0
╚════════════════════════════╝
`;
};
