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
import mongoose, { Path } from 'mongoose'
import cron from 'node-cron'
import { createNewToken } from './routes/createToken'
import { sendmessagePOST, getHistory, getListPesan, deleteHistoryPesan, checkTotalMahasiswa, downloadHistory } from './routes/sendmessagePOST'
import { createScheduleMessage, sendScheduleMessage } from './sendscheduleMessage'
import pm2 from 'pm2'
import { getListFile, downloadFile, deleteFile } from './routes/getFiles'
import { addTemplatePesan, getTemplatePesan, deleteTemplatePesan, editTemplatePesan } from './routes/templates_pesan'
import { getListUploadedFile, downloadUploadedFile, deleteUploadedFile } from './routes/getUploadedFile'
import { getListFileSisaData, downloadFileSisaData, deleteFileSisaData } from './routes/getExtraData'
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User, { IUser } from './models/user_schema';

const mongoURI = process.env.MONGO_URI || 'mongodb+srv://albertsalendah:9PQ3o1kyTcTPes8q@blastwacluster.jpiwxtk.mongodb.net/test_blast_wa?retryWrites=true&w=majority';

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

const startSock = async () => {
	const { state, saveCreds } = await useMultiFileAuthState('baileys_auth_info')
	// fetch latest version of WA Web
	const { version, isLatest } = await fetchLatestBaileysVersion()
	console.log(`using WA v${version.join('.')}, isLatest: ${isLatest}`)

	const sock = makeWASocket({
		version,
		logger,
		printQRInTerminal: false,
		defaultQueryTimeoutMs: undefined,
		keepAliveIntervalMs: 60000,
		//qrTimeout: (5*60000),
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
					const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode
					if (shouldReconnect === DisconnectReason.loggedOut || shouldReconnect === DisconnectReason.timedOut
						|| shouldReconnect === DisconnectReason.badSession) {
						updateQR("disconnected")
						console.log('Connection closed, trying to reconnect...')
						if (shouldReconnect === DisconnectReason.loggedOut || shouldReconnect === DisconnectReason.badSession) {
							soket?.emit('logout', "logout")
							try {
								fs.rmSync('baileys_auth_info', { recursive: true, force: true });
								console.log('folder deleted succesfully')
							} catch (error) {
								console.log('folder deleted failed')
							}
						}
						startSock()
					} else {
						updateQR("disconnected");
						conns = false
						console.log('Reconnecting...')
						restart()
					}
					console.log('shouldReconnect? : ', shouldReconnect);
				}

				console.log('connection update: ', update)
				console.log("Socket AuthState ID : " + sock.authState.creds.me?.id)
				console.log('connection Status: ', connection)
				if (update.qr == undefined) {
					if (sock.authState.creds.me?.id != null || sock.authState.creds.me?.id != undefined) {
						if (connection !== 'close') {
							updateQR("connected");
							conns = true
						}
					} else {
						updateQR("disconnected");
						conns = false
					}
				} else {
					qrCode = update.qr
					updateQR("qr");
					conns = false
				}
			}
			// credentials updated -- save them
			if (events['creds.update']) {
				await saveCreds()
			}
		}
	)
	io.setMaxListeners(15);
	io.on('connection', async (socket: Socket) => {
		soket = socket
		socket.setMaxListeners(15);
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
	return sock
}

export const isConnected = () => {
	if (conns) {
		return true;
	} else {
		return false;
	}
};

async function restart() {
	setTimeout(() => {
		pm2.restart('wa-blast-backend', (err) => {
			if (err) {
				console.error('Error restarting PM2:', err);
			} else {
				console.log('PM2 restarted successfully.');
			}
		});
	}, 5000);
}

const updateQR = (data: String) => {
	switch (data) {
		case "qr":
			soket?.emit("qr", qrCode);
			soket?.emit("log", "QR Code Diterima, Silahkan Scan! \nTunggu Hingga Proses Sinkronisasi Selesai Di Aplikasi Whatsapp Selesai");
			console.log('QR Code Diterima, Silahkan Scan!');
			break;
		case "connected":
			soket?.emit("qrstatus", "connected");
			soket?.emit("log", "WhatsApp terhubung!");
			console.log('WhatsApp terhubung!');
			break;
		case "disconnected":
			soket?.emit("qrstatus", "disconnected");
			soket?.emit("log", "WhatsApp belum terhubung!");
			console.log('WhatsApp belum terhubung!');
			break;
		default:
			break;
	}
};

// cron.schedule('0 * * * *', function () {
// 	createNewToken()
// })



startSock().then((sock) => {
	const folderPath: Path[] = ['files/extra_data/', 'files/input_list_nomor/', 'files/output_list_nomor/', 'files/uploads/'];
	// Check if the folder exists
	folderPath.forEach((path: Path) => {
		if (!fs.existsSync(path)) {
			// Create the folder
			fs.mkdirSync(path, { recursive: true });
			console.log('Folder created successfully.');
		} else {
			console.log('Folder already exists.');
		}
	})
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
	getListFileSisaData()
	deleteFileSisaData()
	downloadFileSisaData()
	getListPesan()
	deleteHistoryPesan()
	checkTotalMahasiswa()
	getListUploadedFile()
	downloadUploadedFile()
	deleteUploadedFile()
	downloadHistory()
	app.get("/logout", async (req, res) => {
		try {
			await sock.logout()
			res.json('Logout succesfully')
		} catch (error) {
			console.log('Logout failed')
			res.json('Logout failed');
		}
	})

}).catch(err => console.log("unexpected error: " + err))
mongoose.connect(mongoURI)
	.then(() => {
		console.log('Connected to MongoDB')
	})
	.catch(error => {
		console.log('MongoDB connection error:', error)
		cron.schedule('*/2 * * * *', function () {
			console.log("Connection closed, reconnecting....");
		})
	});
app.post("/login", async (req, res) => {
	try {
		const { username, password } = req.body;

		// Find the user by username
		const user = await User.findOne({ username });
		if (!user) {
			res.status(401).json({ message: 'Invalid credentials' });
			if (!conns) {
				updateQR("disconnected");
				soket?.emit("log", 'Invalid credentials');
			}
			return;
		}

		// Compare the provided password with the hashed password in the database
		const isPasswordValid = await bcrypt.compare(password, user.password);
		if (!isPasswordValid) {
			res.status(401).json({ message: 'Invalid credentials' });
			if (!conns) {
				updateQR("disconnected");
				soket?.emit("log", 'Invalid credentials');
			}
			return;
		}

		// Generate a JSON Web Token (JWT)
		const token = jwt.sign({ userId: user._id }, 'secretKey');
		if (!conns) {
			updateQR("disconnected");
			soket?.emit("log", "Loading QR Code...");
		} else {
			updateQR("connected");
		}
		res.status(200).json({ token });
	} catch (error) {
		res.status(500).json({ message: 'Internal server error' });
	}
})
app.post("/register", async (req, res) => {
	try {
		const adminUserName = req.body.admin
		const adminpass = req.body.adminpass
		const username = req.body.username;
		const password = req.body.password;
		// Check if the username is already taken
		if (adminUserName === process.env.TOKEN_USER && adminpass === process.env.TOKEN_PASS) {
			const existingUser = await User.findOne({ username });
			if (existingUser) {
				res.status(400).json({ message: 'Username already taken' });
				return;
			}

			// Hash the password
			const hashedPassword = await bcrypt.hash(password, 10);

			// Create a new user
			const newUser: IUser = new User({
				username,
				password: hashedPassword,
			});

			// Save the user to the database
			await newUser.save();

			res.status(201).json({ message: 'User registered successfully' });
		} else {
			res.status(401).json({ message: 'Invalid credentials' });
		}
	} catch (error) {
		res.status(500).json({ message: 'Internal server error' });
	}
})
server.listen(port, () => {
	console.log("Server Running On Port : ", port);
})