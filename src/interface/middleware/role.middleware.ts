import { Request, Response, NextFunction } from 'express';

export const authorize = (roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (req.user && roles.includes(req.user.role)) {
            next();
        } else {
            res.status(403).json({ error: "Forbidden: Insufficient permissions" });
        }
    };
};