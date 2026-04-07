import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { XmppManager } from './xmpp/manager.js';
import type { ClientMessage, RelayMessage } from '../../shared/src/messages.js';

// Allow self-signed certs for XMPP servers
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const PORT = Number(process.env.RELAY_PORT) || 3001;

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const xmppManager = new XmppManager();

wss.on('connection', (ws: WebSocket) => {
  console.log('[relay] Client connected');

  const send = (msg: RelayMessage) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  };

  const unsubscribe = xmppManager.onEvent(send);

  ws.on('message', async (raw) => {
    try {
      const msg: ClientMessage = JSON.parse(raw.toString());
      console.log(`[relay] ← ${msg.type}`);

      switch (msg.type) {
        case 'connect':
          await xmppManager.connect(msg.accountId, msg.password);
          break;
        case 'disconnect':
          await xmppManager.disconnect(msg.accountId);
          break;
        case 'account:sync':
          xmppManager.syncAccounts(msg.accounts);
          break;
        case 'roster:get':
          await xmppManager.getRoster();
          break;
        case 'presence:set':
          await xmppManager.setPresence(msg.show, msg.status);
          break;
        case 'message:send':
          await xmppManager.sendMessage(msg.to, msg.body);
          break;
        case 'muc:list':
          await xmppManager.listRooms(msg.server);
          break;
        case 'muc:join':
          await xmppManager.joinRoom(msg.room, msg.nick);
          break;
        case 'muc:leave':
          await xmppManager.leaveRoom(msg.room);
          break;
        case 'muc:send':
          await xmppManager.sendMucMessage(msg.room, msg.body);
          break;
        case 'history:fetch':
          if (msg.isRoom) {
            await xmppManager.fetchMucHistory(msg.jid, msg.limit);
          } else {
            await xmppManager.fetchHistory(msg.jid, msg.limit);
          }
          break;
        default:
          send({ type: 'error', code: 'UNKNOWN_MESSAGE', message: `Unknown message type` });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      send({ type: 'error', code: 'PARSE_ERROR', message });
    }
  });

  ws.on('close', () => {
    console.log('[relay] Client disconnected');
    unsubscribe();
  });
});

server.listen(PORT, () => {
  console.log(`[relay] Squawk relay running on http://localhost:${PORT}`);
  console.log(`[relay] WebSocket at ws://localhost:${PORT}/ws`);
});
