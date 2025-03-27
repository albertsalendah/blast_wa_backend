import express from 'express';
import { container } from '../../core/di/di.container';
import { WhatsAppController } from '../controller/whatsapp.controller';
import { authenticate } from '../middleware/middleware';
import { authorize } from '../middleware/role.middleware';
import { upload } from '../middleware/multer.middleware'

const router = express.Router();
const waController = container.get(WhatsAppController);

router.post('/send-message', upload.fields([
    { name: "excelFile", maxCount: 1 },
    { name: "images", maxCount: 10 }
]), authenticate, authorize(['user']), (req, res) => waController.sendMessage(req, res));
router.get('/get-message-history-group', authenticate, authorize(['user']), (req, res) => waController.getMessageHistoryGroup(req, res));
router.get('/get-message-history', authenticate, authorize(['user']), (req, res) => waController.getMessageHistory(req, res));
router.post('/delete-message-history', authenticate, authorize(['user']), (req, res) => waController.deleteMessageHistory(req, res));

export default router;