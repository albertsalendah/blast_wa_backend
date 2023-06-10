import mongoose from 'mongoose'
const messageSchema = new mongoose.Schema({
	message: { type: String, required: true },
	tahun: { type: String, required: true },
	progdi: { type: String, required: true },
	tanggal_kirim: { type: String, required: true },
	nama_file: { type: [String], required: false },
});

export const scheduleModel = mongoose.model('schedule_message', messageSchema);