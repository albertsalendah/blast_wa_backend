import { inject, injectable } from "inversify";
import { TYPES } from "../../core/di/types";
import { AuthRepository } from '../repository/auth.repository';
import { generateAccessToken, verifyRefreshToken } from '../../core/utils/jwt.utils';
import { TokenDTO } from "../../interface/dtos/token.dto";

@injectable()
export class TokenUseCase {
    constructor(@inject(TYPES.AuthRepository) private authRepository: AuthRepository) { }

    async getNewAccessToken(refreshTokenDto: TokenDTO): Promise<{ accessToken: string }> {
        const user = await this.authRepository.findByRefreshToken(refreshTokenDto.refreshToken);
        console.log('User ', user?.email, ' Requesting new access token.',)
        if (!user) throw new Error("Invalid refresh token");

        try {
            verifyRefreshToken(refreshTokenDto.refreshToken);
        } catch (error) {
            throw new Error(`Invalid or expired refresh token ${error}`);
        }

        const accessToken = generateAccessToken(user!);
        return { accessToken };
    }
}