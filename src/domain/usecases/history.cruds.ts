import { injectable, inject } from "inversify";
import { HistoryRepository } from "../repository/history.repository";
import { TYPES } from "../../core/di/types";

@injectable()
export class HistoryCrud {
    constructor(@inject(TYPES.HistoryRepository) private historyRepository: HistoryRepository) { }

    async insertMessageHistory(messageStack: any[]): Promise<void> {
        return await this.historyRepository.insertMessageHistory(messageStack)
    }
    async getGroupedResultsByMessageID(email: string): Promise<MessageGroupedResult[]> {
        return await this.historyRepository.getGroupedResultsByMessageID(email);
    }
    async getMessageByMessageID(messageID: string): Promise<{ messageId: string, list: Messages[] }> {
        return await this.historyRepository.getMessageByMessageID(messageID)
    }

    async deleteMessageHistory(messageID: string): Promise<void> {
        return await this.historyRepository.deleteMessageHistory(messageID);
    }
}