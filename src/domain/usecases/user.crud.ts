import { inject, injectable } from "inversify";
import { TYPES } from "../../core/di/types";
import { AuthRepository } from '../repository/auth.repository';
import { comparePasswords } from '../../core/utils/password.utils';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../../core/utils/jwt.utils';
import { LoginDTO } from "../../interface/dtos/login.dto";
import { User } from "../entity/user.entity";
import { RegisterDTO } from "../../interface/dtos/register.dto";
import { hashPassword } from '../../core/utils/password.utils';

@injectable()
export class UserCRUD {
    constructor(@inject(TYPES.AuthRepository) private authRepository: AuthRepository) { }

    async loginUser(loginDto: LoginDTO): Promise<{ accessToken: string; }> {
        const user = await this.authRepository.findUserByEmail(loginDto.email);
        if (!user) throw new Error("Invalid email");

        const isPasswordValid = await comparePasswords(loginDto.password, user.password);
        if (!isPasswordValid) throw new Error("Invalid password");

        const accessToken = generateAccessToken(user);
        let refreshToken = user.refreshToken;
        if (!refreshToken) {
            console.log('Generating new refresh token for user', user.email)
            refreshToken = generateRefreshToken(user);
            await this.authRepository.updateRefreshToken(user.id!, refreshToken);
        } else {
            try {
                console.log('Verivying refresh token for user', user.email)
                verifyRefreshToken(refreshToken);
            } catch (error) {
                console.log('Generating new refresh token for user', user.email, `Couse of Error ${error}`);
                refreshToken = generateRefreshToken(user);
                await this.authRepository.updateRefreshToken(user.id!, refreshToken);
            }
        }
        return { accessToken, };
    }

    async registerUses(registerDto: RegisterDTO): Promise<User> {
        const hashedPassword = await hashPassword(registerDto.password!);
        const user = new User(null, registerDto.name, registerDto.email, hashedPassword, registerDto.role!);
        return await this.authRepository.createUser(user);
    }

    async getUser(email: string): Promise<User | null> {
        const user = await this.authRepository.findUserByEmail(email);
        return user;
    }
}