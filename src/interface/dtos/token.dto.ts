export class TokenDTO {
    refreshToken: string;

    constructor(data: any) {
        this.refreshToken = data.refreshToken;
    }
}
