export interface HistoryRepository {
    insertMessageHistory(messageStack: any[]): Promise<void>;
    getGroupedResultsByMessageID(email: string): Promise<MessageGroupedResult[]>;
    getMessageByMessageID(messageID: string): Promise<{ messageId: string, list: Messages[] }>;
    deleteMessageHistory(messageID: string): Promise<void>;
}