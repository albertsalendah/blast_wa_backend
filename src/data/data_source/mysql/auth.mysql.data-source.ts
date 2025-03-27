import { injectable } from 'inversify';
import { User } from '../../../domain/entity/user.entity';
import { db } from '../../../core/utils/database';
import { UserPhoneNumber } from '../../../domain/entity/user.phone.entity';
import { verifyRefreshToken } from '../../../core/utils/jwt.utils';

@injectable()
export class AuthMySQLDataSource {
    async createUser(user: User): Promise<User> {
        const [result]: any = await db.query('INSERT INTO users (name, password, email, role) VALUES (?, ?, ?, ?)', [
            user.name,
            user.password,
            user.email,
            user.role,
        ]);
        return { ...user, id: result.insertId };
    }

    async updateUser(user: User): Promise<void> {
        await db.query('UPDATE users SET name = ?, password = ?, email = ?, role = ? WHERE id = ?', [user.name, user.password, user.email, user.role, user.id]);
    }

    async findUserByEmail(email: string): Promise<User | null> {
        const [rows]: any = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (rows.length === 0) return null;
        const [tokens]: any = await db.query("SELECT * FROM blacklisted_tokens WHERE token = ?", [rows[0].refresh_token]);
        if (tokens.length > 0) {
            rows[0].refresh_token = '';
        }
        const row = rows[0];
        return new User(row.id, row.name, row.email, row.password, row.role, row.refresh_token);
    }

    async addUserPhoneNumbers(phone: UserPhoneNumber): Promise<void> {
        const [rows]: any = await db.query('SELECT * FROM whatsapp_accounts WHERE whatsapp_number = ?', [phone.whatsapp_number]);
        if (rows.length > 0) {
            return;
        }
        await db.query("INSERT INTO whatsapp_accounts (email, whatsapp_number) VALUES (?,?)", [phone.email, phone.whatsapp_number]);
    }

    async getUserPhoneNumber(email: string): Promise<UserPhoneNumber[]> {
        const [rows]: any = await db.query('SELECT * FROM whatsapp_accounts WHERE email = ?', [email]);
        if (rows.length === 0) return [];
        return rows.map((row: any) => new UserPhoneNumber(row.id, row.email, row.whatsapp_number));
    }

    async findByRefreshToken(token: string): Promise<User | null> {
        const [tokens]: any = await db.query("SELECT * FROM blacklisted_tokens WHERE token = ?", [token]);
        if (tokens.length > 0) {
            throw new Error("Refresh token has been blacklisted.");
        }
        const [rows]: any = await db.query('SELECT * FROM users WHERE refresh_token = ?', [token]);
        if (rows.length === 0) return null;
        const row = rows[0];
        return new User(row.id, row.name, row.email, row.password, row.role, row.refresh_token);
    }

    async updateRefreshToken(userId: number, refreshToken: string): Promise<void> {
        await db.query('UPDATE users SET refresh_token = ? WHERE id = ?', [refreshToken, userId]);
    }

    async checkRefreshTokens() {
        try {
            const [users]: any = await db.query("SELECT id, email, refresh_token FROM users WHERE refresh_token IS NOT NULL");
            // const userList = users.map((item: any) => new User(item.id,item.name,item.email,item.password,item.role,item.refresh_token));
            for (const user of users as any[]) {
                const { id, email, refresh_token } = user;
                try {
                    verifyRefreshToken(refresh_token)
                } catch (error) {
                    await this.addBlacklistToken(refresh_token, email);
                }
            }
        } catch (error) {
            console.error("Error checking refresh tokens:", error);
        }
    }

    async addBlacklistToken(refreshToken: string, email: string | null): Promise<void> {
        const [tokens]: any = await db.query("SELECT * FROM blacklisted_tokens WHERE token = ?", [refreshToken]);
        if (tokens.length > 0) {
            // console.log(`Refresh token has been blacklisted.`);
            return;
        }
        await db.query("INSERT INTO blacklisted_tokens (token) VALUES (?)", [refreshToken]);
        console.log(`Refresh token expired for user ID: ${email}, token blacklisted.`);
    }
}
