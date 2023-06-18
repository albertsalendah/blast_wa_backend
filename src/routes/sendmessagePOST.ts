import 'dotenv/config'
import axios from 'axios';
import { phoneNumberFormatter } from '../utils/formatter'
import { app, isConnected, io } from '../index';
import { token } from '../models/tokenschema'
import { UploadedFile } from 'express-fileupload'
import path from 'path'
import fs from "fs"
import { applicants } from '../testNO';
import { history } from '../models/history_send_schema'
import { v4 as uuidv4 } from 'uuid';
import { listProgdi } from '../models/list_progdi';
import * as ExcelJS from 'exceljs';

//let isLoopRunning = false;
interface Mahasiswa {
    No_Pendaftaran: string;
    Nama_Pendaftar: string;
    No_HP: String;
    Tahun_Akademik: string;
    Status_Registrasi_Ulang: String;
    Prodi_Registrasi_Ulang: String;
}

interface progdi {
    nama_progdi: string,
    kode_progdi: string,
}

// In-memory job/task store
interface Job {
    progress: number;
    status: string;
    sendto: string;
    message: string;
}

interface DynamicInterface {
    [key: string]: string;
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
            url: process.env.URL_CAMARU || '',
            headers: {
                'Authorization': 'bearer ' + savedtoken[0].access_token,
                'Content-Type': 'application/json'
            },
            data: data
        };
        let numberWA: String;
        let s: string[]
        let listMahasiswa: DynamicInterface[] = [];
        const listprogdi: progdi[] = listProgdi
        let selectedProgdi: string = ''
        const delayBetweenItems = 5000; // 5 seconds
        const delayEveryTenItems = 30000; // 1 minute
        let count = 0;
        for (let i = 0; i < listprogdi.length; i++) {
            if (req.body.progdi === listProgdi[i].kode_progdi) {
                selectedProgdi = listProgdi[i].nama_progdi
            } else {
                selectedProgdi = req.body.progdi
            }
        }

        // Generate a unique job identifier
        const jobId = uuidv4();
        // Store the initial job details (e.g., progress: 0, status: 'processing')
        jobs[jobId] = { progress: 0, status: 'processing', sendto: selectedProgdi, message: " " };
        // Send a Socket.IO message to the client, informing it about the new job
        io.emit('job', { jobId, progress: 0, status: 'processing', sendto: selectedProgdi, message: " " });

        try {

            const currentDate = new Date();
            let filePath = ""
            if (req.files?.daftar_no) {
                let file_daftar_no: UploadedFile[] = [];
                const file_dikirim = req.files?.daftar_no;
                const workbook = new ExcelJS.Workbook();

                let file_ubah_nama: String[] = [];
                if (file_dikirim instanceof Array) {
                    file_daftar_no = file_dikirim;
                } else if (file_dikirim) {
                    file_daftar_no = [file_dikirim];
                }
                for (let i = 0; i < file_daftar_no.length; i++) {
                    file_ubah_nama[i] = `input_${new Date().getTime()}_${selectedProgdi}_${file_daftar_no[i].name}`;
                    await file_daftar_no[i].mv('./files/input_list_nomor/' + file_ubah_nama[i]);
                    await workbook.xlsx.readFile('./files/input_list_nomor/' + file_ubah_nama[i]);
                    filePath = path.join("files/output_list_nomor", `output_${new Date().getTime()}_${selectedProgdi}_${file_daftar_no[i].name}`);
                }

                const worksheet = workbook.worksheets[0];
                const data: any = [];
                const columnNames: string[] = [];
                let lastColumnIndex = 1;
                const firstRow = worksheet.getRow(1);
                firstRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                    if (colNumber > lastColumnIndex) {
                        lastColumnIndex = colNumber;
                    }

                    if (cell.value !== null) {
                        columnNames.push(cell.value?.toString() ?? '');
                    }
                });
                for (let i = 2; i <= worksheet.rowCount; i++) {
                    const row = worksheet.getRow(i);
                    const rowData: DynamicInterface = {};

                    columnNames.forEach((columnName, columnIndex) => {
                        rowData[columnName] = row.getCell(columnIndex + 1).value?.toString() ?? '';
                    });

                    listMahasiswa.push(rowData);
                }
                //console.log(listMahasiswa)
            } else {
                filePath = path.join("files/output_list_nomor", `output_${new Date().getTime()}_data_api_${selectedProgdi}.xlsx`);
                listMahasiswa =
                    await axios.request(config)
                        .then((response) => {
                            let uniqueResponse = []
                            if (req.body.status_regis === "All") {
                                uniqueResponse = response.data.response.flat(2)
                            } else {
                                uniqueResponse = response.data.response.flat(2)
                                    .filter((item: { Status_Registrasi_Ulang: string; }) => item.Status_Registrasi_Ulang.includes(req.body.status_regis));
                            }
                            const filteredResponse = uniqueResponse.reduce((accumulator: any[], item: any) => {
                                const isDuplicate = accumulator.some((accItem) => accItem.Status_Registrasi_Ulang === item.Status_Registrasi_Ulang && accItem.No_Pendaftaran === item.No_Pendaftaran);
                                if (!isDuplicate) {
                                    accumulator.push(item);
                                }
                                return accumulator;
                            }, []);
                            filteredResponse.forEach((item: any) => {
                                item.No_HP = item.No_HP.split(",").filter(Boolean);
                                const uniqueNoHP = Array.from(new Set(item.No_HP));
                                item.No_HP = uniqueNoHP;
                                item.No_HP.forEach(async (no: string) => {
                                    if (no.length > 10) {
                                        const mahasiswa: DynamicInterface = {
                                            No_Pendaftaran: item.No_Pendaftaran,
                                            Nama_Pendaftar: item.Nama_Pendaftar,
                                            No_HP: no,
                                            Tahun_Akademik: item.Tahun_Akademik,
                                            Status_Registrasi_Ulang: item.Status_Registrasi_Ulang,
                                            Prodi_Registrasi_Ulang: item.Prodi_Registrasi_Ulang
                                        };
                                        listMahasiswa.push(mahasiswa)
                                    }
                                });
                            });
                            return listMahasiswa;
                            // res.status(200).json({             
                            //     response: listMahasiswa
                            // });
                            console.log(listMahasiswa.length)
                            // isLoopRunning = false;
                        })
                        .catch((error) => {
                            console.log(error);
                            io.emit('job', { jobId, progress: 0, status: 'processing', sendto: selectedProgdi, message: "Failed to Aquired Data From API" });
                            return [];
                            // res.status(200).json({             
                            //     response: listMahasiswa
                            // });
                            //isLoopRunning = false;
                        });
            }
            io.emit('job', { jobId, progress: 0, status: 'processing', sendto: selectedProgdi, message: "Waiting Data From API" });
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Sheet 1');
            const newcolumnNames = Object.keys(listMahasiswa[0]);
            worksheet.addRow(newcolumnNames);
            listMahasiswa.forEach((row) => {
                const values = newcolumnNames.map((newcolumnNames) => row[newcolumnNames]);
                worksheet.addRow(values);
            });
            worksheet.getColumn(newcolumnNames.length + 1).header = "Kategori Pesan";
            worksheet.getColumn(newcolumnNames.length + 2).header = "Status Pesan";
            //worksheet.getColumn(newcolumnNames.length + 1).values = additionalColumnValues;
            //listMahasiswa = applicants           

            let unRegistercounter = 0;
            let registeredcounter = 0;
            let progress = 0;
            const latestEntry = await history.findOne({}, {}, { sort: { _id: -1 } });
            if (!req.files?.file_dikirim) {

                if (listMahasiswa.length > 0) {
                    io.emit('job', { jobId, progress: 0, status: 'processing', sendto: selectedProgdi, message: "Data Found!!! " + listMahasiswa.length + " Phone Number" });
                    for (let i = 0; i < listMahasiswa.length; i++) {
                        const item = listMahasiswa[i];
                        const columnKeys = Object.keys(item);
                        const columnNama = columnKeys[1];
                        const columnNoHP = columnKeys[2];
                        const nohp = item[columnNoHP];
                        const nama = item[columnNama];
                        setTimeout(async () => {
                            count++;
                            numberWA = phoneNumberFormatter(nohp);
                            if (isConnected()) {
                                try {
                                    const [exists] = await sock.onWhatsApp(numberWA);
                                    if (exists?.jid || (exists && exists?.jid)) {
                                        registeredcounter++
                                        await sock.sendMessage(exists.jid || exists.jid, { text: pesankirim.replace(/\|/g, nama)+"\n ID Pesan : "+jobId })
                                            .then(async () => {
                                                console.log('Pasan Terkirim Ke : ' + numberWA);
                                                io.emit("log", "Berhasil Mengirim Pesan Ke " + nama);
                                                worksheet.getCell(i + 2, newcolumnNames.length + 1).value = req.body.kategori_pesan
                                                worksheet.getCell(i + 2, newcolumnNames.length + 2).value = "Terkirim"
                                            })
                                            .catch(() => {
                                                console.log('Pasan Tidak Terkirim');
                                                worksheet.getCell(i + 2, newcolumnNames.length + 1).value = req.body.kategori_pesan
                                                worksheet.getCell(i + 2, newcolumnNames.length + 2).value = "Terkirim"
                                            });
                                        // worksheet.getCell(i + 2, newcolumnNames.length + 1).value = req.body.kategori_pesan
                                        // worksheet.getCell(i + 2, newcolumnNames.length + 2).value = "Terkirim"
                                        io.emit("log", "Berhasil Mengirim Pesan Ke " + nama);
                                        //await createHistory(item, pesankirim)
                                        //console.log('Pasan Terkirim Ke : ' + numberWA);
                                    } else {
                                        unRegistercounter++;
                                        console.log(`Nomor ${numberWA} tidak terdaftar. `);
                                        worksheet.getCell(i + 2, newcolumnNames.length + 1).value = req.body.kategori_pesan
                                        worksheet.getCell(i + 2, newcolumnNames.length + 2).value = "Nomor Tidak Terdaftar WA"
                                    }
                                } catch (error) {
                                    console.log("ERROR SEND MESSAGE WITHOUT FILE", error)
                                    io.emit("log", "ERROR SENDING WITHOUT MESSAGE FILE");
                                }

                                if (jobs[jobId] && jobs[jobId].status === 'processing') {
                                    progress = Math.floor((count / listMahasiswa.length) * 100);
                                    // Update job progress
                                    jobs[jobId].progress = progress;

                                    // Send a Socket.IO message to the client, updating the job progress
                                    io.emit('job', { jobId, progress, status: 'processing', sendto: selectedProgdi, message: "Mengirim Pesan Ke : " + nama });
                                }

                            } else {
                                jobs[jobId].status = 'error';
                                io.emit('job', { jobId, progress: 0, status: 'error', error: `WhatsApp belum terhubung.`, sendto: selectedProgdi, message: `WhatsApp belum terhubung.` });
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
                                io.emit('job', { jobId, progress: 100, status: 'completed', sendto: selectedProgdi, message: " " });
                                console.log('Pesan Tanpa File Telah Terkirim Semua ');

                                await workbook.xlsx.writeFile(filePath);
                            }
                        }, i * delayBetweenItems + Math.floor(i / 50) * delayEveryTenItems);
                    }
                    console.log("Total No : " + listMahasiswa.length)
                } else {
                    jobs[jobId].status = 'error';
                    io.emit('job', { jobId, progress: 0, status: 'error', error: `Tidak Ada Nomor Yang Ditemukan`, sendto: selectedProgdi, message: `Tidak Ada Nomor Yang Ditemukan` });
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
                    filesimpan[i].mv('./files/uploads/' + file_ubah_nama[i]);
                    fileDikirim_Mime[i] = filesimpan[i].mimetype;
                }

                if (listMahasiswa.length != 0) {
                    io.emit('job', { jobId, progress: 0, status: 'processing', sendto: selectedProgdi, message: "Data Found!!! " + listMahasiswa.length + " Phone Number" });
                    for (let i = 0; i < listMahasiswa.length; i++) {
                        const item = listMahasiswa[i];
                        const columnKeys = Object.keys(item);
                        const columnNama = columnKeys[1];
                        const columnNoHP = columnKeys[2];
                        const nohp = item[columnNoHP];
                        const nama = item[columnNama];
                        setTimeout(async () => {
                            count++;
                            numberWA = phoneNumberFormatter(nohp);
                            let namafiledikirim: string[] = []
                            let extensionName: String[] = []
                            if (isConnected()) {
                                try {
                                    let statusPesan = ''
                                    const [exists] = await sock.onWhatsApp(numberWA);
                                    if (exists?.jid || (exists && exists?.jid)) {
                                        for (let i = 0; i < file_ubah_nama.length; i++) {
                                            namafiledikirim[i] = './files/uploads/' + file_ubah_nama[i];
                                            extensionName[i] = path.extname(namafiledikirim[i]);
                                            if (extensionName[i] === '.jpeg' || extensionName[i] === '.jpg' || extensionName[i] === '.png' || extensionName[i] === '.gif') {
                                                registeredcounter++
                                                await sock.sendMessage(exists.jid || exists.jid, {
                                                    image: {
                                                        url: namafiledikirim[i],
                                                        caption: pesankirim.replace(/\|/g, nama)+"\n ID Pesan : "+jobId
                                                    },
                                                    caption: pesankirim.replace(/\|/g, nama)+"\n ID Pesan : "+jobId
                                                }).then(() => {
                                                    console.log('pesan berhasil terkirim');
                                                    statusPesan = "Terkirim"
                                                    io.emit("log", "Berhasil Mengirim Pesan Ke " + nama);
                                                }).catch(() => {
                                                    console.log('pesan gagal terkirim');
                                                    statusPesan = "Gagal Terkirim"
                                                });

                                                console.log('Pasan Terkirim Ke : ' + numberWA);
                                            } else if (extensionName[i] === '.mp3' || extensionName[i] === '.ogg') {
                                                registeredcounter++
                                                await sock.sendMessage(exists.jid || exists.jid, {
                                                    audio: {
                                                        url: namafiledikirim[i],
                                                        caption: pesankirim.replace(/\|/g, nama)+"\n ID Pesan : "+jobId
                                                    },
                                                    caption: pesankirim.replace(/\|/g, nama)+"\n ID Pesan : "+jobId,
                                                    mimetype: 'audio/mp4'
                                                }).then(() => {
                                                    console.log('pesan berhasil terkirim');
                                                    io.emit("log", "Berhasil Mengirim Pesan Ke " + nama);
                                                    statusPesan = "Terkirim"
                                                }).catch(() => {
                                                    console.log('pesan gagal terkirim');
                                                    statusPesan = "Gagal Terkirim"
                                                });
                                            } else {
                                                registeredcounter++
                                                await sock.sendMessage(exists.jid || exists.jid, {
                                                    document: {
                                                        url: namafiledikirim[i],
                                                        caption: pesankirim.replace(/\|/g, nama)+"\n ID Pesan : "+jobId
                                                    },
                                                    caption: pesankirim.replace(/\|/g, nama)+"\n ID Pesan : "+jobId,
                                                    mimetype: fileDikirim_Mime[i],
                                                    fileName: filesimpan[i].name
                                                }).then(() => {
                                                    console.log('pesan berhasil terkirim');
                                                    io.emit("log", "Berhasil Mengirim Pesan Ke " + nama);
                                                    statusPesan = "Terkirim"
                                                }).catch(() => {
                                                    console.log('pesan gagal terkirim');                                                   
                                                    statusPesan = "Gagal Terkirim"
                                                });
                                                console.log('Pasan Terkirim Ke : ' + numberWA);
                                            }
                                        }
                                        //io.emit("log", "Berhasil Mengirim Pesan Ke " + nama);
                                        //await createHistory(item, pesankirim)
                                        worksheet.getCell(i + 2, newcolumnNames.length + 1).value = req.body.kategori_pesan
                                        worksheet.getCell(i + 2, newcolumnNames.length + 2).value = statusPesan
                                    } else {
                                        console.log(`Nomor ${numberWA} tidak terdaftar.`);
                                        worksheet.getCell(i + 2, newcolumnNames.length + 1).value = req.body.kategori_pesan
                                        worksheet.getCell(i + 2, newcolumnNames.length + 2).value = "Nomor Tidak Terdaftar"
                                    }
                                } catch (error) {
                                    console.log(`ERROR SENDING MESSAGE FILE`, error);
                                    io.emit("log", "ERROR SENDING MESSAGE FILE");
                                }
                                if (jobs[jobId] && jobs[jobId].status === 'processing') {
                                    progress = Math.floor((count / listMahasiswa.length) * 100);
                                    // Update job progress
                                    jobs[jobId].progress = progress;

                                    // Send a Socket.IO message to the client, updating the job progress
                                    io.emit('job', { jobId, progress, status: 'processing', sendto: selectedProgdi, message: "Mengirim Pesan Ke : " + nama});
                                }
                            } else {
                                jobs[jobId].status = 'error';
                                io.emit('job', { jobId, progress: 0, status: 'error', error: `WhatsApp belum terhubung.`, sendto: selectedProgdi, message: `WhatsApp belum terhubung.` });
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
                                    namafiledikirim[i] = './files/uploads/' + file_ubah_nama[i];
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
                                io.emit('job', { jobId, progress: 100, status: 'completed', sendto: selectedProgdi, message: " " });
                                console.log('Pesan Dengan File Telah Terkirim Semua');
                                await workbook.xlsx.writeFile(filePath);
                            }
                        }, i * delayBetweenItems + Math.floor(i / 50) * delayEveryTenItems);
                    }
                    console.log("Total No : " + listMahasiswa.length)
                } else {
                    jobs[jobId].status = 'error';
                    io.emit('job', { jobId, progress: 0, status: 'error', error: `Tidak Ada Nomor Yang Ditemukan`, sendto: selectedProgdi, message: "Tidak Ada Nomor Yang Ditemukan" });
                    console.log(`Tidak Ada Nomor Yang Ditemukan`)
                }
            }
        } catch (err) {
            jobs[jobId].status = 'error';
            io.emit('job', { jobId, progress: 0, status: 'error', error: err, sendto: selectedProgdi, messasge: 'error' });
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
        pesan: pesankirim.replace(/\|/g, item.Nama_Pendaftar),
        status_registrasi: item.Status_Registrasi_Ulang
    }

    try {
        await history.create(newHistory);
        console.log('History Pesan Berhasil Ditambahkan')
    } catch (error) {
        console.log(`Terjadi Kesalahan Saat Menyimpan History Pesan`)
    }
}
