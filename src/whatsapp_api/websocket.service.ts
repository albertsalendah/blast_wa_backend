import { injectable } from 'inversify';
import WebSocket from 'ws';
import http from 'http';
import { BaileysService } from './baileys.service';
import { container } from '../core/di/di.container';
import { MessageService } from './message.service';

@injectable()
export class WebSocketService {
    private baileysService: BaileysService;
    private ws: WebSocket.Server;
    clients: Map<string, WebSocket>;

    constructor() {
        this.ws = new WebSocket.Server({ noServer: true });
        this.clients = new Map();
        this.baileysService = container.get(BaileysService);
    }
    /**
     * Initializes the WebSocket server
     */
    initialize(server: http.Server): void {
        this.ws = new WebSocket.Server({ noServer: true });
        this.attachToServer(server);

        // Keep connections alive
        setInterval(() => {
            this.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.ping();
                }
            });
        }, 30000); // Ping every 30 seconds
    }

    async sendToClient(userId: string, message: any): Promise<void> {
        const client = this.clients.get(userId);
        if (client && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    }
    /**
     * Attaches WebSocket to HTTP server upgrade event
     */
    attachToServer(server: http.Server): void {
        server.on('upgrade', (request, socket, head) => {
            this.ws.handleUpgrade(request, socket, head, (ws) => {
                this.ws.emit('connection', ws, request);
            });
        });
        const messageService = container.get(MessageService);

        this.ws.on('connection', (ws: WebSocket, request: http.IncomingMessage) => {
            let clientId: string | null = null;

            ws.on('message', async (message: string) => {
                try {
                    const parsedMessage = JSON.parse(message.toString());

                    if (parsedMessage.type === 'setId' && !clientId) {
                        const providedId = parsedMessage.id;

                        if (this.clients.has(providedId)) {
                            ws.send(JSON.stringify({ type: 'error', message: 'ID already in use' }));
                            ws.close();
                            return;
                        }

                        if (typeof providedId !== 'string' || providedId.length === 0) {
                            ws.send(JSON.stringify({ type: 'error', message: 'Invalid ID' }));
                            ws.close();
                            return;
                        }

                        clientId = providedId;
                        this.clients.set(clientId, ws);
                        console.log(`[WebSocket] Client connected with ID: ${parsedMessage.email}, Total clients: ${this.clients.size}`);


                        // Restore paused messages if any
                        messageService.restorePausedMessages(clientId)

                        ws.send(JSON.stringify({ type: 'idSet', id: clientId }));
                        return;
                    }

                    if (!clientId) {
                        ws.send(JSON.stringify({ type: 'error', message: 'Set ID first' }));
                        ws.close();
                        return;
                    }

                    if (parsedMessage.type === 'connectWhatsApp') {
                        await this.baileysService.connectWhatsApp(parsedMessage.email, parsedMessage.clientId, this.sendToClient.bind(this));
                    }

                    if (parsedMessage.type === 'resumeMessage') {
                        const messageID = parsedMessage.messageID
                        messageService.removePausedMessage(clientId, messageID);
                        messageService.resumeMessage(messageID);
                    }

                    if (parsedMessage.type === 'pauseMessage') {
                        console.log(`[WebSocket] PAUSED FROM WEBSOCKET`)
                        const messageID = parsedMessage.messageID
                        messageService.trackPausedMessage(clientId, messageID);
                        messageService.pauseMessage(messageID);
                    }

                    if (parsedMessage.type === 'cancelMessage') {
                        const messageID = parsedMessage.messageID
                        messageService.cancelMessage(messageID);
                        messageService.removePausedMessage(clientId, messageID);
                    }

                    if (parsedMessage.type === 'disconnect') {
                        const disconnectClientId = parsedMessage.clientId;
                        const disconnectClient = this.clients.get(disconnectClientId);

                        if (disconnectClient) {
                            console.log(`[WebSocket] Disconnect request from client ${disconnectClientId}`);
                            disconnectClient.send(JSON.stringify({
                                type: 'connectionStatus',
                                status: 'close',
                                accountId: disconnectClientId
                            }));
                            await this.baileysService.disconnectWhatsApp(disconnectClientId);
                            disconnectClient.close(1000, 'Server requested disconnect');
                            this.clients.delete(disconnectClientId);
                            console.log(`[WebSocket] Client ${disconnectClientId} disconnected. Total clients: ${this.clients.size}`);
                        } else {
                            ws.send(JSON.stringify({ type: 'error', message: `Client ${disconnectClientId} not found` }));
                        }
                    }
                } catch (error) {
                    console.error('[WebSocket] Error parsing message:', error);
                    ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
                }
            });

            ws.on('close', async (code: number, reason: string) => {
                if (clientId) {
                    console.log(`[WebSocket] Client disconnected. ID: ${clientId}, Code: ${code}, Reason: ${reason}`);
                    const disconnectClient = this.clients.get(clientId);
                    if (disconnectClient) {
                        disconnectClient.send(JSON.stringify({
                            type: 'connectionStatus',
                            status: 'close',
                            accountId: clientId
                        }));
                    }
                    // await this.baileysService.disconnectWhatsApp(clientId);
                    this.clients.delete(clientId);
                    console.log(`[WebSocket] Total remaining clients: ${this.clients.size}`);
                }
            });

            ws.on('error', async (error: Error) => {
                console.error(`[WebSocket] Error with client ${clientId}:`, error);
                if (clientId) {
                    const disconnectClient = this.clients.get(clientId);
                    if (disconnectClient) {
                        disconnectClient.send(JSON.stringify({
                            type: 'connectionStatus',
                            status: 'close',
                            accountId: clientId
                        }));
                    }
                    await this.baileysService.disconnectWhatsApp(clientId);
                    this.clients.delete(clientId);

                }
                ws.terminate();
            });
        });
    }
    /**
     * Gracefully shuts down the WebSocket server
     */
    shutdown(): void {
        this.ws.close(() => {
            console.log('[WebSocket] Server shut down.');
        });

        this.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.close();
            }
        });

        this.clients.clear();
    }
}
