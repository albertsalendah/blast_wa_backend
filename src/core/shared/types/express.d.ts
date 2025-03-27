import { Request } from "express";
import { User } from "../../../features/auth/domain/entities/user";

declare module "express" {
    interface Request {
        user?: User;
    }
}
