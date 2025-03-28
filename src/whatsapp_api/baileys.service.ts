import { inject, injectable } from 'inversify';
import {
    default as makeWASocket,
    DisconnectReason,
    useMultiFileAuthState,
    AuthenticationState,
} from '@whiskeysockets/baileys';
import { Boom } from "@hapi/boom";
import P from 'pino'
import fs from 'fs';
import { PhoneNumberCRUD } from '../domain/usecases/phone.number.crud';
import { PhoneDTO } from '../interface/dtos/phone.dto';

const logger = P({ timestamp: () => `,"time":"${new Date().toJSON()}"` }, P.destination('./wa-logs.txt'))
logger.level = 'trace'

interface BaileysInstance {
    sock: ReturnType<typeof makeWASocket>;
    state: AuthenticationState;
}

@injectable()
export class BaileysService {
    constructor(
        @inject(PhoneNumberCRUD) private addPhoneNumber: PhoneNumberCRUD) { }
    baileysInstances: Map<string, BaileysInstance> = new Map();

    // Removed WebSocketService dependency from constructor

    async connectWhatsApp(email: string, accountId: string, sendToClient: (userId: string, message: any) => void,): Promise<void> {
        const checkInstance = this.baileysInstances.get(accountId);

        if (checkInstance) {
            console.log(`[WhatsApp] ✅ Instance for account: ${accountId} found.`);
            if (checkInstance.sock.ws.isOpen) {
                console.log(`[WhatsApp] ✅ Instance for account: ${accountId} still running 🏃‍♂️‍➡️`);
                sendToClient(accountId, { type: 'connectionStatus', status: 'open', accountId: accountId });
                return;
            } else {
                console.log(`[WhatsApp] 🔄 Instance for account: ${accountId} is closed. Recreating...`);
                this.baileysInstances.delete(accountId); // Remove the old instance
            }
        }
        const { state, saveCreds } = await useMultiFileAuthState(`baileys_auth_info/${email}/auth_info_${accountId}`);

        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: logger,
        });

        const instance = { sock, state };
        this.baileysInstances.set(accountId, instance);

        console.log(`[WhatsApp] ✅ connection opened for ID : ${accountId}, Total WhatsApp instance : ${this.baileysInstances.size}`);

        sock.ev.on('connection.update', async (update) => {
            const { qr, connection, lastDisconnect, isNewLogin, legacy, isOnline, receivedPendingNotifications } = update;
            if (connection === 'connecting') {
                console.log(`[WhatsApp] ⌚ Connecting... account:: ${accountId} to WhatsApp`);
                sendToClient(accountId, { type: 'connectionStatus', status: 'connecting', accountId: accountId });
            }
            if (qr) {
                console.log(`[WhatsApp] 📩 Sending QR to account: ${accountId}`);
                sendToClient(accountId, { type: 'qrCode', accountId: accountId, qr: qr });
            }

            if (connection === 'open') {
                const phoneNumber = sock.authState.creds.me?.id;

                if (phoneNumber) {
                    const newId = phoneNumber.split(':')[0];
                    const dto = new PhoneDTO({ email: email, whatsapp_number: newId });
                    await this.addPhoneNumber.add(dto);
                    console.log(`[WhatsApp] ✅ connection opened for phone number : ${accountId}`);
                    sendToClient(accountId, { type: 'connectionStatus', status: 'open', accountId: accountId });
                }
            }
            if (connection === 'close') {
                const errStatusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
                const shouldReconnect = (errStatusCode !== DisconnectReason.loggedOut) && (errStatusCode !== DisconnectReason.connectionClosed);
                console.log(`[WhatsApp] ❌ Account: ${accountId} disconnected from WhatsApp`);
                console.log('[WhatsApp] ❌ connection closed due to ', (lastDisconnect?.error as Boom).output.payload.message, ', reconnecting ', shouldReconnect);
                const userLogout = (errStatusCode === DisconnectReason.loggedOut);
                const badSession = (errStatusCode === DisconnectReason.badSession);
                sendToClient(accountId, { type: 'connectionStatus', status: 'close', accountId: accountId });
                if (userLogout || badSession) {
                    const phoneNumber = sock.authState.creds.me?.id;
                    console.log(`[WhatsApp] ✅ User with phone number: ${phoneNumber} has logout`);
                    try {
                        fs.rmSync(`baileys_auth_info/${email}/auth_info_${accountId}`, { recursive: true, force: true });
                        console.log('📁 session folder deleted succesfully');
                        if (phoneNumber && badSession) {
                            console.log('✅ Reconnecting due to bad session : ', errStatusCode);
                            const phnNumber = phoneNumber.split(':')[0];
                            this.connectWhatsApp(email, phnNumber, sendToClient.bind(this)); // Reconnect
                        }
                        await this.disconnectWhatsApp(accountId);
                    } catch (error) {
                        console.log('📁 session folder deleted failed')
                    }
                }
                const phoneNumber = sock.authState.creds.me?.id;
                // Implement reconnect logic if needed
                if (shouldReconnect) {
                    if (phoneNumber) {
                        const newId = phoneNumber.split(':')[0];
                        console.log(`[WhatsApp] ✅ PhoneNumber found while reconnecting : : ${phoneNumber}`);
                        if (errStatusCode === DisconnectReason.restartRequired) {
                            await this.renameSessionFolder(email, accountId, phoneNumber);
                            console.log(`[WhatsApp] 🔄 Instance for account: ${accountId} is closed. Recreating with new instance ${newId}`);
                            sendToClient(accountId, { type: 'reconnect', oldId: accountId, newId: newId });
                            await this.disconnectWhatsApp(accountId);// Remove the old instance
                        }
                        // this.connectWhatsApp(username, newId, sendToClient.bind(this)); // Reconnect
                    } else {
                        console.log('[WhatsApp] ❌ PhoneNumber NOT found while reconnecting : ', phoneNumber)
                    }
                }
            }

        });

        sock.ev.on('creds.update', saveCreds);
    }

    private async renameSessionFolder(email: string, oldAccountId: string, newAccountId: string): Promise<void> {
        try {
            const phn = newAccountId.split(':')[0];
            const oldPath = `baileys_auth_info/${email}/auth_info_${oldAccountId}`;
            const newPath = `baileys_auth_info/${email}/auth_info_${phn}`;

            if (oldAccountId.includes('@s.whatsapp.net')) {
                return;
            }

            //delete folder if newPath exist
            if (fs.existsSync(newPath)) {
                console.log(`[WhatsApp] 📁 Session folder exists skipping renaming`);
                return;
            }

            if (fs.existsSync(oldPath)) {
                fs.renameSync(oldPath, newPath);
                console.log(`[WhatsApp] 📁 Session folder renamed from ${oldAccountId} to ${phn}`);
            }

        } catch (error) {
            console.error(`[WhatsApp] ❌ Error renaming session folder: ${error}`);
        }
    }

    async isPhoneNumberOnWhatsApp(accountId: string, phoneNumber: string): Promise<boolean | null> {
        const instance = this.baileysInstances.get(accountId);
        if (!instance || !instance.sock) {
            console.error(`[WhatsApp] Instance not found for account: ${accountId}`);
            return null;
        }

        try {
            const result = await instance.sock.onWhatsApp(phoneNumber);
            if (result && result.length > 0) {
                return result[0].exists as boolean
            }
            return false;
        } catch (error) {
            console.error(`[WhatsApp] Error checking phone number ${phoneNumber}:`, error);
            return null;
        }
    }

    async disconnectWhatsApp(accountId: string): Promise<void> {
        const instance = this.baileysInstances.get(accountId);
        if (instance) {
            console.log(`[WhatsApp] ⌚ Disconnecting... account: ${accountId} from WhatsApp`);
            await instance.sock.ws.close();
            this.baileysInstances.delete(accountId);
            console.log(`[WhatsApp] ❌ WhatsApp connection closed for account: ${accountId}, Total WhatsApp instance : ${this.baileysInstances.size}`);
        } else {
            console.error(`[WhatsApp] ❌ WhatsApp instance not found for account: ${accountId}, Total WhatsApp instance : ${this.baileysInstances.size}`);
        }
    }

    async sendWhatsAppMessage(accountId: string, phoneNumber: string, message: string, images: string[] = []): Promise<boolean> {
        const instance = this.baileysInstances.get(accountId);
        try {
            if (instance) {
                if (images.length > 0) {
                    for (const imageUrl of images) {
                        const sent = await instance.sock
                            .sendMessage(phoneNumber, { image: { url: imageUrl }, caption: message, viewOnce: false, })
                            .then(() => true)
                            .catch(() => false);

                        if (!sent) {
                            console.log('[WhatsApp] ❌ Failed to send message to ', phoneNumber);
                            return false; // Return false immediately on failure
                        } else {
                            console.log('[WhatsApp] ✅ Message Send to ', phoneNumber);
                        }

                        await new Promise(resolve => setTimeout(resolve, 1000)); // Add a delay to avoid rate limiting
                    }
                    return true; // Return true if all images sent successfully
                } else {
                    const sent = await instance.sock
                        .sendMessage(phoneNumber, { text: message })
                        .then(() => true)
                        .catch(() => false);

                    if (!sent) {
                        console.log('[WhatsApp] ❌ Failed to send message to ', phoneNumber);
                        return false;
                    } else {
                        console.log('[WhatsApp] ✅ Message Send to ', phoneNumber);
                        return true;
                    }
                }
            } else {
                console.log('[WhatsApp] ❌ Instance not found for accountId:', accountId);
                return false; // Return false if instance is not found
            }
        } catch (error) {
            console.error(`[WhatsApp] Error sending message to ${phoneNumber}:`, error);
            return false; // Return false on error
        }
    }
}
