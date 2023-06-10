import axios from 'axios';
import { phoneNumberFormatter } from './utils/formatter'
import { app, isConnected, io } from './index';
import { token } from './models/tokenschema'
import { UploadedFile } from 'express-fileupload'
import path from 'path'
import fs from "fs"
import { applicants } from './testNO';
import { history } from './models/history_send_schema'
import { v4 as uuidv4 } from 'uuid';

//let isLoopRunning = false;
interface Mahasiswa {
    No_Pendaftaran: string;
    Nama_Pendaftar: string;
    No_HP: String[];
    Tahun_Akademik: string;
    Status_Registrasi_Ulang: String;
    Prodi_Registrasi_Ulang: String;
}

// In-memory job/task store
interface Job {
    progress: number;
    status: string;
    sendto: string;
}

const jobs: { [jobId: string]: Job } = {};

export async function sendmessagePOST(sock: any) {
    app.post("/send-message", async (req, res) => {
        const pesankirim: String = req.body.message;

        const savedtoken = await token.find().select('access_token');
        let data = JSON.stringify({
            "tahun": req.body.tahun,
            "progdi": req.body.progdi
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
        let numberWA: string;
        let listMahasiswa: Mahasiswa[] = [];
        const delayBetweenItems = 3000; // 5 seconds
        const delayEveryTenItems = 30000; // 1 minute
        let count = 0;

        // Generate a unique job identifier
        const jobId = uuidv4();
        // Store the initial job details (e.g., progress: 0, status: 'processing')
        jobs[jobId] = { progress: 0, status: 'processing', sendto: req.body.progdi };
        // Send a Socket.IO message to the client, informing it about the new job
        io.emit('job', { jobId, progress: 0, status: 'processing', sendto: req.body.progdi });

        try {
            listMahasiswa = applicants
            // listMahasiswa = await axios.request(config)
            //     .then((response) => {
            //         let uniqueResponse = []
            //         if (req.body.status_regis === "All") {
            //             uniqueResponse = response.data.response.flat(2)
            //         } else {
            //             uniqueResponse = response.data.response.flat(2)
            //                 .filter((item: { Status_Registrasi_Ulang: string; }) => item.Status_Registrasi_Ulang.includes(req.body.status_regis));
            //         }
            //         const filteredResponse = uniqueResponse.reduce((accumulator: any[], item: any) => {
            //             const isDuplicate = accumulator.some((accItem) => accItem.Status_Registrasi_Ulang === item.Status_Registrasi_Ulang && accItem.No_Pendaftaran === item.No_Pendaftaran);
            //             if (!isDuplicate) {
            //                 accumulator.push(item);
            //             }
            //             return accumulator;
            //         }, []);

            //         //response.data.response.forEach((group: any[]) => {
            //         filteredResponse.forEach((item: any) => {
            //             item.No_HP = item.No_HP.split(",").filter(Boolean);
            //             const uniqueNoHP = Array.from(new Set(item.No_HP));
            //             item.No_HP = uniqueNoHP;
            //             item.No_HP.forEach(async (no: String) => {
            //                 if (no.length > 10) {
            //                     const mahasiswa: Mahasiswa = {
            //                         No_Pendaftaran: item.No_Pendaftaran,
            //                         Nama_Pendaftar: item.Nama_Pendaftar,
            //                         No_HP: [no],
            //                         Tahun_Akademik: item.Tahun_Akademik,
            //                         Status_Registrasi_Ulang: item.Status_Registrasi_Ulang,
            //                         Prodi_Registrasi_Ulang: item.Prodi_Registrasi_Ulang
            //                     };
            //                     listMahasiswa.push(mahasiswa)
            //                 }
            //             });
            //         });
            //         //});
            //         return listMahasiswa;
            //         // res.status(200).json({             
            //         //     response: listMahasiswa
            //         // });
            //         // console.log(listMahasiswa.length)
            //         // isLoopRunning = false;
            //     })
            //     .catch((error) => {
            //         console.log(error);
            //         return [];
            //         //isLoopRunning = false;
            //     });

            let unRegistercounter = 0;
            let registeredcounter = 0;
            let progress = 0;
            const latestEntry = await history.findOne({}, {}, { sort: { _id: -1 } });
            if (!req.files) {

                if (listMahasiswa.length > 0) {
                    for (let i = 0; i < listMahasiswa.length; i++) {
                        const item = listMahasiswa[i];
                        setTimeout(async () => {
                            count++;
                            numberWA = phoneNumberFormatter(item.No_HP[0]);
                            if (isConnected()) {
                                const [exists] = await sock.onWhatsApp(numberWA);
                                if (exists?.jid || (exists && exists?.jid)) {
                                    registeredcounter++
                                    sock.sendMessage(exists.jid || exists.jid, { text: pesankirim.replace("|", item.Nama_Pendaftar) })
                                        .then(async () => {
                                            console.log('Pasan Terkirim Ke : ' + numberWA);                                          
                                        })
                                        .catch(() => {
                                            console.log('Pasan Tidak Terkirim');
                                        });
                                    await createHistory(item,pesankirim)
                                    console.log('Pasan Terkirim Ke : ' + numberWA);
                                } else {
                                    unRegistercounter++;
                                    console.log(`Nomor ${numberWA} tidak terdaftar. `);
                                }
                                if (jobs[jobId] && jobs[jobId].status === 'processing') {
                                    progress = Math.floor((count / listMahasiswa.length) * 100);
                                    // Update job progress
                                    jobs[jobId].progress = progress;                                   

                                    // Send a Socket.IO message to the client, updating the job progress
                                    io.emit('job', { jobId, progress, status: 'processing',sendto: req.body.progdi});
                                }

                            } else {
                                jobs[jobId].status = 'error';
                                io.emit('job', { jobId, progress: 0, status: 'error', error: `WhatsApp belum terhubung.`,sendto: req.body.progdi });
                                console.log(`WhatsApp belum terhubung.`)
                            }
                            //=======================================
                            if ((i + 1) % 50 === 0 && i + 1 !== listMahasiswa.length) {
                                setTimeout(() => {
                                    console.log('Waiting...');
                                }, delayBetweenItems);
                            }
                            if (count === listMahasiswa.length) {
                                jobs[jobId].status = 'completed';
                                io.emit('job', { jobId, progress: 100, status: 'completed',sendto: req.body.progdi });
                                console.log('Pesan Tanpa File Telah Terkirim Semua ');
                            }
                        }, i * delayBetweenItems + Math.floor(i / 50) * delayEveryTenItems);
                    }
                    console.log("Total No : " + listMahasiswa.length)
                } else {
                    jobs[jobId].status = 'error';
                    io.emit('job', { jobId, progress: 0, status: 'error', error: `Tidak Ada Nomor Yang Ditemukan`,sendto: req.body.progdi });
                    console.log(`Tidak Ada Nomor Yang Ditemukan`)
                }
            } else {
                //console.log('Kirim document');
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
                    file_ubah_nama[i] = new Date().getTime() + '_' + filesimpan[i].name;
                    filesimpan[i].mv('./uploads/' + file_ubah_nama[i]);
                    fileDikirim_Mime[i] = filesimpan[i].mimetype;
                }

                if (listMahasiswa.length != 0) {
                    for (let i = 0; i < listMahasiswa.length; i++) {
                        const item = listMahasiswa[i];
                        setTimeout(async () => {
                            count++;
                            numberWA = phoneNumberFormatter(item.No_HP[0]);
                            let namafiledikirim: string[] = []
                            let extensionName: String[] = []
                            if (isConnected()) {
                                const [exists] = await sock.onWhatsApp(numberWA);
                                if (exists?.jid || (exists && exists?.jid)) {
                                    for (let i = 0; i < file_ubah_nama.length; i++) {
                                        namafiledikirim[i] = './uploads/' + file_ubah_nama[i];
                                        extensionName[i] = path.extname(namafiledikirim[i]);
                                        if (extensionName[i] === '.jpeg' || extensionName[i] === '.jpg' || extensionName[i] === '.png' || extensionName[i] === '.gif') {
                                            registeredcounter++
                                            await sock.sendMessage(exists.jid || exists.jid, {
                                                image: {
                                                    url: namafiledikirim[i],
                                                    caption: pesankirim.replace("|", item.Nama_Pendaftar)
                                                },
                                                caption: pesankirim.replace("|", item.Nama_Pendaftar)
                                            }).then(() => {
                                                console.log('pesan berhasil terkirim');
                                            }).catch(() => {
                                                console.log('pesan gagal terkirim');
                                            });
                                            console.log('Pasan Terkirim Ke : ' + numberWA);
                                        } else if (extensionName[i] === '.mp3' || extensionName[i] === '.ogg') {
                                            registeredcounter++
                                            await sock.sendMessage(exists.jid || exists.jid, {
                                                audio: {
                                                    url: namafiledikirim[i],
                                                    caption: pesankirim.replace("|", item.Nama_Pendaftar)
                                                },
                                                caption: pesankirim.replace("|", item.Nama_Pendaftar),
                                                mimetype: 'audio/mp4'
                                            }).then(() => {
                                                console.log('pesan berhasil terkirim');
                                            }).catch(() => {
                                                console.log('pesan gagal terkirim');
                                            });
                                        } else {
                                            registeredcounter++
                                            await sock.sendMessage(exists.jid || exists.jid, {
                                                document: {
                                                    url: namafiledikirim[i],
                                                    caption: pesankirim.replace("|", item.Nama_Pendaftar)
                                                },
                                                caption: pesankirim.replace("|", item.Nama_Pendaftar),
                                                mimetype: fileDikirim_Mime[i],
                                                fileName: filesimpan[i].name
                                            }).then(() => {
                                                console.log('pesan berhasil terkirim');
                                            }).catch(() => {
                                                console.log('pesan gagal terkirim');
                                            });
                                            console.log('Pasan Terkirim Ke : ' + numberWA);
                                        }
                                    }
                                    await createHistory(item,pesankirim)
                                } else {
                                    console.log(`Nomor ${numberWA} tidak terdaftar.`);
                                }
                                if (jobs[jobId] && jobs[jobId].status === 'processing') {
                                    progress = Math.floor((count / listMahasiswa.length) * 100);
                                    // Update job progress
                                    jobs[jobId].progress = progress;

                                    // Send a Socket.IO message to the client, updating the job progress
                                    io.emit('job', { jobId, progress, status: 'processing',sendto: req.body.progdi });
                                }
                            } else {
                                jobs[jobId].status = 'error';
                                io.emit('job', { jobId, progress: 0, status: 'error', error: `WhatsApp belum terhubung.`,sendto: req.body.progdi });
                                console.log(`WhatsApp belum terhubung.`)
                            }
                            //=======================================
                            if ((i + 1) % 50 === 0 && i + 1 !== listMahasiswa.length) {
                                setTimeout(() => {
                                    console.log('Waiting for 1 minute...');
                                }, delayBetweenItems);
                            }
                            if (count === listMahasiswa.length) {
                                for (let i = 0; i < file_ubah_nama.length; i++) {
                                    namafiledikirim[i] = './uploads/' + file_ubah_nama[i];
                                    if (fs.existsSync(namafiledikirim[i])) {
                                        fs.unlink(namafiledikirim[i], (err) => {
                                            if (err && err.code == "ENOENT") {
                                                // file doens't exist
                                                console.info("File doesn't exist, won't remove it.");
                                            } else if (err) {
                                                console.error("Error occurred while trying to remove file.");
                                            }
                                        });
                                    }
                                }
                                jobs[jobId].status = 'completed';
                                io.emit('job', { jobId, progress: 100, status: 'completed',sendto: req.body.progdi });
                                console.log('Pesan Dengan File Telah Terkirim Semua');
                            }
                        }, i * delayBetweenItems + Math.floor(i / 50) * delayEveryTenItems);
                    }
                    console.log("Total No : " + listMahasiswa.length)
                } else {
                    jobs[jobId].status = 'error';
                    io.emit('job', { jobId, progress: 0, status: 'error', error: `Tidak Ada Nomor Yang Ditemukan`,sendto: req.body.progdi });
                    console.log(`Tidak Ada Nomor Yang Ditemukan`)
                }
            }
        } catch (err) {
            jobs[jobId].status = 'error';
            io.emit('job', { jobId, progress: 0, status: 'error', error: err,sendto: req.body.progdi });
        }
        res.json({ jobId });
    });
}

export async function getHistory() {
    app.get('/history', async (req, res) => {
        try {
            const histories = await history.find();
            res.json(histories);
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch history data' });
        }
    });
}

async function createHistory(item: Mahasiswa, pesankirim: String) {
    const currentDate = new Date();
    const formattedDateTime = currentDate.toLocaleString('en-US');
    const newHistory = {
        tanggal: formattedDateTime,
        no_pendaftaran: item.No_Pendaftaran,
        nama: item.Nama_Pendaftar,
        tahun_ajaran: item.Tahun_Akademik,
        progdi: item.Prodi_Registrasi_Ulang,
        pesan: pesankirim.replace("|", item.Nama_Pendaftar),
        status_registrasi: item.Status_Registrasi_Ulang
    }

    try {
        await history.create(newHistory);
        console.log('History Pesan Berhasil Ditambahkan')
    } catch (error) {
        console.log(`Terjadi Kesalahan Saat Menyimpan History Pesan`)
    }
}

export async function testQu() {
    // app.post('/process', async (req, res) => {
    //     // Generate a unique job identifier
    //     const jobId = uuidv4();

    //     // Store the initial job details (e.g., progress: 0, status: 'processing')
    //     jobs[jobId] = { progress: 0, status: 'processing' };

    //     // Send a Socket.IO message to the client, informing it about the new job
    //     io.emit('job', { jobId, progress: 0, status: 'processing' });

    //     // Perform the long-running task asynchronously
    //     try {
    //         await performTask(jobId);
    //         // Update job status to 'completed' when the task is finished
    //         jobs[jobId].status = 'completed';
    //         io.emit('job', { jobId, progress: 100, status: 'completed' });
    //     } catch (error) {
    //         // Update job status to 'error' if an error occurs during the task
    //         jobs[jobId].status = 'error';
    //         io.emit('job', { jobId, progress: 0, status: 'error', error: error });
    //     }

    //     // Send the job identifier as the response to the client
    //     res.json({ jobId });
    // });
}

// Simulated long-running task
function performTask(jobId: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        let progress = 0;
        const interval = setInterval(() => {
            // Check if the job still exists and is not marked as 'completed' or 'error'
            if (jobs[jobId] && jobs[jobId].status === 'processing') {
                // Simulate progress update
                progress += Math.floor(Math.random() * 10);
                progress = Math.min(progress, 100);

                // Update job progress
                jobs[jobId].progress = progress;

                // Send a Socket.IO message to the client, updating the job progress
                io.emit('job', { jobId, progress, status: 'processing' });

                // Check if the task is completed
                if (progress === 100) {
                    clearInterval(interval);
                    resolve();
                }
            } else {
                clearInterval(interval);
                reject(new Error('Job canceled or completed.'));
            }
        }, 1000); // Progress update interval (1 second)
    });
}