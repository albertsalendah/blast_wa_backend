import mongoose from 'mongoose';
import { app } from '../index';
const messageSchema = new mongoose.Schema({
    kategori_pesan: String,
    isi_pesan: String,
});

// Create a Mongoose model based on the schema
const Message = mongoose.model('templates_pesan', messageSchema);

export function getTemplatePesan() {
    app.get('/daftar_template', async (req, res) => {
        try {
            const messages = await Message.find();
            res.status(200).json(messages);
        } catch (error) {
            console.error('Error fetching messages from MongoDB:', error);
            res.status(500).json({ error: 'Failed to fetch messages from MongoDB' });
        }
    });
}

export function addTemplatePesan() {
    app.post('/tambah_template_pesan', async (req, res) => {
        try {
            const { kategori_pesan, isi_pesan } = req.body;

            // Create a new message using the Message model
            const newMessage = new Message({ kategori_pesan, isi_pesan });

            // Save the message to MongoDB
            await newMessage.save();

            // Respond with a success message
            res.status(200).json({ message: 'Data added to MongoDB' });
        } catch (error) {
            // Handle any errors
            console.error('Error adding data to MongoDB:', error);
            res.status(500).json({ error: 'Failed to add data to MongoDB' });
        }
    });
}

export function deleteTemplatePesan() {
    app.delete('/delete_template_pesan/:id', async (req, res) => {
        try {
            const messageId = req.params.id;

            // Delete the message from MongoDB based on the provided ID
            await Message.findByIdAndRemove(messageId);

            // Respond with a success message
            res.status(200).json({ message: 'Data deleted from MongoDB' });
        } catch (error) {
            console.error('Error deleting data from MongoDB:', error);
            res.status(500).json({ error: 'Failed to delete data from MongoDB' });
        }
    });
}

export function editTemplatePesan() {
    app.put('/edit_template_pesan/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const { kategori_pesan, isi_pesan } = req.body;

            // Find the document by ID and update its fields
            const updatedData = await Message.findByIdAndUpdate(
                id,
                { kategori_pesan, isi_pesan },
                { new: true }
            );

            if (!updatedData) {
                return res.status(404).json({ message: 'Data not found' });
            }

            return res.json(updatedData);
        } catch (error) {
            console.error('Error updating data:', error);
            return res.status(500).json({ message: 'Internal server error' });
        }
    });
}