import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRoutes from './src/routes/index.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use('/api', apiRoutes);
app.get('/health', (req, res) => res.json({ status: 'OK', shelter: 'Huellas Sin Hogar' }));

app.listen(PORT, () => console.log('Servidor Huellas Sin Hogar corriendo en puerto', PORT));