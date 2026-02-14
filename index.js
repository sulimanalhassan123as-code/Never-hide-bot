const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto'); // ensure crypto is available
const config = require('./config');

const PORT = process.env.PORT || 3000;
let pairingCodes = {}; // Store current pairing codes for each user

const server = http.createServer((req,res)=>{
    res.writeHead(200,{'Content-Type':'text/html'});
    let html = `<html style="font-family:sans-serif;text-align:center;padding-top:50px;">
        <h2>NeverHide Multi-User Bot</h2>`;
    
    for(let user in pairingCodes){
        html += `<div style="font-size:30px;font-weight:bold;background:#eee;padding:20px;margin:10px;">
            ${user}: ${pairingCodes[user]}
        </div>`;
    }

    html += `<p>Refresh to see updates</p></html>`;
    res.end(html);
});
server.listen(PORT,()=>console.log(`🌐 Web server running on port ${PORT}`));

let sessions = {}; // Store multiple socket instances

async function startBot(userLabel){
    const sessionFolder = `bot_session_${userLabel}`;
    if(!fs.existsSync(sessionFolder)) fs.mkdirSync(sessionFolder);

    const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);
    const sock = makeWASocket({
        logger: pino({level:'silent'}),
        printQRInTerminal: false,
        auth: state,
        browser:["NeverHide","Bot","1.0"],
        markOnlineOnConnect:true
    });

    sessions[userLabel] = sock;

    // Connection events
    sock.ev.on('connection.update',(update)=>{
        const { connection, lastDisconnect } = update;
        if(connection==='close'){
            const reason = (lastDisconnect?.error)?.output?.statusCode;
            console.log(`[${userLabel}] Connection closed. Reason: ${reason||"Unknown"}`);
            setTimeout(()=>startBot(userLabel),5000);
        } else if(connection==='open'){
            console.log(`[${userLabel}] Connected ✅`);
            pairingCodes[userLabel]="Connected!";
        }
    });

    sock.ev.on('creds.update',saveCreds);

    // Generate pairing code for new user if not connected
    if(!fs.existsSync(`${sessionFolder}/state.json`)){
        const code = crypto.randomBytes(3).toString('hex').toUpperCase();
        pairingCodes[userLabel]=code.match(/.{1,4}/g).join('-');
        console.log(`[${userLabel}] Pairing code: ${pairingCodes[userLabel]}`);
    }

    // Message handler (same as before)
    sock.ev.on('messages.upsert', async (m)=>{
        try{
            const msg = m.messages[0];
            if(!msg.message || msg.key.fromMe) return;

            const from = msg.key.remoteJid;
            const isGroup = from.endsWith('@g.us');
            const type = Object.keys(msg.message)[0];
            const body = (type==='conversation') ? msg.message.conversation :
                         (type==='extendedTextMessage') ? msg.message.extendedTextMessage.text : '';
            const senderName = msg.pushName || "User";

            if(!body.startsWith(config.prefix)) return;

            const args = body.slice(config.prefix.length).trim().split(' ');
            const command = args.shift().toLowerCase();
            const textArg = args.join(' ');

            const menuText = `
╔════ 🤖 *${config.botName.toUpperCase()}* ════╗
║ 👋 Hello, *${senderName}*!
║ 👑 Developer: *${config.ownerName}*
╚════════════════════════╝

*🛠️ TOOLS*
▸ *${config.prefix}setname [name]* - Rename bot
▸ *${config.prefix}ping* - Check speed
▸ *${config.prefix}info* - Bot info

*👥 GROUP COMMANDS*
▸ *${config.prefix}hidetag [text]* - Notify all
▸ *${config.prefix}kick @user* - Remove
▸ *${config.prefix}promote @user* - Admin
▸ *${config.prefix}demote @user* - Remove admin
▸ *${config.prefix}groupinfo* - Group details

*🎮 FUN*
▸ *${config.prefix}joke* - Random joke
▸ *${config.prefix}fact* - Random fact
▸ *${config.prefix}flip* - Coin flip
▸ *${config.prefix}roll* - Dice roll
▸ *${config.prefix}rps [rock|paper|scissors]* - Play game
`;

            switch(command){
                case 'menu': await sock.sendMessage(from,{text:menuText}); break;
                case 'ping': await sock.sendMessage(from,{text:'Pong! 🏓'}); break;
                case 'info': await sock.sendMessage(from,{text:`ℹ️ Name: ${config.botName}\nDeveloper: ${config.ownerName}\nStatus: Online 🟢`}); break;
            }
        }catch(err){console.log(`[${userLabel}] Message Error:`,err);}
    });
}

// Example: Start bot for yourself and 2 friends
startBot("Sulieman");      // your account
startBot("Friend1");       // friend 1
startBot("Friend2");       // friend 2
