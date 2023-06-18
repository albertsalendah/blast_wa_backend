import 'dotenv/config'
import makeWASocket, { DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, useMultiFileAuthState, Browsers, WAConnectionState, } from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import NodeCache from 'node-cache'
import MAIN_LOGGER from '@whiskeysockets/baileys/lib/Utils/logger'
import fs from "fs"
import express from "express"
import fileUpload from 'express-fileupload'
import bodyParser from 'body-parser'
import cors from 'cors'
import http from 'http'
import { Server, Socket } from 'socket.io'
import mongoose, { get } from 'mongoose'
import cron from 'node-cron'
import { createNewToken } from './routes/createToken'
import { sendmessagePOST, getHistory } from './routes/sendmessagePOST'
import { createScheduleMessage, sendScheduleMessage } from './sendscheduleMessage'
import pm2 from 'pm2'
import { getListFile, downloadFile, deleteFile } from './routes/getFiles'
import { addTemplatePesan, getTemplatePesan, deleteTemplatePesan, editTemplatePesan } from './routes/templates_pesan'

const mongoURI = process.env.LOCAL_MONGO_URI || 'mongodb://127.0.0.1:27017/test_blast_wa';

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
let conns: boolean;

const msgRetryCounterCache = new NodeCache()

export const startSock = async () => {
	const { state, saveCreds } = await useMultiFileAuthState('baileys_auth_info')
	// fetch latest version of WA Web
	const { version, isLatest } = await fetchLatestBaileysVersion()
	console.log(`using WA v${version.join('.')}, isLatest: ${isLatest}`)

	const sock = makeWASocket({
		defaultQueryTimeoutMs: undefined,
		version,
		logger,
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
				if (connection === 'close') {
					const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut
					if (shouldReconnect) {
						await startSock()
					} else {
						console.log('Connection closed, trying to reconnect...')
						try {
							fs.rmSync('baileys_auth_info', { recursive: true, force: true });
							console.log('folder deleted succesfully')
						} catch (error) {
							console.log('folder deleted failed')
						}
					}
					console.log('shouldReconnect? : ', shouldReconnect);
					updateQR("disconnected")
					// pm2.restart('blast_wa', (err) => {
					// 	if (err) {
					// 		console.error('Error restarting PM2:', err);
					// 	} else {
					// 		console.log('PM2 restarted successfully.');
					// 	}
					// });
				}

				if (update.qr == undefined) {
					qrCode = ''
					updateQR("connected");
				} else {
					qrCode = update.qr
					updateQR("qr");
				}
				mongoose.connect(mongoURI)
					.then(() => {
						console.log('Connected to MongoDB')
						// if (sock.user?.id !== undefined) {
						// 	if (sock.user?.id.split(":")[0] !== "6281935614654" || sock.user?.id.split(":")[0] !== "628112822278" || sock.user?.id.split(":")[0] !== "6285640551818") {
						// 		console.log(sock.user?.id + " you are not registered...")
						// 		conns = false
						// 		sock.logout();
						// 	} else {
						// 		console.log("User is admin");
						// 		conns = true
						// 	}
						// }
					})
					.catch(error => {
						console.log('MongoDB connection error:', error)
						cron.schedule('*/2 * * * *', function () {
							console.log("Connection closed, reconnecting....");
						})
					});

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
	soket = socket
	console.log('A user connected');
	if (isConnected()) {
		updateQR("connected");
	} else {
		updateQR("disconnected");
	}
	socket.on('disconnect', () => {
		console.log('A user disconnected');
	});
})

export const isConnected = () => {
	if (conns) {
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

startSock().then((sock) => {
	sendmessagePOST(sock)
	createScheduleMessage()
	getHistory()
	getListFile()
	downloadFile()
	deleteFile()
	addTemplatePesan()
	getTemplatePesan()
	deleteTemplatePesan()
	editTemplatePesan()
	app.get("/logout", async (req, res) => {
		try {
			//updateQR("disconnected");
			await sock.logout()
			res.json('Logout succesfully')
		} catch (error) {
			console.log('folder deleted failed')
			res.json('Logout failed');
		}
	})

}).catch(err => console.log("unexpected error: " + err))
server.listen(port, () => {
	console.log("Server Running On Port : ", port);
})
