import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';

import authRoutes from './routes/auth';
import tripsRoutes from './routes/trips';
import catalogsRoutes from './routes/catalogs';
import fuelRoutes from './routes/fuel';
import auditRoutes from './routes/audit';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const HOST = '0.0.0.0';

// ─── Middleware ───
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'combined'));

// ─── Health Check ───
app.get('/health', (_, res) => {
  res.json({
    status: 'ok',
    service: 'FleetOps API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ─── Routes ───
app.use('/api/auth', authRoutes);
app.use('/api/trips', tripsRoutes);
app.use('/api/catalogs', catalogsRoutes);
app.use('/api/fuel', fuelRoutes);
app.use('/api/audit', auditRoutes);

// ─── 404 ───
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Ruta no encontrada: ${req.method} ${req.path}`,
  });
});

// ─── Error Handler ───
app.use(errorHandler);

// ─── Start ───
app.listen(PORT, HOST, () => {
  console.log(`FleetOps API running on http://${HOST}:${PORT}`);
});