import { inject, injectable } from "inversify";
import { TYPES } from "../../core/di/types";
import { AuthRepository } from '../repository/auth.repository';
import { UserPhoneNumber } from "../entity/user.phone.entity";
import { PhoneDTO } from "../../interface/dtos/phone.dto";

@injectable()
export class PhoneNumberCRUD {
    constructor(@inject(TYPES.AuthRepository) private authRepository: AuthRepository) { }

    async add(phoneDTO: PhoneDTO): Promise<boolean> {
        return await this.authRepository.addUserPhoneNumbers(new UserPhoneNumber(null, phoneDTO.email, phoneDTO.whatsapp_number))
    }

    async get(email: string): Promise<UserPhoneNumber[]> {
        return await this.authRepository.getUserPhoneNumber(email);
    }
}