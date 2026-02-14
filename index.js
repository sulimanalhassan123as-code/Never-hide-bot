const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const http = require('http');
const config = require('./config');

// --- 🌐 RENDER SERVER ---
const PORT = process.env.PORT || 3000;
let currentPairingCode = "Waiting for code...";

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
        <html style="font-family: sans-serif; text-align: center; padding-top: 50px;">
            <h2>WhatsApp Bot Server</h2>
            <div style="font-size: 40px; font-weight: bold; background: #eee; padding: 20px; display: inline-block;">
                ${currentPairingCode}
            </div>
        </html>
    `);
});
server.listen(PORT, () => console.log(`🌐 Web server running on port ${PORT}`));

// --- 🤖 BOT MEMORY ---
let currentBotName = config.botName; 

async function startBot() {
    console.log(`🟢 STARTING ENGINE: ${currentBotName}...`);

    if (fs.existsSync('auth_info') && !fs.existsSync('auth_info/creds.json')) {
        fs.rmSync('auth_info', { recursive: true, force: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        browser: ["Mac OS", "Safari", "10.15.7"], 
        markOnlineOnConnect: true
    });

    if (!sock.authState.creds.me && !sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                const num = config.ownerNumber.replace(/[^0-9]/g, '');
                const code = await sock.requestPairingCode(num);
                currentPairingCode = code?.match(/.{1,4}/g)?.join("-") || code;
                console.log(`\n✅ SEND THIS CODE TO YOUR FRIEND: ${currentPairingCode}\n`);
            } catch (err) {
                console.log("⚠️ Error generating code. Please check config.js");
            }
        }, 3000);
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const reason = (lastDisconnect?.error)?.output?.statusCode;
            console.log(`⚠️ Connection Closed! Reason code: ${reason}`);
            
            if (reason !== DisconnectReason.loggedOut) {
                console.log("🔄 Reconnecting in 5 seconds to prevent crash loop...");
                setTimeout(startBot, 5000); // <-- THE SAFETY BRAKE
            } else {
                console.log("⛔ Logged out.");
            }
        } else if (connection === 'open') {
            console.log(`✅ BOT CONNECTED TO WHATSAPP!`);
            currentPairingCode = "Connected! ✅";
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // --- 📱 MEGA MENU & COMMANDS ---
    sock.ev.on('messages.upsert', async (m) => {
        try {
            const msg = m.messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const from = msg.key.remoteJid;
            const isGroup = from.endsWith('@g.us');
            const type = Object.keys(msg.message)[0];
            const body = (type === 'conversation') ? msg.message.conversation :
                         (type === 'extendedTextMessage') ? msg.message.extendedTextMessage.text : '';

            const senderName = msg.pushName || "User";

            if (body.startsWith(config.prefix)) {
                const args = body.slice(config.prefix.length).trim().split(' ');
                const command = args.shift().toLowerCase();
                const textArg = args.join(" ");

                switch (command) {
                    case 'menu':
                        const menuText = `
╔════ 🤖 *${currentBotName.toUpperCase()}* ════╗
║ 👋 Hello, *${senderName}*!
║ 👑 Developer: *${config.ownerName}*
╚════════════════════════╝

*🛠️ MAIN TOOLS*
▸ *${config.prefix}setname [name]* - Rename the bot
▸ *${config.prefix}ping* - Check speed
▸ *${config.prefix}info* - Bot information

*👥 GROUP COMMANDS (Admins)*
▸ *${config.prefix}hidetag [text]* - Notify all silently
▸ *${config.prefix}kick @user* - Remove someone
▸ *${config.prefix}promote @user* - Make admin
▸ *${config.prefix}demote @user* - Remove admin
▸ *${config.prefix}groupinfo* - Group details

*🎮 FUN MENU*
▸ *${config.prefix}joke* - Random joke
▸ *${config.prefix}fact* - Random fact
▸ *${config.prefix}flip* - Flip a coin
▸ *${config.prefix}roll* - Roll a dice
`;
                        await sock.sendMessage(from, { text: menuText.trim() });
                        break;

                    case 'setname':
                        if (!textArg) return await sock.sendMessage(from, { text: `❌ Provide a name! Example: *${config.prefix}setname AlphaBot*` });
                        currentBotName = textArg;
                        await sock.sendMessage(from, { text: `✅ My name is now: *${currentBotName}*` });
                        break;

                    case 'ping':
                        await sock.sendMessage(from, { text: `Pong! 🏓\nBot is running perfectly.` });
                        break;

                    case 'info':
                        await sock.sendMessage(from, { text: `ℹ️ *Bot Info*\nDeployed by: ${config.ownerName}\nCurrent Name: ${currentBotName}\nStatus: Online 🟢` });
                        break;

                    // --- GROUP COMMANDS ---
                    case 'hidetag':
                        if (!isGroup) return await sock.sendMessage(from, { text: `❌ This command only works in groups!` });
                        try {
                            const groupMetadata = await sock.groupMetadata(from);
                            const participants = groupMetadata.participants;
                            const allJids = participants.map(p => p.id);
                            await sock.sendMessage(from, { text: textArg || "📢 Attention everyone!", mentions: allJids });
                        } catch (err) {
                            await sock.sendMessage(from, { text: `❌ I need to be an admin to do this.` });
                        }
                        break;

                    case 'kick':
                        if (!isGroup) return await sock.sendMessage(from, { text: `❌ This command only works in groups!` });
                        const userToKick = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
                        if (!userToKick) return await sock.sendMessage(from, { text: `❌ Please mention the user. Example: *${config.prefix}kick @user*` });
                        try {
                            await sock.groupParticipantsUpdate(from, [userToKick], "remove");
                            await sock.sendMessage(from, { text: `✅ User successfully kicked.` });
                        } catch (err) {
                            await sock.sendMessage(from, { text: `❌ I cannot kick them. Make sure I am a group admin!` });
                        }
                        break;

                    case 'promote':
                        if (!isGroup) return await sock.sendMessage(from, { text: `❌ This command only works in groups!` });
                        const userToPromote = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
                        if (!userToPromote) return await sock.sendMessage(from, { text: `❌ Please mention the user.` });
                        try {
                            await sock.groupParticipantsUpdate(from, [userToPromote], "promote");
                            await sock.sendMessage(from, { text: `✅ User promoted to Admin.` });
                        } catch (err) {
                            await sock.sendMessage(from, { text: `❌ Make sure I am an admin first!` });
                        }
                        break;

                    case 'demote':
                        if (!isGroup) return await sock.sendMessage(from, { text: `❌ This command only works in groups!` });
                        const userToDemote = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
                        if (!userToDemote) return await sock.sendMessage(from, { text: `❌ Please mention the user.` });
                        try {
                            await sock.groupParticipantsUpdate(from, [userToDemote], "demote");
                            await sock.sendMessage(from, { text: `✅ User demoted to regular member.` });
                        } catch (err) {
                            await sock.sendMessage(from, { text: `❌ Make sure I am an admin first!` });
                        }
                        break;

                    case 'groupinfo':
                        if (!isGroup) return await sock.sendMessage(from, { text: `❌ This command only works in groups!` });
                        try {
                            const groupMeta = await sock.groupMetadata(from);
                            const infoText = `*Group Name:* ${groupMeta.subject}\n*Members:* ${groupMeta.participants.length}\n*Owner:* @${groupMeta.owner?.split('@')[0] || 'Unknown'}`;
                            await sock.sendMessage(from, { text: infoText, mentions: [groupMeta.owner] });
                        } catch (err) {
                            await sock.sendMessage(from, { text: `❌ Error fetching group info.` });
                        }
                        break;

                    // --- FUN COMMANDS ---
                    case 'joke':
                        const jokes = ["Why do programmers prefer dark mode? Because light attracts bugs. 🐛", "I invented a new word! Plagiarism! 😂"];
                        await sock.sendMessage(from, { text: jokes[Math.floor(Math.random() * jokes.length)] });
                        break;

                    case 'fact':
                        const facts = ["Water makes up about 71% of the Earth's surface. 🌍", "A day on Venus is longer than a year on Venus. 🪐"];
                        await sock.sendMessage(from, { text: facts[Math.floor(Math.random() * facts.length)] });
                        break;

                    case 'flip':
                        const coin = Math.random() < 0.5 ? "Heads" : "Tails";
                        await sock.sendMessage(from, { text: `🪙 You flipped a coin... Result: *${coin}*!` });
                        break;

                    case 'roll':
                        const dice = Math.floor(Math.random() * 6) + 1;
                        await sock.sendMessage(from, { text: `🎲 You rolled a dice and got: *${dice}*` });
                        break;
                }
            }
        } catch (err) {
            console.log("Message Error:", err);
        }
    });
}

startBot();
