exports.getText = (msg) => {
  return (
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    ""
  );
};

exports.reply = async (sock, msg, text) => {
  await sock.sendMessage(msg.key.remoteJid, { text }, { quoted: msg });
};
