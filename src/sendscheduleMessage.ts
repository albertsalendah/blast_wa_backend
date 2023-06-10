import axios from 'axios';
import { phoneNumberFormatter } from './utils/formatter'
import { app, isConnected } from './index';
import { UploadedFile } from 'express-fileupload'
import path from 'path'
import fs from "fs"
import { token } from './models/tokenschema'
import { scheduleModel } from './models/scheduleMessageSchema'
import { format } from 'date-fns';
import { daftarNO } from './testNO';

export async function createScheduleMessage() {
    app.post("/create-schedule-message", async (req, res) => {
        let filesimpan: UploadedFile[] = [];
        const file_dikirim = req.files?.file_dikirim;

        let file_ubah_nama: String[] = [];
        let fileDikirim_Mime: string[] = []
        if (file_dikirim instanceof Array) {
            filesimpan = file_dikirim;
        } else if (file_dikirim) {
            filesimpan = [file_dikirim];
        }
        for (let i = 0; i < filesimpan.length; i++) {
            file_ubah_nama[i] = 'SCHEDULE_' + new Date().getTime() + '_' + filesimpan[i].name;
            filesimpan[i].mv('./uploads/' + file_ubah_nama[i]);
            fileDikirim_Mime[i] = filesimpan[i].mimetype;
        }

        const newMessage = {
            message: req.body.message,
            tahun: req.body.tahun,
            progdi: req.body.progdi,
            tanggal_kirim: req.body.tanggal_kirim,
            nama_file: file_ubah_nama
        }

        try {
            await scheduleModel.create(newMessage);
            res.status(200).json({
                status: true,
                response: 'Jadwal Pesan Berhasil Ditambahkan',
            });
        } catch (error) {
            res.status(500).json({
                status: false,
                response: `Terjadi Kesalahan Saat Menyimpan Pesan`,
            });
        }
    });
}

export async function sendScheduleMessage(sock: any) {

    const currentDate = new Date();
    const formattedDate = format(currentDate, 'dd MMMM yyyy');
    const scheduleMessages = await scheduleModel.find({ tanggal_kirim: formattedDate })
    const savedtoken = await token.find().select('access_token');

    for (let i = 0; i < scheduleMessages.length; i++) {
        let data = JSON.stringify({
            "tahun": scheduleMessages[i].tahun,
            "progdi": scheduleMessages[i].progdi
        });

        let config = {
            method: 'get',
            maxBodyLength: Infinity,
            url: 'https://app.uksw.edu/divprom/api/camaru',
            headers: {
                'Authorization': 'bearer ' + savedtoken[0].access_token,
                'Content-Type': 'application/json'
            },
            data: data
        };
        try {
            let listNO: String[] = [];
            let numberWA: string;
            const delayBetweenItems = 3000; // 5 seconds
            const delayEveryTenItems = 30000; // 1 minute
            let count = 0;
            //listNO = ['082138345212'];
            listNO = daftarNO
            // listNO = await axios.request(config)
            //     .then((response) => {
            //         response.data.response.forEach((group: any[]) => {
            //             group.forEach((item) => {
            //                 item.No_HP = item.No_HP.split(",").filter(Boolean);
            //                 item.No_HP.forEach(async (no: String) => {
            //                     if (no.length > 10) {
            //                         listNO.push(no);
            //                     }
            //                 });
            //             });
            //         });
            //         return listNO;
            //         console.log(response.data.response.length);
            //     })
            //     .catch((error) => {
            //         console.log(error);
            //         return [];
            //     });
            if (scheduleMessages[i].nama_file?.length == 0) {
                if (listNO.length > 0) {
                    for (let j = 0; j < listNO.length; j++) {
                        const item = listNO[j];
                        setTimeout(async () => {
                            count++;
                            ///===========================================
                            //numberWA = '62' + item.substring(1) + "@s.whatsapp.net";
                            numberWA = phoneNumberFormatter(item);
                            if (isConnected()) {
                                const [exists] = await sock.onWhatsApp(numberWA);
                                if (exists?.jid || (exists && exists?.jid)) {

                                    sock.sendMessage(exists.jid || exists.jid, { text: scheduleMessages[i].message })
                                        .then(() => {
                                            console.log('Pasan Terkirim Ke : ' + numberWA);
                                        })
                                        .catch(() => {
                                            console.log('Pasan Tidak Terkirim');
                                        });
                                } else {
                                    console.log(`Nomor ${numberWA} tidak terdaftar. `);
                                }
                            } else {
                                console.log(`WhatsApp belum terhubung.`)
                            }
                            //=======================================
                            if ((j + 1) % 50 === 0 && j + 1 !== listNO.length) {
                                setTimeout(() => {
                                    console.log('Waiting...');
                                }, delayBetweenItems);
                            }
                            if (count === listNO.length) {
                                console.log('Pesan Terjadwal Tanpa File Telah Terkirim Semua ');
                                scheduleModel.findByIdAndDelete(scheduleMessages[i]._id).then((deletedDocument) => {
                                    if (!deletedDocument) {
                                        console.log('Document not found');
                                    } else {
                                        console.log('Document deleted successfully:', deletedDocument);
                                    }
                                })
                                    .catch((error) => {
                                        console.error('Error deleting document:', error);
                                    });
                            }
                        }, j * delayBetweenItems + Math.floor(j / 50) * delayEveryTenItems);
                    }
                    console.log("Total No : ", listNO.length);
                } else {
                    console.log(`Tidak Ada Nomor Yang Ditemukan`)
                }
            } else {
                //console.log('Kirim document');
                if (listNO.length != 0) {
                    for (let k = 0; k < listNO.length; k++) {
                        const item = listNO[k];
                        setTimeout(async () => {
                            count++;
                            ///===========================================
                            //numberWA = '62' + item.substring(1) + "@s.whatsapp.net";
                            numberWA = phoneNumberFormatter(item);
                            let filesimpan: UploadedFile[] = [];
                            fs.readdir('./uploads', (err, files) => {
                                if (err) {
                                    console.error('Error reading folder:', err);
                                    return;
                                }

                                files.forEach((file) => {
                                    const filePath = `${'./uploads'}/${file}`;
                                    const fileStats = fs.statSync(filePath);

                                    if (fileStats.isFile()) {
                                        const uploadedFile = {
                                            name: file,
                                            mimetype: 'application/octet-stream', // Set the appropriate mimetype here
                                            data: fs.readFileSync(filePath),
                                            size: fileStats.size,
                                            encoding: '7bit',
                                            tempFilePath: '',
                                            truncated: false,
                                            md5: '', // You can calculate the MD5 hash if needed
                                        } as UploadedFile;

                                        filesimpan.push(uploadedFile);
                                    }
                                });

                                // You can now access the file properties using filesimpan[i].mimetype
                            });
                            let namafiledikirim: string[] = []
                            let extensionName: String[] = []
                            let fileDikirim_Mime: string[] = []

                            for (let l = 0; l < filesimpan.length; l++) {
                                fileDikirim_Mime[l] = filesimpan[l].mimetype
                            }
                            if (isConnected()) {
                                const [exists] = await sock.onWhatsApp(numberWA);
                                if (exists?.jid || (exists && exists?.jid)) {
                                    // let namafiledikirim: string[] = []
                                    // let extensionName: String[] = []

                                    for (let j = 0; j < filesimpan.length; j++) {
                                        namafiledikirim[j] = './uploads/' + filesimpan[j].name;
                                        //fileDikirim_Mime[j] = namafiledikirim[j].mimetype;
                                        extensionName[j] = path.extname(namafiledikirim[j]);
                                        if (extensionName[j] === '.jpeg' || extensionName[j] === '.jpg' || extensionName[j] === '.png' || extensionName[j] === '.gif') {
                                            await sock.sendMessage(exists.jid || exists.jid, {
                                                image: {
                                                    url: namafiledikirim[j],
                                                    caption: scheduleMessages[i].message
                                                },
                                                caption: scheduleMessages[i].message
                                            }).then(() => {
                                                console.log('pesan berhasil terkirim');
                                            }).catch(() => {
                                                console.log('pesan gagal terkirim');
                                            });
                                        } else if (extensionName[j] === '.mp3' || extensionName[j] === '.ogg') {
                                            await sock.sendMessage(exists.jid || exists.jid, {
                                                audio: {
                                                    url: namafiledikirim[j],
                                                    caption: scheduleMessages[i].message
                                                },
                                                caption: scheduleMessages[i].message,
                                                mimetype: 'audio/mp4'
                                            }).then(() => {
                                                console.log('pesan berhasil terkirim');
                                            }).catch(() => {
                                                console.log('pesan gagal terkirim');
                                            });
                                        } else {
                                            await sock.sendMessage(exists.jid || exists.jid, {
                                                document: {
                                                    url: namafiledikirim[j],
                                                    caption: scheduleMessages[i].message
                                                },
                                                caption: scheduleMessages[i].message,
                                                mimetype: fileDikirim_Mime[j],
                                                fileName: filesimpan[j].name
                                            }).then(() => {
                                                console.log('pesan berhasil terkirim');
                                            }).catch(() => {
                                                console.log('pesan gagal terkirim');
                                            });
                                        }
                                    }


                                } else {
                                    console.log(`Nomor ${numberWA} tidak terdaftar.`);
                                }
                            } else {
                                console.log('WhatsApp belum terhubung')
                            }
                            //=======================================
                            if ((k + 1) % 50 === 0 && k + 1 !== listNO.length) {
                                setTimeout(() => {
                                    console.log('Waiting for 1 minute...');
                                }, delayBetweenItems);
                            }
                            if (count === listNO.length) {
                                for (let j = 0; j < filesimpan.length; j++) {
                                    namafiledikirim[j] = './uploads/' + filesimpan[j].name;
                                    if (fs.existsSync(namafiledikirim[j])) {
                                        fs.unlink(namafiledikirim[j], (err) => {
                                            if (err && err.code == "ENOENT") {
                                                // file doens't exist
                                                console.info("File doesn't exist, won't remove it.");
                                            } else if (err) {
                                                console.error("Error occurred while trying to remove file.");
                                            }
                                            console.log('File MIME!');
                                        });
                                    }
                                }
                                scheduleModel.findByIdAndDelete(scheduleMessages[i]._id).then((deletedDocument) => {
                                    if (!deletedDocument) {
                                        console.log('Document not found');
                                    } else {
                                        console.log('Document deleted successfully:', deletedDocument);
                                    }
                                })
                                    .catch((error) => {
                                        console.error('Error deleting document:', error);
                                    });
                                console.log('Pesan Terjadwal Dengan File Telah Terkirim Semua');
                            }
                        }, k * delayBetweenItems + Math.floor(k / 50) * delayEveryTenItems);
                    }
                } else {
                    console.log('Tidak Ada Nomor Yang Ditemukan')
                }
            }
        } catch (error) {
            console.log('Error Saat Mengirim Pesan', error)
        }
    }
}