import { injectable, inject } from "inversify";
import { AuthRepository } from '../../domain/repository/auth.repository';
import { User } from '../../domain/entity/user.entity';
import { AuthMySQLDataSource } from "../data_source/mysql/auth.mysql.data-source";
import { TYPES } from "../../core/di/types";
import { UserPhoneNumber } from "../../domain/entity/user.phone.entity";

@injectable()
export class AuthRepositoryImpl implements AuthRepository {
    constructor(@inject(TYPES.AuthMySQLDataSource) private dataSource: AuthMySQLDataSource) { }
    async addUserPhoneNumbers(phone: UserPhoneNumber): Promise<boolean> {
        return await this.dataSource.addUserPhoneNumbers(phone);
    }
    async getUserPhoneNumber(email: string): Promise<UserPhoneNumber[]> {
        return await this.dataSource.getUserPhoneNumber(email);
    }
    async createUser(user: User): Promise<User> {
        return await this.dataSource.createUser(user);
    }

    async findUserByEmail(email: string): Promise<User | null> {
        return await this.dataSource.findUserByEmail(email);
    }

    async findByRefreshToken(token: string): Promise<User | null> {
        return await this.dataSource.findByRefreshToken(token);
    }

    async updateRefreshToken(userId: number, refreshToken: string): Promise<void> {
        return await this.dataSource.updateRefreshToken(userId, refreshToken);
    }

    async updateUser(user: User): Promise<void> {
        return await this.dataSource.updateUser(user);
    }
}