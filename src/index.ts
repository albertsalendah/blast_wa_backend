import 'dotenv/config'
import makeWASocket, { DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, useMultiFileAuthState, Browsers, WAConnectionState, } from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import NodeCache from 'node-cache'
import MAIN_LOGGER from '@whiskeysockets/baileys/lib/Utils/logger'
import pino from "pino"
import fs from "fs"
import express from "express"
import fileUpload from 'express-fileupload'
import bodyParser from 'body-parser'
import cors from 'cors'
import http from 'http'
import { Server, Socket } from 'socket.io'
import mongoose from 'mongoose'
import cron from 'node-cron'
import { createNewToken } from './utils/createToken'
import { sendmessagePOST, getHistory } from './sendmessagePOST'
import { createScheduleMessage, sendScheduleMessage } from './sendscheduleMessage'

const mongoURI = "mongodb+srv://albertsalendah:9PQ3o1kyTcTPes8q@blastwacluster.jpiwxtk.mongodb.net/blastwa?retryWrites=true&w=majority";

//const mongoURI = 'mongodb://127.0.0.1:27017/blastwa';

const logger = MAIN_LOGGER.child({})
logger.level = 'silent'

export const app = express();
app.use(fileUpload({
	createParentPath: true
}));
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
const server = http.createServer(app);
export const io = new Server(server);

const port = process.env.PORT || 8080;
let qrCode: String = '';
let soket: Socket;
let conns: WAConnectionState | undefined;

const msgRetryCounterCache = new NodeCache()

export const startSock = async () => {
	const { state, saveCreds } = await useMultiFileAuthState('baileys_auth_info')
	// fetch latest version of WA Web
	const { version, isLatest } = await fetchLatestBaileysVersion()
	console.log(`using WA v${version.join('.')}, isLatest: ${isLatest}`)

	const sock = makeWASocket({
		defaultQueryTimeoutMs: undefined,
		version,
		logger: pino({ level: "silent" }),
		printQRInTerminal: false,
		keepAliveIntervalMs: 60000,
		auth: {
			creds: state.creds,
			keys: makeCacheableSignalKeyStore(state.keys, logger),
		},
		msgRetryCounterCache,
		browser: Browsers.macOS('Desktop'),
	})
	sock.ev.process(
		async (events) => {
			if (events['connection.update']) {
				const update = events['connection.update']
				const { connection, lastDisconnect } = update
				try {
					if (connection === 'close') {
						// reconnect if not logged ou
						let reason = new Boom(lastDisconnect?.error).output.statusCode;
						if (reason === DisconnectReason.badSession || reason === DisconnectReason.loggedOut) {
							console.log('Koneksi Terputus badSession');
							try {
								fs.rmSync('baileys_auth_info', { recursive: true, force: true });
								console.log('folder deleted succesfully')
							} catch (error) {
								console.log('folder deleted failed')
							}
							startSock()
						} else if (reason === DisconnectReason.connectionClosed ||
							reason === DisconnectReason.connectionLost ||
							reason === DisconnectReason.connectionReplaced
						) {
							cron.schedule('*/1 * * * *', function () {
								console.log("Connection closed, reconnecting....");
								startSock()
							})
						} else if (reason === DisconnectReason.restartRequired ||
							reason === DisconnectReason.timedOut) {
							console.log("Connection closed, Restarting....");
							startSock()
						}
						else {
							console.log(`Unknown DisconnectReason: ${reason}|${lastDisconnect?.error}`)
							cron.schedule('*/1 * * * *', function () {
								console.log("Unknown DisconnectReason, reconnecting....");
								startSock()
							})
						}
						mongoose.disconnect
					}
				} catch (error) {
					console.log("Error Trying To reconnect When Connection Is Closed", error)
				}

				console.log('connection update', update)

				conns = connection

				mongoose.connect(mongoURI)
					.then(() => {
						console.log('Connected to MongoDB')
					})
					.catch(error => {
						console.log('MongoDB connection error:', error)
						cron.schedule('*/2 * * * *', function () {
							console.log("Connection closed, reconnecting....");
							startSock()
						})
					});
			
					if (update.qr == undefined) {
						qrCode = ''
						if (connection === "close" || connection === 'connecting') {
							updateQR("disconnected");
						} else {
							updateQR("connected");
							try {
								sendmessagePOST(sock)
								createScheduleMessage()
							} catch (error) {
								console.log('Connection Status 01 ' + connection+" ",error)
							}
							getHistory()
							app.get("/logout", async (req, res) => {
								try {
									//await sock.logout()
									//await startSock()
									res.json('Logout succesfully')
								} catch (error) {
									console.log('folder deleted failed')
									res.json('Logout failed');
								}
							})
						}
						console.log('Connection Status 01 ' + connection)
					} else {
						qrCode = update.qr
						updateQR("qr");
					}
			}
			// credentials updated -- save them
			if (events['creds.update']) {
				await saveCreds()
			}
		}
	)
	// Schedule Message
	//cron.schedule('* 7 * * *', function () {
	//sendScheduleMessage(sock)
	//})
	//===============================
	return sock
}

io.on('connection', async (socket: Socket) => {
	soket = socket
	console.log('A user connected');
	if (mongoose.connection.readyState === 1) {
		if (isConnected()) {
			if (conns === 'close' || conns === 'connecting') {
				updateQR("disconnected");
				//startSock()
			} else {
				updateQR("connected");
			}
			console.log('Connection Status 02 ' + conns)
		} else {
			updateQR("qr");
		}
	}
	socket.on('disconnect', () => {
		console.log('A user disconnected');
	});
})

export const isConnected = () => {
	if (qrCode == '') {
		return true;
	} else {
		return false;
	}
};

const updateQR = (data: String) => {
	switch (data) {
		case "qr":
			soket?.emit("qr", qrCode);
			soket?.emit("log", "QR Code received, please scan!!");
			console.log('QR Code received, please scan!');
			break;
		case "connected":
			soket?.emit("qrstatus", "connected");
			soket?.emit("log", "WhatsApp terhubung!");
			console.log('WhatsApp terhubung!');
			qrCode = '';
			break;
		case "disconnected":
			soket?.emit("qrstatus", "disconnected");
			soket?.emit("log", "WhatsApp belum terhubung!");
			console.log('WhatsApp belum terhubung!');
			qrCode = '';
			break;
		default:
			break;
	}
};

cron.schedule('0 * * * *', function () {
	createNewToken()
})

startSock().catch(err => console.log("unexpected error: " + err))
server.listen(port, () => {
	console.log("Server Running On Port : ", port);
})
