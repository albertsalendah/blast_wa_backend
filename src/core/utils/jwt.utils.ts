import { config } from '../config/config';
import { User } from '../../domain/entity/user.entity';
import jwt from 'jsonwebtoken';

export const generateAccessToken = (user: User): string => {
    return jwt.sign({ id: user.id, email: user.email, role: user.role }, config.jwtSecret, {
        expiresIn: '15m',
    });
};

export const generateRefreshToken = (user: User): string => {
    return jwt.sign({ id: user.id, email: user.email }, config.jwtRefreshSecret, {
        expiresIn: '7d',
    });
};

export const verifyAccessToken = (token: string): any => {
    return jwt.verify(token, config.jwtSecret);
};

export const verifyRefreshToken = (token: string): any => {
    return jwt.verify(token, config.jwtRefreshSecret,);
};