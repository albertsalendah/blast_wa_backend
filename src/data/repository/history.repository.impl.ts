import { injectable, inject } from "inversify";
import { HistoryRepository } from "../../domain/repository/history.repository";
import { HistoryMysqlDataSource } from "../data_source/mysql/history.mysql.data-source";
import { TYPES } from "../../core/di/types";

@injectable()
export class HistoryRepositoryImpl implements HistoryRepository {
    constructor(@inject(TYPES.HistoryMysqlDataSource) private dataSource: HistoryMysqlDataSource) { }
    async deleteMessageHistory(messageID: string): Promise<void> {
        return await this.dataSource.deleteMessageHistory(messageID);
    }
    async insertMessageHistory(messageStack: any[]): Promise<void> {
        return await this.dataSource.insertMessageHistory(messageStack);
    }
    async getGroupedResultsByMessageID(email: string): Promise<MessageGroupedResult[]> {
        return await this.dataSource.getGroupedResultsByMessageID(email);
    }
    async getMessageByMessageID(messageID: string): Promise<{ messageId: string, list: Messages[] }> {
        return await this.dataSource.getMessageByMessageID(messageID);
    }
}