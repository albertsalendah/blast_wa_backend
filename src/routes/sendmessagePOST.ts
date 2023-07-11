import 'dotenv/config'
import axios from 'axios';
import { phoneNumberFormatter } from '../utils/formatter'
import { app, isConnected, io } from '../index';
import { UploadedFile } from 'express-fileupload'
import path from 'path'
import fs from "fs"
import { history } from '../models/history_send_schema'
import { v4 as uuidv4 } from 'uuid';
import { listProgdi } from '../models/list_progdi';
import * as ExcelJS from 'exceljs';
import { format } from 'date-fns';

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

        const currentDates = format(new Date(), 'EEE-dd-MMM-yyyy');
        let numberWA: String;
        let listMahasiswa: DynamicInterface[] = [];
        let lMahasiswa: DynamicInterface[] = []
        const listprogdi: progdi[] = listProgdi
        let selectedProgdi: string = ''
        const delayBetweenItems = 5000; // 5 seconds
        const delayEveryTenItems = 30000; // 1 minute
        let count = 0;
        for (let i = 0; i < listprogdi.length; i++) {
            if (req.body.progdi === listProgdi[i].kode_progdi) {
                selectedProgdi = listProgdi[i].nama_progdi
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
            //let filePath = ""
            let kats = ''
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
                    //new Date().getTime()
                    file_ubah_nama[i] = `input_${selectedProgdi}_${currentDates}_${file_daftar_no[i].name}`;
                    await file_daftar_no[i].mv('./files/input_list_nomor/' + file_ubah_nama[i]);
                    await workbook.xlsx.readFile('./files/input_list_nomor/' + file_ubah_nama[i]);
                    kats = file_daftar_no[i].name
                }
                //====================================
                const sheets = workbook.worksheets.map((worksheet) => worksheet.name);
                for (let sheet of sheets) {
                    const worksheet = workbook.getWorksheet(sheet);
                    //const worksheet = workbook.worksheets[0]
                    const columnNames: string[] = [];
                    let lastColumnIndex = 1;
                    const firstRow = worksheet.getRow(1);
                    firstRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                        if (colNumber > lastColumnIndex) {
                            lastColumnIndex = colNumber;
                        }

                        if (cell.value !== null) {
                            columnNames.push(cell.text?.toString() ?? '');
                        }
                    });
                    if (columnNames.length >= 2) {
                        columnNames[1] = 'Nama';
                        columnNames[2] = 'No_Handphone';
                    }
                    for (let i = 2; i <= worksheet.rowCount; i++) {
                        const row = worksheet.getRow(i);
                        const rowData: DynamicInterface = {};
                        let hasValue = false;

                        columnNames.forEach((columnName, columnIndex) => {
                            const cellValue = row.getCell(columnIndex + 1).text?.toString() ?? '';
                            rowData[columnName] = cellValue;
                            // Check if the second (index 1) or third (index 2) column has a value
                            if (columnIndex === 1 || columnIndex === 2) {
                                if (cellValue.trim() !== '') {
                                    hasValue = true;
                                }
                            }
                        });
                        if (hasValue) {
                            rowData.sheetName = sheet;
                            lMahasiswa.push(rowData);
                        }
                    } 
                }
                const datas: DynamicInterface[] = []
                lMahasiswa.forEach((element: DynamicInterface) => {
                    const noHPs: string[] = element['No_Handphone'].split(/[\/,]/).filter(Boolean);
                    const uniqueNoHP = Array.from(new Set(noHPs));
                    uniqueNoHP.forEach((noHP: string) => {
                        const newData: DynamicInterface = { ...element };
                        newData['No_Handphone'] = noHP;
                        datas.push(newData)
                    });
                });
                if (datas.length > 250) {
                    const sliceSize = 250;
                    const numberOfSlices = Math.ceil(datas.length / sliceSize);
                    const outputArrays = [];
                    for (let i = 0; i < numberOfSlices; i++) {
                        const start = i * sliceSize;
                        const end = start + sliceSize;
                        const slice = datas.slice(start, end);
                        outputArrays.push(slice);
                    }
                    for (let i = 0; i < outputArrays.length; i++) {
                        if (i === 0) {
                            listMahasiswa = outputArrays[i];
                        } else {
                            const workbook = new ExcelJS.Workbook();
                            const worksheet = workbook.addWorksheet('Sheet 1');
                            const newcolumnNames = Object.keys(outputArrays[i][0]);
                            worksheet.addRow(newcolumnNames);
                            outputArrays[i].forEach((row) => {
                                const values = newcolumnNames.map((newcolumnNames) => row[newcolumnNames]);
                                worksheet.addRow(values);
                            });
                            const filesisa = path.join("files/extra_data", `extra_data_${i}_${currentDates}_${kats}`);
                            await workbook.xlsx.writeFile(filesisa);
                        }
                        console.log("Jumlah Data List Mahasiswa : " + listMahasiswa.length + ` SISA DATA ${i + 1}: ` + outputArrays[i].length)
                    }
                } else {
                    listMahasiswa = datas
                }
                console.log("lMahasiswa : "+lMahasiswa.length+" listMahasiswa : "+listMahasiswa.length)
            } else {
                io.emit('job', { jobId, progress: 0, status: 'processing', sendto: selectedProgdi, message: "Waiting Data From API" });
                const savedtoken = await getToken();
                let data = JSON.stringify({
                    "tahun": req.body.tahun,
                    "progdi": req.body.progdi
                });

                let config = {
                    method: 'get',
                    maxBodyLength: Infinity,
                    url: process.env.URL_CAMARU || '',
                    headers: {
                        'Authorization': 'bearer ' + savedtoken,
                        'Content-Type': 'application/json'
                    },
                    data: data
                };
                kats = selectedProgdi
                listMahasiswa =
                    await axios.request(config)
                        .then(async (response) => {
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
                            const datas: DynamicInterface[] = []
                            filteredResponse.forEach((item: any) => {
                                item.No_HP = item.No_HP.split(",").filter(Boolean);
                                const uniqueNoHP = Array.from(new Set(item.No_HP));
                                item.No_HP = uniqueNoHP;
                                item.No_HP.forEach(async (no: string) => {
                                    if (no.length > 10) {
                                        const mahasiswa: DynamicInterface = {
                                            No_Pendaftaran: item.No_Pendaftaran,
                                            Nama: item.Nama_Pendaftar,
                                            No_Handphone: no,
                                            Tahun_Akademik: item.Tahun_Akademik,
                                            Status_Registrasi_Ulang: item.Status_Registrasi_Ulang,
                                            Prodi_Registrasi_Ulang: item.Prodi_Registrasi_Ulang
                                        };
                                        datas.push(mahasiswa)
                                    }
                                });
                            });

                            if (datas.length > 250) {
                                const sliceSize = 250;
                                const numberOfSlices = Math.ceil(datas.length / sliceSize);
                                const outputArrays = [];
                                for (let i = 0; i < numberOfSlices; i++) {
                                    const start = i * sliceSize;
                                    const end = start + sliceSize;
                                    const slice = datas.slice(start, end);
                                    outputArrays.push(slice);
                                }
                                for (let i = 0; i < outputArrays.length; i++) {
                                    if (i === 0) {
                                        listMahasiswa = outputArrays[i];
                                    } else {
                                        const workbook = new ExcelJS.Workbook();
                                        const worksheet = workbook.addWorksheet('Sheet 1');
                                        const newcolumnNames = Object.keys(outputArrays[i][0]);
                                        worksheet.addRow(newcolumnNames);
                                        outputArrays[i].forEach((row) => {
                                            const values = newcolumnNames.map((newcolumnNames) => row[newcolumnNames]);
                                            worksheet.addRow(values);
                                        });
                                        const filesisa = path.join("files/extra_data", `extra_data_${i}_${selectedProgdi}_${currentDates}_data_api.xlsx`);
                                        await workbook.xlsx.writeFile(filesisa);
                                    }
                                    console.log("Jumlah Data List Mahasiswa : " + listMahasiswa.length + ` SISA DATA ${i + 1}: ` + outputArrays[i].length)
                                }
                            } else {
                                listMahasiswa = datas
                            }
                            console.log(listMahasiswa.length)
                            return listMahasiswa;
                        })
                        .catch((error) => {
                            console.log(error);
                            io.emit('job', { jobId, progress: 0, status: 'processing', sendto: selectedProgdi, message: "Failed to Aquired Data From API" });
                            return [];
                        });
            }
            io.emit('job', { jobId, progress: 0, status: 'processing', sendto: selectedProgdi, message: "Waiting Data From API" });
            let unRegistercounter = 0;
            let registeredcounter = 0;
            for (let i = 0; i < listMahasiswa.length; i++) {
                const item = listMahasiswa[i];
                const columnKeys = Object.keys(item);
                const columnNama = columnKeys[1];
                const nama = item[columnNama];
                item.Kategori_Pesan = req.body.kategori_pesan + `_${kats}`
                item.Status_Pesan = "Belum Terkirim"
                item.id_pesan = jobId
                item.isi_pesan = pesankirim.replace(/\|/g, nama)
                item.tanggal = currentDate.toDateString()
                await createHistory(item)               
            }
            let progress = 0;
            const latestEntry = await history.findOne({}, {}, { sort: { _id: -1 } });
            if (!req.files?.file_dikirim) {
                if (listMahasiswa.length > 0) {
                    let status_pesan = ''
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
                            const numericRegex = /^[0-9]+$/;
                            if (nohp !== '' && numericRegex.test(nohp)) {
                                numberWA = phoneNumberFormatter(nohp);
                            } else {
                                numberWA = nohp
                            }
                            if (isConnected()) {
                                try {
                                    const [exists] = await sock.onWhatsApp(numberWA);
                                    if (exists?.jid || (exists && exists?.jid)) {
                                        registeredcounter++
                                        await sock.sendMessage(exists.jid || exists.jid, { text: pesankirim.replace(/\|/g, nama) + "\n ID Pesan : " + jobId + "-" + i })
                                            .then(async () => {
                                                //io.emit("log", "Berhasil Mengirim Pesan Ke " + nama);
                                                status_pesan = "Terkirim"
                                            })
                                            .catch(() => {
                                                //console.log('Pasan Tidak Terkirim');
                                                status_pesan = "Gagal Terkirim"
                                            });
                                        //status_pesan = "Terkirim"
                                    } else {
                                        unRegistercounter++;
                                        console.log(`Nomor ${numberWA} tidak terdaftar. `);
                                        status_pesan = "Nomor Tidak Terdaftar WA"
                                    }
                                    await updateHistory(nama,nohp, jobId, status_pesan)
                                } catch (error) {
                                    console.log("ERROR SEND MESSAGE WITHOUT FILE", error)
                                    io.emit('job', { jobId, progress: 0, status: 'error', error: `WhatsApp Socket Closed`, sendto: selectedProgdi, message: `WhatsApp Socket Closed` });
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
                        let c = i;
                        const item = listMahasiswa[i];
                        const columnKeys = Object.keys(item);
                        const columnNama = columnKeys[1];
                        const columnNoHP = columnKeys[2];
                        const nohp = item[columnNoHP];
                        const nama = item[columnNama];
                        setTimeout(async () => {
                            count++;
                            const numericRegex = /^[0-9]+$/;
                            if (nohp !== '' && numericRegex.test(nohp)) {
                                numberWA = phoneNumberFormatter(nohp);
                            } else {
                                numberWA = nohp
                            }
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
                                                        caption: pesankirim.replace(/\|/g, nama) + "\n ID Pesan : " + jobId + "-" + c
                                                    },
                                                    caption: pesankirim.replace(/\|/g, nama) + "\n ID Pesan : " + jobId + "-" + c
                                                }).then(() => {
                                                    console.log('pesan berhasil terkirim');
                                                    statusPesan = "Terkirim"
                                                    //io.emit("log", "Berhasil Mengirim Pesan Ke " + nama);
                                                }).catch(() => {
                                                    console.log('pesan gagal terkirim');
                                                    statusPesan = "Gagal Terkirim"
                                                });
                                            } else if (extensionName[i] === '.mp3' || extensionName[i] === '.ogg') {
                                                registeredcounter++
                                                await sock.sendMessage(exists.jid || exists.jid, {
                                                    audio: {
                                                        url: namafiledikirim[i],
                                                        caption: pesankirim.replace(/\|/g, nama) + "\n ID Pesan : " + jobId + "-" + c
                                                    },
                                                    caption: pesankirim.replace(/\|/g, nama) + "\n ID Pesan : " + jobId + "-" + c,
                                                    mimetype: 'audio/mp4'
                                                }).then(() => {
                                                    console.log('pesan berhasil terkirim');
                                                    //io.emit("log", "Berhasil Mengirim Pesan Ke " + nama);
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
                                                        caption: pesankirim.replace(/\|/g, nama) + "\n ID Pesan : " + jobId + "-" + c
                                                    },
                                                    caption: pesankirim.replace(/\|/g, nama) + "\n ID Pesan : " + jobId + "-" + c,
                                                    mimetype: fileDikirim_Mime[i],
                                                    fileName: filesimpan[i].name
                                                }).then(() => {
                                                    console.log('pesan berhasil terkirim');
                                                    //io.emit("log", "Berhasil Mengirim Pesan Ke " + nama);
                                                    statusPesan = "Terkirim"
                                                }).catch(() => {
                                                    console.log('pesan gagal terkirim');
                                                    statusPesan = "Gagal Terkirim"
                                                });
                                            }
                                        }
                                        //statusPesan = "Terkirim"
                                        //io.emit("log", "Berhasil Mengirim Pesan Ke " + nama);
                                        console.log('Pasan Terkirim Ke : ' + numberWA);
                                    } else {
                                        statusPesan = "Nomor Tidak Terdaftar WA"
                                        console.log(`Nomor ${numberWA} tidak terdaftar.`);
                                    }
                                    await updateHistory(nama,nohp, jobId, statusPesan)
                                } catch (error) {
                                    console.log(`ERROR SENDING MESSAGE FILE`, error);
                                    io.emit('job', { jobId, progress: 0, status: 'error', error: `WhatsApp Socket Closed`, sendto: selectedProgdi, message: `WhatsApp Socket Closed` });
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

const getToken = async () => {
    const apiUrl = process.env.URL_TOKEN || '';
    const bodyParams = {
        username: process.env.TOKEN_USER || '',
        password: process.env.TOKEN_PASS || '',
        grant_type: 'password',
    };

    const response = await axios.post(apiUrl, bodyParams, {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
    });
    return response.data['access_token']
}

export async function checkTotalMahasiswa() {
    app.post('/checkTotalMahasiswa', async (req, res) => {
        try {
            const savedtoken = await getToken();
            let data = JSON.stringify({
                "tahun": req.body.tahun,
                "progdi": req.body.progdi
            });
            let config = {
                method: 'get',
                maxBodyLength: Infinity,
                url: process.env.URL_CAMARU || '',
                headers: {
                    'Authorization': 'bearer ' + savedtoken,
                    'Content-Type': 'application/json'
                },
                data: data
            };
            await axios.request(config)
                .then(async (response) => {
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
                    const datas: DynamicInterface[] = []
                    filteredResponse.forEach((item: any) => {
                        item.No_HP = item.No_HP.split(",").filter(Boolean);
                        const uniqueNoHP = Array.from(new Set(item.No_HP));
                        item.No_HP = uniqueNoHP;
                        item.No_HP.forEach(async (no: string) => {
                            if (no.length > 10) {
                                const mahasiswa: DynamicInterface = {
                                    No_Pendaftaran: item.No_Pendaftaran,
                                    Nama: item.Nama_Pendaftar,
                                    No_Handphone: no,
                                    Tahun_Akademik: item.Tahun_Akademik,
                                    Status_Registrasi_Ulang: item.Status_Registrasi_Ulang,
                                    Prodi_Registrasi_Ulang: item.Prodi_Registrasi_Ulang
                                };
                                datas.push(mahasiswa)
                            }
                        });
                    });
                    console.log("Total Mahasiswa :" + datas.length)
                    res.status(200).json({
                        response: datas.length
                    });
                })
                .catch((error) => {
                    console.log(error);
                    res.status(500).json({
                        response: "Failed To Fetch Data"
                    });
                });
        } catch (error) {
            res.status(500).json({ response: 'Failed to fetch data' });
        }
    });
}

export async function getHistory() {
    app.get('/history', async (req, res) => {
        try {
            const histories = await history.distinct('id_pesan')
            let hist = []
            for (let i = 0; i < histories.length; i++) {
                const result = await history.findOne({ id_pesan: histories[i] })
                hist.push(result)
            }
            res.json(hist);
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch history data' });
        }
    });
}

export async function downloadHistory() {
    app.get('/downloadhistorypesan/:id_pesan', async (req, res) => {
        const id_pesan = req.params.id_pesan;
        try {
            const data: DynamicInterface[] = await history.find({ id_pesan: id_pesan });
            const kat = data[0].Kategori_Pesan
            const tanggal = data[0].tanggal
            const filePath = path.join("files/output_list_nomor", `Output_${kat}_${tanggal}.xlsx`);
            const sheetNames = await history.find({ id_pesan: id_pesan }).distinct('sheetName');
            const workbook = new ExcelJS.Workbook();
            if (sheetNames && sheetNames.length > 0) {
                // Create separate worksheets for each sheetName
                for (let sheetName of sheetNames) {
                    const worksheet = workbook.addWorksheet(sheetName);
                    const filteredData = data.filter((item) => item.sheetName === sheetName);

                    const excludedColumns = ['$__', '$isNew', '_doc', 'sheetName'];
                    const columnNames = Object.keys(filteredData[0]).filter((columnName) => !excludedColumns.includes(columnName));

                    worksheet.addRow(columnNames);
                    filteredData.forEach((row: DynamicInterface) => {
                        const values = columnNames.map((columnName) => row[columnName]);
                        worksheet.addRow(values);
                    });
                }
            } else {
                // Create a single worksheet if no sheetNames are available
                const worksheet = workbook.addWorksheet('Sheet 1');
                const excludedColumns = ['$__', '$isNew', '_doc'];
                const columnNames = Object.keys(data[0]).filter((columnName) => !excludedColumns.includes(columnName));

                worksheet.addRow(columnNames);
                data.forEach((row: DynamicInterface) => {
                    const values = columnNames.map((columnName) => row[columnName]);
                    worksheet.addRow(values);
                });
            }
            await workbook.xlsx.writeFile(filePath).then(() => {
                res.download('files/output_list_nomor/' + `Output_${kat}_${tanggal}.xlsx`, (err) => {
                    if (err) {
                        console.error('File download error:', err);
                        res.status(500).send('File download failed.');
                    }
                });
            });
        } catch (error) {
            res.status(500).json({ message: 'Internal server error' });
        }
    });
}

export async function getListPesan() {
    app.get('/getlistpesan/:id_pesan', async (req, res) => {
        const id_pesan = req.params.id_pesan;
        try {
            const data = await history.find({ id_pesan: id_pesan });
            res.json(data);
        } catch (error) {
            res.status(500).json({ message: 'Internal server error' });
        }
    });
}


export async function deleteHistoryPesan() {
    app.post('/deletelistpesan/:id_pesan', async (req, res) => {
        const id_pesan = req.params.id_pesan;
        try {
            const data: DynamicInterface[] = await history.find({ id_pesan: id_pesan });
            const kat = data[0].Kategori_Pesan
            const tanggal = data[0].tanggal
            const filename = `Output_${kat}_${tanggal}.xlsx`
            const filePath = 'files/output_list_nomor/' + filename
            await history.deleteMany({ id_pesan: id_pesan }).then(() => {
                fs.unlink(filePath, async (err) => {
                    if (err) {
                        console.error('Data History Berhasil Dihapus Dan File deletion error: File Tidak di Temukan');
                        res.json('Data History Berhasil Dihapus');
                    } else {
                        console.log('File deleted:', filename);
                        res.json('Data History Berhasil Dihapus');
                    }
                });
            }).catch(() => {
                res.status(500).json({ message: 'Terjadi Kesalahan Saat Menghapus Data History' });
            })
        } catch (error) {
            res.status(500).json({ message: 'Internal server error' });
        }
    });
}

async function createHistory(item: DynamicInterface) {
    try {
        await history.create(item);
        //console.log('History Pesan Berhasil Ditambahkan')
    } catch (error) {
        console.log(`Terjadi Kesalahan Saat Menyimpan History Pesan`)
    }
}

async function updateHistory(nama: String, no_hp: String, id_pesan: String, status_pesan: String) {
    try {
        let id = ''
        let result
        const listHistori = await history.find({ id_pesan: id_pesan, No_Handphone: no_hp, });
        listHistori.forEach(async (item) => {
            id = item.id
            const filter = { _id: id, Nama: nama, No_Handphone: no_hp, id_pesan: id_pesan };
            const update = { $set: { Status_Pesan: status_pesan } };
            result = await history.updateOne(filter, update)
        })
        console.log(`Pesan ${status_pesan} Ke ${no_hp}`);
    } catch (error) {
        console.log(`Terjadi Kesalahan Saat Update Status Pesan`)
    }
}