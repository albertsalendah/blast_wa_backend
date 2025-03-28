import { injectable } from "inversify";
import { db } from "../../../core/utils/database";
import { FileService } from "../../../core/services/file.service";


@injectable()
export class HistoryMysqlDataSource {
    private fileService: FileService;
    constructor() {
        this.fileService = new FileService();
    }

    async insertMessageHistory(messageStack: any[]): Promise<void> {
        let connection = await db.getConnection();
        try {
            await connection.beginTransaction();
            if (messageStack.length > 0) {
                const values = messageStack.map(
                    (item) => [
                        item.id,
                        item.email,
                        item.sender,
                        item.totalData,
                        item.targetName,
                        item.targetNumber,
                        item.onWA,
                        item.message,
                        item.messageStatus,
                        JSON.stringify(item.imageUrl),
                        JSON.stringify(item.pathExcel),
                        item.createAt,
                    ]
                );
                const query = `INSERT INTO history (messageID, email, sender, totalData, targetName, targetNumber, onWA, message, messageStatus, imageUrl, pathExcel, createAt) VALUES ? `;
                await connection.query(query, [values]);
            }
            await connection.commit();
            console.log('✅ Message History inserted successfully (bulk insert).');
        } catch (error) {
            if (connection) {
                await connection.rollback();
            }
            console.error('❌ Error inserting message history:', error);
            throw error;
        } finally {
            if (connection) {
                connection.release();
            }
        }
    }

    async getGroupedResultsByMessageID(email: string): Promise<MessageGroupedResult[]> {
        try {
            const query = `
            SELECT 
              messageID,
              sender,
              message,
              imageUrl,
              createAt,
              SUM(CASE WHEN messageStatus = true THEN 1 ELSE 0 END) AS successCount,
              SUM(CASE WHEN messageStatus = false THEN 1 ELSE 0 END) AS failedCount
            FROM history
            WHERE email = ?
            GROUP BY messageID;
          `;

            const [rows] = await db.execute(query, [email]);

            const parsedRows = (rows as any[]).map((row) => {
                return { ...row, imageUrl: JSON.parse(row.imageUrl) };
            });

            return parsedRows as MessageGroupedResult[];
        } catch (error) {
            console.error('Error fetching grouped results by messageID:', error);
            throw error;
        }
    }

    async getMessageByMessageID(messageID: string): Promise<{ messageId: string, list: Messages[] }> {
        try {
            const query = `SELECT * FROM history WHERE messageID = ?`;
            const [rows] = await db.execute(query, [messageID]);

            const parsedRows = (rows as any[]).map((row) => {
                return { ...row, imageUrl: JSON.parse(row.imageUrl) };
            });
            return { messageId: parsedRows[0].messageID as string, list: parsedRows as Messages[] };
        } catch (error) {
            console.error('Error fetching grouped results by messageID:', error);
            throw error;
        }
    }

    async deleteMessageHistory(messageID: string): Promise<void> {
        let connection = await db.getConnection();
        try {
            const [rows]: any[] = await db.execute('SELECT imageUrl,pathExcel FROM history WHERE messageID = ?', [messageID]);
            const parsedImageUrls = JSON.parse(rows[0].imageUrl) as string[];
            const parsedPathExcel = JSON.parse(rows[0].pathExcel) as string;
            await this.fileService.deleteExistingFile(parsedImageUrls, parsedPathExcel);
            await connection.beginTransaction();
            const query = `DELETE FROM history WHERE messageID = ?`;
            await connection.query(query, [messageID]);
            await connection.commit();
            console.log('✅ Message History deleted successfully.');
        } catch (error) {
            if (connection) {
                await connection.rollback();
            }
            console.error('❌ Error deleting message history:', error);
            throw error;
        } finally {
            if (connection) {
                connection.release();
            }
        }
    }

}