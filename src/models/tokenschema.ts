import mongoose from 'mongoose'
const tokenSchema = new mongoose.Schema({
	access_token: { type: String, required: true },
	token_type: { type: String, required: true },
	expires_in: { type: String, required: true },
	issued: { type: String, required: true },
	expires: { type: String, required: true },
});

export const token = mongoose.model('token', tokenSchema);