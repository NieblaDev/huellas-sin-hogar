import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import apiRoutes from './routes/index.js';
import healthRoutes from './routes/health.routes.js';
import fotoRoutes from './routes/foto.routes.js';
import { errorHandler } from './middlewares/error.middleware.js';

const app = express();

app.set('trust proxy', 1);
const origins = process.env.CORS_ORIGIN?.split(',').map(origin => origin.trim()).filter(Boolean);
app.use(cors(origins?.length ? { origin: origins } : {}));
app.use(express.json({ limit: '10mb' }));

app.use('/api', apiRoutes);
app.use('/health', healthRoutes);
app.use('/uploads', fotoRoutes);
app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));
app.use(errorHandler);

export default app;
