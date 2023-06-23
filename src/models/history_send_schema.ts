import mongoose, { Document, Schema, model } from 'mongoose'
const historySchema = new mongoose.Schema({}, { strict: false });

export const history = mongoose.model('history_pesan', historySchema);
