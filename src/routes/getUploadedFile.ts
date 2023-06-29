import { app } from '../index';
import fs from "fs"
import path from "path"

export function getListUploadedFile() {
    app.get('/uploadedfiles', (req, res) => {
        const files = fs.readdirSync('files/input_list_nomor');
        res.json(files);
    });
}

export function downloadUploadedFile() {
    app.get('/downloaduploadedfile/:filename', (req, res) => {
        const { filename } = req.params;
        const filePath = 'files/input_list_nomor/'+filename
        res.download(filePath, (err) => {
            if (err) {
                console.error('File download error:', err);
                res.status(500).send('File download failed.');
            }
        });
    });
}

export function deleteUploadedFile() {
    app.delete('/deleteuploadedfile/:filename', (req, res) => {
        const { filename } = req.params;
        const filePath = 'files/input_list_nomor/'+filename
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