import { WebSocketService } from "./websocket.service";
import { BaileysService } from "./baileys.service";
import { v6 as uuidv6 } from "uuid";
import { container } from "../core/di/di.container";
import { FileService } from "../core/services/file.service";
import { injectable, inject } from "inversify";
import { formatPhoneNumber } from "../core/utils/formatPhoneNumber";
import { HistoryCrud } from "../domain/usecases/history.cruds";
import { pauseMessage, resumeMessage, cancelMessage, trackPausedMessage, removePausedMessage, restorePausedMessages, cleanupExpiredMessages } from "../core/services/pause.resume.cancel.message";

export type MessageStatus = 'active' | 'paused' | 'canceled';

@injectable()
export class MessageService {
    private baileysService: BaileysService;
    private webSocketService: WebSocketService;
    private fileService: FileService;

    private messageQueues: Map<string, any[]> = new Map();
    private processingStatus: Map<string, boolean> = new Map();
    private messageStatus: Map<string, MessageStatus> = new Map();
    private messageStack: any[] = [];
    private messagesProgress: Map<string, MessageProgress> = new Map();

    private pausedMessages: Map<string, { messageID: string; timestamp: number }[]> = new Map();
    private reconnectTimeout = 60 * 60 * 1000; // 60 minutes timeout

    constructor(@inject(HistoryCrud) private history: HistoryCrud) {
        this.baileysService = container.get(BaileysService);
        this.webSocketService = container.get(WebSocketService);
        this.fileService = new FileService();

        // Periodic check to remove expired paused messages
        setInterval(() => this.cleanupExpiredMessages(), 60000); // Runs every minute
    }

    generateMessageId(): string {
        return uuidv6();
    }

    async sendProgressUpdates(requests: { id: string; countryCode: string; email: string; noWA: string; message: string; excelFileName: string; imageNames: string[] }[]) {
        for (const req of requests) {
            const queue = this.messageQueues.get(req.noWA) || [];
            queue.push(req);
            this.messageQueues.set(req.noWA, queue);

            const socketClient = this.webSocketService.clients.get(req.noWA);
            if (socketClient && socketClient?.readyState === WebSocket.OPEN) {
                this.webSocketService.sendToClient(req.noWA, {
                    type: "queue_status",
                    id: req.id,
                    sender: req.noWA,
                    status: "queued",
                    message: "Your message is in queue.",
                    queueLength: queue.length,
                });
            }

            if (!this.processingStatus.get(req.noWA)) {
                this.processingStatus.set(req.noWA, true);
                this.processNextInQueue(req.noWA);
            }
        }
    }

    private async processNextInQueue(noWA: string) {
        const queue = this.messageQueues.get(noWA);
        if (!queue || queue.length === 0) {
            this.processingStatus.delete(noWA);
            this.messagesProgress.clear();
            console.log(`✅ Proses selesai : `, Array.from(this.messagesProgress.keys()), ' Message Stack length : ', this.messageStack.length)
            await this.history.insertMessageHistory(this.messageStack)
            this.messageStack = [];
            console.log('Current messages being tracked:', Array.from(this.messageStatus.keys()),);
            return;
        }
        var date_time = new Date();
        const request = queue.shift();
        this.messageQueues.set(noWA, queue);
        if (!request) return;

        console.log(`🚀 Processing messages for ${noWA}`);

        const socketClient = this.webSocketService.clients.get(noWA);
        const baileysInstance = this.baileysService.baileysInstances.get(noWA)

        this.webSocketService.sendToClient(noWA, {
            type: "queue_status",
            id: request.id,
            sender: noWA,
            status: "processing",
            message: "Your message is now being processed.",
            queueLength: queue.length,
        });

        this.messageStatus.set(request.id, "active");

        // Pause Process when user suddenly disconnected
        // if (socketClient) {
        //     socketClient.on('close', async (code: number, reason: string) => {
        //         this.trackPausedMessage(noWA, request.id)
        //         this.pauseMessage(request.id);
        //     })
        //     socketClient.on('error', async (error: Error) => {
        //         this.trackPausedMessage(noWA, request.id)
        //         this.pauseMessage(request.id);
        //     })
        // }

        if (baileysInstance) {
            if (baileysInstance.sock.ws.isClosed) {
                this.trackPausedMessage(noWA, request.id)
                this.pauseMessage(request.id);
            }
        } else {
            this.trackPausedMessage(noWA, request.id)
            this.pauseMessage(request.id);
        }

        console.log(`🚀 Processing message ID: ${request.id}`);
        const { excelData, pathExcel } = await this.fileService.readExcelFile(request.email, request.noWA, request.excelFileName);
        const images = this.fileService.getImages(request.email, request.noWA, request.imageNames);
        let progressCount = 0
        for (let i = 0; i < excelData.length; i++) {
            const row = excelData[i];
            let targetName = row[0];
            let targetNumber = formatPhoneNumber(request.countryCode, `${row[1]}`);

            this.messagesProgress.set(request.id, {
                type: 'message_progress',
                id: request.id,
                email: request.email,
                sender: noWA,
                totalData: excelData.length,
                targetName: targetName,
                onWA: true,
                targetNumber: `${row[1]}`,
                message: request.message,
                messageStatus: false,
                status: 'sending',
                progressCount: 0,
                isPause: false,
                isCancel: false,
                imageUrl: images,
                pathExcel: pathExcel,
                createAt: '',
            })

            // Check if the message is paused
            while (this.messageStatus.get(request.id) === 'paused') {
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait before checking again
                if (this.messageStatus.get(request.id) !== 'paused') break;
            }

            // Check if the message is canceled
            if (this.messageStatus.get(request.id) === 'canceled') {
                console.log(`🛑 Message ${request.id} is canceled.`);
                this.messageStatus.delete(request.id); // Remove status tracking
                const message = this.messagesProgress.get(request.id);
                if (message) {
                    message.isCancel = true;
                }
                await this.webSocketService.sendToClient(noWA, message);
                this.messagesProgress.delete(request.id);
                this.processNextInQueue(noWA); // Process next request if available
                console.log(`✅ A message is canceled, Current messages : `, Array.from(this.messagesProgress.keys()))
                return;
            }

            if (baileysInstance &&
                this.messageStatus.get(request.id) === 'active') {
                const messageProress = this.messagesProgress.get(request.id);
                const numCheck = await this.baileysService.isPhoneNumberOnWhatsApp(noWA, targetNumber);
                if (messageProress) {
                    progressCount++;
                    if (numCheck == true) {
                        // console.log('Sending Message to phone number ', targetNumber)
                        const isMessageSend = await this.baileysService.sendWhatsAppMessage(noWA, targetNumber, request.message, images);
                        messageProress.onWA = true;
                        if (isMessageSend) {
                            messageProress.messageStatus = true;
                        } else {
                            console.log('❌ Failed to send message to ', targetNumber);
                            messageProress.messageStatus = false;
                        }
                    } else if (numCheck == false) {
                        console.error(`❌ Number ${targetNumber} is not on Whatsapp`);
                        messageProress.messageStatus = false;
                        messageProress.onWA = false;
                    } else {
                        this.trackPausedMessage(noWA, request.id)
                        this.pauseMessage(request.id);
                    }
                    messageProress.progressCount = progressCount;
                    messageProress.isPause = this.messageStatus.get(request.id) === 'paused' ? true : false;
                    messageProress.createAt = `${date_time.toISOString().slice(0, 19).replace('T', ' ')}`;
                    //FOR TEST ONLY
                    // const testValue = this.getRandomBoolean();
                    // messageProress.messageStatus = testValue
                    // messageProress.onWA = testValue;
                }

                this.messageStack.push(messageProress)

                if (socketClient) {
                    await this.webSocketService.sendToClient(noWA, messageProress);
                }
            } else {
                console.error(`❌ WebSocket client disconnected for ${noWA} `);
                return;
            }
            // await new Promise(resolve => setTimeout(resolve, 1000));
        }

        console.log(`✅ Finished sending messages for ${noWA} -> ${request.id}`);
        this.messagesProgress.delete(request.id);
        this.messageStatus.delete(request.id);

        // Notify client if another message in queue is now processing
        if (queue.length > 0) {
            this.webSocketService.sendToClient(noWA, {
                type: 'queue_status',
                id: request.id,
                sender: noWA,
                status: 'processing',
                message: `Your queued message is now being processed.`,
                queueLength: queue.length,
            });
        }

        this.processNextInQueue(noWA);
    }

    getRandomBoolean(): boolean {
        return Math.random() < 0.5; // Math.random() generates a number between 0 and 1
    }

    public pauseMessage(id: string) {
        pauseMessage(id, this.messageStatus);
    }

    public resumeMessage(id: string) {
        resumeMessage(id, this.messageStatus, this.messageQueues, this.processNextInQueue)
    }

    public cancelMessage(id: string) {
        cancelMessage(id, this.messageStatus)
    }

    public trackPausedMessage(clientId: string, messageID: string) {
        trackPausedMessage(clientId, messageID, this.pausedMessages)
    }

    public removePausedMessage(clientId: string, messageID: string) {
        removePausedMessage(clientId, messageID, this.pausedMessages)
    }

    public restorePausedMessages(clientId: string) {
        restorePausedMessages(clientId, this.pausedMessages, this.messagesProgress, this.messageQueues, this.webSocketService)
    }

    private cleanupExpiredMessages() {
        cleanupExpiredMessages(this.pausedMessages, this.reconnectTimeout, this.messagesProgress)
    }
}
