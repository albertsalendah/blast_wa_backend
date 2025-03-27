export class RegisterDTO {
    name: string;
    email: string;
    password: string;
    role?: "user" | "admin"; // Default role is 'user'

    constructor(data: any) {
        this.name = data.name;
        this.email = data.email;
        this.password = data.password;
        this.role = data.role || "user";
    }
}
