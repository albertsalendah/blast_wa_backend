import { User } from "../entity/user.entity";
import { UserPhoneNumber } from "../entity/user.phone.entity";

export interface AuthRepository {
    createUser(user: User): Promise<User>;
    findUserByEmail(email: string): Promise<User | null>;
    findByRefreshToken(token: string): Promise<User | null>;
    updateRefreshToken(userId: number, refreshToken: string): Promise<void>;
    updateUser(user: User): Promise<void>;
    addUserPhoneNumbers(phone: UserPhoneNumber): Promise<boolean>
    getUserPhoneNumber(email: string): Promise<UserPhoneNumber[]>
}