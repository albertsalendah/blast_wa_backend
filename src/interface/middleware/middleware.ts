import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../../core/utils/jwt.utils';

export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
    const header = req.headers.authorization;

    if (header) {
        const token = header.split(' ')[1];

        try {
            const decoded = verifyAccessToken(token);
            req.user = decoded;
            next();
        } catch (error) {
            res.status(403).json({ error: "Forbidden: Insufficient permissions" });
        }
    } else {
        res.status(401).json({ error: "Access denied" });
    }
};