import { app } from '../index';
import fs from "fs"
import path from "path"

export function getListFile() {
    app.get('/files', (req, res) => {
        const files = fs.readdirSync('files/output_list_nomor');
        res.json(files);
    });
}

export function getListFileSisaData() {
    app.get('/filesSisaData', (req, res) => {
        const files = fs.readdirSync('files/sisa_data');
        res.json(files);   
    });
}

export function downloadFile() {
    app.get('/download/:filename', (req, res) => {
        const { filename } = req.params;
        const filePath = 'files/output_list_nomor/'+filename
        res.download(filePath, (err) => {
            if (err) {
                console.error('File download error:', err);
                res.status(500).send('File download failed.');
            }
        });
    });
}

export function downloadFileSisaData() {
    app.get('/downloadfileSisaData/:filename', (req, res) => {
        const { filename } = req.params;
        const filePath = 'files/sisa_data/'+filename
        res.download(filePath, (err) => {
            if (err) {
                console.error('File download error:', err);
                res.status(500).send('File download failed.');
            }
        });
    });
}

export function deleteFile() {
    app.delete('/delete/:filename', (req, res) => {
        const { filename } = req.params;
        const filePath = 'files/output_list_nomor/'+filename
        fs.unlink(filePath, (err) => {
            if (err) {
                console.error('File deletion error:', err);
                res.status(500).send('File deletion failed.');
            } else {
                console.log('File deleted:', filename);
                res.sendStatus(200);
            }
        });
    });
}

export function deleteFileSisaData() {
    app.delete('/deletefileSisaData/:filename', (req, res) => {
        const { filename } = req.params;
        const filePath = 'files/sisa_data/'+filename
        fs.unlink(filePath, (err) => {
            if (err) {
                console.error('File deletion error:', err);
                res.status(500).send('File deletion failed.');
            } else {
                console.log('File deleted:', filename);
                res.sendStatus(200);
            }
        });
    });
}