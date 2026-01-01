import express, { Request, Response, ErrorRequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import { PrismaClient } from '@prisma/client';

// Import routes
import authRoutes from './routes/auth.routes';
import languageRoutes from './routes/language.routes';
import progressRoutes from './routes/progress.routes';
import aiLessonsRoutes from './routes/ai-lessons.routes';
import leaderboardRoutes from './routes/leaderboard.routes';

// Initialize express app
const app = express();

// Initialize Prisma client
export const prisma = new PrismaClient();

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/languages', languageRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/ai-lessons', aiLessonsRoutes);
app.use('/api/leaderboard', leaderboardRoutes);


function printRoutes(stack: any[], prefix = "") {
  for (const layer of stack) {
    if (layer.route && layer.route.path) {
      const methods = Object.keys(layer.route.methods || {})
        .map(m => m.toUpperCase())
        .join(",");
      console.log(`${methods.padEnd(10)} ${prefix}${layer.route.path}`);
      continue;
    }

    if (layer.name === "router" && layer.handle?.stack) {
      let mountPath = "";
      if (layer.regexp?.source) {
        const match = layer.regexp.source
          .replace("^\\", "")
          .split("\\/?")[0]
          .replace("\\", "")
          .replace("(?=\\/|$)", "")
          .replace(/\$$/, "");
        mountPath = match && match !== "^" ? `/${match}` : "";
      }

      printRoutes(layer.handle.stack, prefix + mountPath);
    }
  }
}

const stack = (app as any)._router?.stack;
console.log("===== REGISTERED ROUTES (FULL) =====");
if (stack) printRoutes(stack, "");
console.log("====================================");


app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
        status: 'success',
        message: 'Server is healthy',
        timestamp: new Date().toISOString()
    });
});

// 404 handler
app.use((_req: Request, res: Response) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

// Error handling middleware
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    console.error(err.stack);

    if (err.name === 'PrismaClientKnownRequestError') {
        res.status(400).json({
            success: false,
            message: 'Database error occurred'
        });
        return;
    }

    if (err.name === 'JsonWebTokenError') {
        res.status(401).json({
            success: false,
            message: 'Invalid token'
        });
        return;
    }

    if (err.name === 'TokenExpiredError') {
        res.status(401).json({
            success: false,
            message: 'Token expired'
        });
        return;
    }

    res.status(500).json({
        success: false,
        message: 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
};

app.use(errorHandler);

process.on('SIGTERM', async () => {
    console.log('SIGTERM received. Closing HTTP server and database connection...');
    await prisma.$disconnect();
    process.exit(0);
});
console.log("✅ app.ts loaded and routes registered");

export default app;
