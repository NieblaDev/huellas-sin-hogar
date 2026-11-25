import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRoutes from './src/routes/index.js';
import { uploadsPath } from './src/middlewares/upload.middleware.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Detrás de Nginx (proxy inverso) para que req.protocol/host sean correctos
// y las URLs de las fotos subidas usen https y el dominio público.
app.set('trust proxy', 1);

// Si se define CORS_ORIGIN, se restringe el acceso a esos orígenes
// (separados por coma). Sin la variable, se mantiene abierto.
const corsOrigin = process.env.CORS_ORIGIN;
app.use(cors(corsOrigin ? { origin: corsOrigin.split(',').map((o) => o.trim()) } : {}));
app.use(express.json({ limit: '10mb' }));

// Fotografías de animales subidas con Multer
app.use('/uploads', express.static(uploadsPath));

app.use('/api', apiRoutes);
app.get('/health', (req, res) => res.json({ status: 'OK', shelter: 'Huellas Sin Hogar' }));

app.listen(PORT, () => console.log('Servidor Huellas Sin Hogar corriendo en puerto', PORT));