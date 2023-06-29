import { app } from '../index';
import fs from "fs"
import path from "path"

export function getListFileSisaData() {
    app.get('/filesSisaData', (req, res) => {
        const files = fs.readdirSync('files/extra_data');
        res.json(files);   
    });
}

export function downloadFileSisaData() {
    app.get('/downloadfileSisaData/:filename', (req, res) => {
        const { filename } = req.params;
        const filePath = 'files/extra_data/'+filename
        res.download(filePath, (err) => {
            if (err) {
                console.error('File download error:', err);
                res.status(500).send('File download failed.');
            }
        });
    });
}

export function deleteFileSisaData() {
    app.delete('/deletefileSisaData/:filename', (req, res) => {
        const { filename } = req.params;
        const filePath = 'files/extra_data/'+filename
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