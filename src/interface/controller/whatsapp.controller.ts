import { injectable, inject } from "inversify";
import { Request, Response } from 'express';
import { container } from "../../core/di/di.container";
import { FileService } from "../../core/services/file.service";
import { MessageService } from "../../whatsapp_api/message.service";
import { HistoryCrud } from "../../domain/usecases/history.cruds";


@injectable()
export class WhatsAppController {
    private fileService: FileService;
    private messageService: MessageService;

    constructor(@inject(HistoryCrud) private history: HistoryCrud,) {
        this.messageService = container.get(MessageService);
        this.fileService = new FileService();
    }

    async sendMessage(req: Request, res: Response) {
        try {

            const { countryCode, email, noWA, message } = req.body;

            if (email && noWA) {
                const messageID = this.messageService.generateMessageId();
                const { excelFileName, imageNames } = await this.fileService.handleUploadedFiles(messageID, req, email, noWA);

                res.json({ isSuccess: true, message: "Send Message successfully" });
                const messageRequests = [];
                messageRequests.push({
                    id: messageID,
                    countryCode: countryCode,
                    email: email,
                    noWA: noWA,
                    message: message,
                    excelFileName: excelFileName,
                    imageNames: imageNames
                });
                await this.messageService.sendProgressUpdates(messageRequests);
            } else {
                console.log('❌ Failed sending message:', email, 'No WA:', noWA, 'Message:', message);
                res.status(400).json({ isSuccess: false, message: "Email and WhatsApp number are required" });
            }
        } catch (error) {
            console.error("❌ Upload Error:", error);
            res.status(500).json({ isSuccess: false, message: "Send Message failed" });
        }
    }

    async getMessageHistoryGroup(req: Request, res: Response) {
        try {
            const { email } = req.body;
            if (!email) {
                res.status(400).json({ isSuccess: false, message: "Email is required" });
            }

            const messageGroup = await this.history.getGroupedResultsByMessageID(email);

            res.json({ isSuccess: true, message: "Message Group Retrieve successfully", messageGroup });
        } catch (error) {
            res.status(500).json({ isSuccess: false, message: "Server error during retrieving data" });
        }
    };

    async getMessageHistory(req: Request, res: Response) {
        try {
            const { messageID } = req.body;
            if (!messageID) {
                res.status(400).json({ isSuccess: false, message: "messageID is required" });
            }

            const { messageId, list } = await this.history.getMessageByMessageID(messageID);

            res.json({ isSuccess: true, message: "Message History Retrieve successfully", messageId, list });
        } catch (error) {
            res.status(500).json({ isSuccess: false, message: "Server error during retrieving data" });
        }
    };

    async deleteMessageHistory(req: Request, res: Response) {
        try {
            const { messageID } = req.body;
            if (!messageID) {
                res.status(400).json({ isSuccess: false, message: "messageID is required" });
            }

            await this.history.deleteMessageHistory(messageID);

            res.json({ isSuccess: true, message: "Message History deleted successfully" });
        } catch (error) {
            res.status(500).json({ isSuccess: false, message: "Server error during deleting data" });
        }
    };
}