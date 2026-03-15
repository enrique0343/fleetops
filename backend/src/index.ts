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

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT_EXCEPTION:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED_REJECTION:', reason);
});

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const HOST = '0.0.0.0';

console.log('Booting FleetOps API...');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', PORT);
console.log('CORS_ORIGIN:', process.env.CORS_ORIGIN);
console.log('DATABASE_URL exists:', Boolean(process.env.DATABASE_URL));
console.log('DIRECT_URL exists:', Boolean(process.env.DIRECT_URL));
console.log('JWT_SECRET exists:', Boolean(process.env.JWT_SECRET));

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'combined'));

// Health check
app.get('/health', (_, res) => {
  res.json({
    status: 'ok',
    service: 'FleetOps API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/trips', tripsRoutes);
app.use('/api/catalogs', catalogsRoutes);
app.use('/api/fuel', fuelRoutes);
app.use('/api/audit', auditRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Ruta no encontrada: ${req.method} ${req.path}`,
  });
});

// Error handler
app.use(errorHandler);

// Start server
const server = app.listen(PORT, HOST, () => {
  console.log(`FleetOps API running on http://${HOST}:${PORT}`);
});

server.on('error', (err) => {
  console.error('SERVER_LISTEN_ERROR:', err);
});