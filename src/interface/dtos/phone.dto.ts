export class PhoneDTO {
    email: string;
    whatsapp_number: string;

    constructor(data: any) {
        this.email = data.email;
        this.whatsapp_number = data.whatsapp_number;
    }
}
