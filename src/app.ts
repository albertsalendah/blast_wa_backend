import express from 'express';
import authRoutes from './interface/route/auth.routes'
import waRoutes from './interface/route/whatsapp.routes'
import cors from 'cors'
import path from "path";
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/", express.static(path.join(__dirname, "../")));
app.use('/auth', authRoutes);
app.use(waRoutes);

export default app;