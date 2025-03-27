import { inject, injectable } from "inversify";
import { Request, Response } from 'express';
import { UserCRUD } from '../../domain/usecases/user.crud';
import { TokenUseCase } from '../../domain/usecases/token.usecase';
import { RegisterDTO } from "../dtos/register.dto";
import { LoginDTO } from "../dtos/login.dto";
import { TokenDTO } from "../dtos/token.dto";
import { PhoneDTO } from "../dtos/phone.dto";
import { ErrorPacketParams } from "mysql2";
import { PhoneNumberCRUD } from "../../domain/usecases/phone.number.crud";

@injectable()
export class AuthController {
    constructor(
        @inject(UserCRUD) private userCRUD: UserCRUD,
        @inject(TokenUseCase) private refreshTkn: TokenUseCase,
        @inject(PhoneNumberCRUD) private phoneFunctions: PhoneNumberCRUD,
    ) { }

    async register(req: Request, res: Response) {
        try {
            const dto = new RegisterDTO(req.body);
            // const user = 
            await this.userCRUD.registerUses(dto);
            res.status(201).json({ isSuccess: true, message: "User registered successfully" });
        } catch (error) {
            let errorMessage = "Failed to register user";
            let statusCode = 400;

            if ((error as ErrorPacketParams).code === "ER_DUP_ENTRY") {
                errorMessage = "This email is already registered. Please use a different one.";
            } else if ((error as ErrorPacketParams).code === "ER_BAD_NULL_ERROR") {
                errorMessage = "Some required fields are missing.";
            } else if (error instanceof Error) {
                errorMessage = error.message;
            }

            res.status(statusCode).json({ isSuccess: false, message: errorMessage });
        }
    };

    async login(req: Request, res: Response) {
        try {
            const dto = new LoginDTO(req.body);
            const { accessToken } = await this.userCRUD.loginUser(dto);
            // const { user, accessToken, refreshToken } 
            res.json({ isSuccess: true, message: 'Login Success!', accessToken });
        } catch (error) {
            let errorMessage = "Failed to login";
            let statusCode = 401;

            if (error instanceof Error) {
                if (error.message.includes("Invalid email or password")) {
                    errorMessage = "Incorrect email or password. Please try again.";
                } else {
                    errorMessage = error.message;
                }
            }
            res.status(statusCode).json({ isSuccess: false, message: errorMessage });
        }
    };

    async getUser(req: Request, res: Response) {
        try {
            const { email } = req.body;
            if (!email) {
                res.status(400).json({ isSuccess: false, message: "Email is required" });
            }

            const user = await this.userCRUD.getUser(email);

            res.json({ isSuccess: true, message: "User Data Retrieve successfully", user });
        } catch (error) {
            res.status(500).json({ isSuccess: false, message: "Server error during retrieving data" });
        }
    };

    async refreshAccessToken(req: Request, res: Response) {
        try {
            const dto = new TokenDTO(req.body);
            const { accessToken } = await this.refreshTkn.getNewAccessToken(dto);
            res.json({ isSuccess: true, message: 'Refresing Token is Success!', accessToken });
        } catch (error) {
            let errorMessage = "Failed to refresh token";
            let statusCode = 403;

            if (error instanceof Error) {
                if (error.message.includes("Invalid refresh token")) {
                    errorMessage = "Your session has expired. Please log in again.";
                    statusCode = 401;
                } else if (error.message.includes("Token expired")) {
                    errorMessage = "Your refresh token has expired. Please sign in again.";
                    statusCode = 401;
                } else if (error.message.includes("blacklisted")) {
                    errorMessage = "Your refresh token has been blacklisted.";
                    statusCode = 401;
                } else {
                    errorMessage = error.message;
                }
            }
            res.status(statusCode).json({ isSuccess: false, message: errorMessage });
        }
    };

    async addPhone(req: Request, res: Response) {
        try {
            const dto = new PhoneDTO(req.body);
            // const user = 
            await this.phoneFunctions.add(dto);
            res.status(201).json({ isSuccess: true, message: "Phone Number Added successfully" });
        } catch (error) {
            let errorMessage = "Failed to Add Phone Number";
            let statusCode = 400;

            if ((error as ErrorPacketParams).code === "ER_DUP_ENTRY") {
                errorMessage = "This Phone Number is already registered. Please use a different one.";
            } else if ((error as ErrorPacketParams).code === "ER_BAD_NULL_ERROR") {
                errorMessage = "Some required fields are missing.";
            } else if (error instanceof Error) {
                errorMessage = error.message;
            }
            res.status(statusCode).json({ isSuccess: false, message: errorMessage });
        }
    };

    async getPhone(req: Request, res: Response) {
        try {
            const { email } = req.body;
            if (!email) {
                res.status(400).json({ isSuccess: false, message: "Email is required" });
            }

            const numbers = await this.phoneFunctions.get(email);

            res.json({ isSuccess: true, message: "Phone Numbers Retrieve successfully", phoneNumbers: numbers });
        } catch (error) {
            res.status(500).json({ isSuccess: false, message: "Server error during retrieving data" });
        }
    };
}

