import mongoose from 'mongoose'
const historySchema = new mongoose.Schema({
	tanggal: { type: String, required: true },
    no_pendaftaran: { type: String,},
    nama: { type: String,},
    tahun_ajaran: { type: String, required: true },
    progdi: { type: String, required: true },
    pesan: { type: String, required: true },
    status_registrasi: { type: String, required: true },
});

export const history = mongoose.model('history_send', historySchema);