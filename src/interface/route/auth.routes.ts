import express from 'express';
import { container } from '../../core/di/di.container';
import { AuthController } from '../controller/user.controller';
import { authenticate } from '../middleware/middleware';
import { authorize } from '../middleware/role.middleware';

const router = express.Router();
const authController = container.get(AuthController);

router.post('/register', (req, res) => authController.register(req, res));
router.post('/login', (req, res) => authController.login(req, res));
router.get('/get-new-access-token', (req, res) => authController.refreshAccessToken(req, res));
//
router.post('/add-phone-number', authenticate, authorize(['user']), (req, res) => authController.addPhone(req, res));
router.get('/get-phone-number', authenticate, authorize(['user']), (req, res) => authController.getPhone(req, res));
router.get('/get-user', authenticate, authorize(['user']), (req, res) => authController.getUser(req, res));


router.get('/admin', authenticate, authorize(['admin']), (req, res) => {
    res.send("Admin route working!");
});

export default router;