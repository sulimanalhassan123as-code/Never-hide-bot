const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const http = require('http');
const config = require('./config');

// --- 🌐 RENDER SERVER ---
const PORT = process.env.PORT || 3000;
let currentPairingCode = "Waiting for code...";
let codeRequested = false; // 🔒 THE ANTI-LOOP LOCK

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
        <html style="font-family: sans-serif; text-align: center; padding-top: 50px;">
            <h2>WhatsApp Group Bot Server</h2>
            <div style="font-size: 40px; font-weight: bold; background: #eee; padding: 20px; display: inline-block;">
                ${currentPairingCode}
            </div>
            <p>Refresh page to see the code.</p>
        </html>
    `);
});
server.listen(PORT, () => console.log(`🌐 Web server running on port ${PORT}`));

let currentBotName = config.botName; 

async function startBot() {
    console.log(`🟢 STARTING ENGINE: ${currentBotName}...`);
    
    const sessionFolder = 'bot_session';
    if (!fs.existsSync(sessionFolder)) fs.mkdirSync(sessionFolder);

    const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        browser: ["Mac OS", "Safari", "10.15.7"], 
        markOnlineOnConnect: true
    });

    // 🔒 Request code ONLY if it hasn't been requested yet
    if (!sock.authState.creds.registered && !codeRequested) {
        codeRequested = true; 
        setTimeout(async () => {
            try {
                const num = config.ownerNumber.replace(/[^0-9]/g, '');
                const code = await sock.requestPairingCode(num);
                currentPairingCode = code?.match(/.{1,4}/g)?.join("-") || code;
                console.log(`\n✅ SEND THIS CODE TO YOUR FRIEND: ${currentPairingCode}\n`);
            } catch (err) {
                console.log("⚠️ Error generating code.");
                codeRequested = false; // Unlock if it fails so it can try again
            }
        }, 3000);
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const reason = (lastDisconnect?.error)?.output?.statusCode;
            console.log(`⚠️ Connection Closed! Reason: ${reason}`);
            
            // If WhatsApp rejects the old code, wipe memory and unlock the code generator
            if (reason === 401 || reason === 405) {
                try { fs.rmSync(sessionFolder, { recursive: true, force: true }); } catch(e) {}
                codeRequested = false; 
            }
            setTimeout(startBot, 5000);
        } else if (connection === 'open') {
            console.log(`✅ BOT CONNECTED TO WHATSAPP!`);
            currentPairingCode = "Connected! ✅";
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // --- 📱 THE ULTIMATE GROUP MENU ---
    sock.ev.on('messages.upsert', async (m) => {
        try {
            const msg = m.messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const from = msg.key.remoteJid;
            const isGroup = from.endsWith('@g.us');
            const sender = isGroup ? msg.key.participant : from;
            
            const type = Object.keys(msg.message)[0];
            const body = (type === 'conversation') ? msg.message.conversation :
                         (type === 'extendedTextMessage') ? msg.message.extendedTextMessage.text : '';

            const senderName = msg.pushName || "Member";

            if (body.startsWith(config.prefix)) {
                const args = body.slice(config.prefix.length).trim().split(' ');
                const command = args.shift().toLowerCase();
                const textArg = args.join(" ");

                const isOwner = sender.includes(config.ownerNumber);
                let isAdmin = false;
                let isBotAdmin = false;

                if (isGroup) {
                    const groupMetadata = await sock.groupMetadata(from);
                    const admins = groupMetadata.participants.filter(p => p.admin !== null).map(p => p.id);
                    isAdmin = admins.includes(sender);
                    const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
                    isBotAdmin = admins.includes(botId);
                }

                const isAuthorized = isOwner || isAdmin;

                switch (command) {
                    case 'menu':
                        const menuText = `
╔════ 👑 *${currentBotName.toUpperCase()}* 👑 ════╗
║ Welcome to the Group, *${senderName}*!
╚═════════════════════════╝

*🛡️ ADMIN CONTROLS*
▸ *${config.prefix}hidetag [text]* - Ping everyone
▸ *${config.prefix}kick @user* - Remove user
▸ *${config.prefix}promote @user* - Make Admin
▸ *${config.prefix}demote @user* - Remove Admin
▸ *${config.prefix}mute* - Lock chat
▸ *${config.prefix}unmute* - Unlock chat
▸ *${config.prefix}link* - Group link

*🎭 GAMES & FUN*
▸ *${config.prefix}truth* - Truth question
▸ *${config.prefix}dare* - Dare challenge
▸ *${config.prefix}roast* - Roast someone
▸ *${config.prefix}rizz* - Pickup line
▸ *${config.prefix}8ball [text]* - See the future

*🧠 COMPANION*
▸ *${config.prefix}advice* - Daily wisdom
▸ *${config.prefix}joke* - Random joke
▸ *${config.prefix}fact* - Random fact
`;
                        await sock.sendMessage(from, { text: menuText.trim() });
                        break;

                    case 'hidetag':
                        if (!isGroup || !isAuthorized) return;
                        const groupMetadata = await sock.groupMetadata(from);
                        const allJids = groupMetadata.participants.map(p => p.id);
                        await sock.sendMessage(from, { text: textArg || "📢 Attention everyone!", mentions: allJids });
                        break;

                    case 'kick':
                        if (!isGroup || !isAuthorized || !isBotAdmin) return;
                        const userToKick = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
                        if (userToKick) await sock.groupParticipantsUpdate(from, [userToKick], "remove");
                        break;

                    case 'promote':
                        if (!isGroup || !isAuthorized || !isBotAdmin) return;
                        const userToPromote = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
                        if (userToPromote) await sock.groupParticipantsUpdate(from, [userToPromote], "promote");
                        break;

                    case 'demote':
                        if (!isGroup || !isAuthorized || !isBotAdmin) return;
                        const userToDemote = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
                        if (userToDemote) await sock.groupParticipantsUpdate(from, [userToDemote], "demote");
                        break;

                    case 'mute':
                        if (!isGroup || !isAuthorized || !isBotAdmin) return;
                        await sock.groupSettingUpdate(from, 'announcement');
                        await sock.sendMessage(from, { text: `🔒 Group Muted.` });
                        break;

                    case 'unmute':
                        if (!isGroup || !isAuthorized || !isBotAdmin) return;
                        await sock.groupSettingUpdate(from, 'not_announcement');
                        await sock.sendMessage(from, { text: `🔓 Group Unmuted.` });
                        break;

                    case 'link':
                        if (!isGroup || !isAuthorized || !isBotAdmin) return;
                        const code = await sock.groupInviteCode(from);
                        await sock.sendMessage(from, { text: `🔗 https://chat.whatsapp.com/${code}` });
                        break;

                    case 'truth':
                        const truths = ["Most embarrassing moment?", "Biggest lie?", "Weirdest habit?"];
                        await sock.sendMessage(from, { text: `🎯 *TRUTH:* ${truths[Math.floor(Math.random() * truths.length)]}` });
                        break;

                    case 'dare':
                        const dares = ["Send your 5th picture.", "Send a voice note singing.", "Type using your nose."];
                        await sock.sendMessage(from, { text: `🔥 *DARE:* ${dares[Math.floor(Math.random() * dares.length)]}` });
                        break;

                    case 'roast':
                        const roasts = ["I’m not insulting you, I’m describing you.", "You bring joy... when you leave."];
                        await sock.sendMessage(from, { text: `🔥 *Roast:* ${roasts[Math.floor(Math.random() * roasts.length)]}` });
                        break;
                        
                    case 'rizz':
                        const rizzLines = ["Are you Wi-Fi? I feel a connection.", "Are you a magician? Everyone else disappears."];
                        await sock.sendMessage(from, { text: `😏 *Rizz:* ${rizzLines[Math.floor(Math.random() * rizzLines.length)]}` });
                        break;

                    case '8ball':
                        const answers = ["Yes. 🟢", "Ask again later. 🟡", "No. 🔴"];
                        await sock.sendMessage(from, { text: `🎱 *8-Ball:* ${answers[Math.floor(Math.random() * answers.length)]}` });
                        break;

                    case 'advice':
                        await sock.sendMessage(from, { text: `💡 Keep pushing forward.` });
                        break;

                    case 'joke':
                        await sock.sendMessage(from, { text: `😂 What do you call fake spaghetti? An impasta!` });
                        break;

                    case 'fact':
                        await sock.sendMessage(from, { text: `🧠 Octopuses have three hearts. 🐙` });
                        break;
                }
            }
        } catch (err) {
            console.log("Message Error:", err);
        }
    });
}

startBot();
