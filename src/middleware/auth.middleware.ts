import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Extend Express Request type to include user
declare global {
    namespace Express {
        interface Request {
            user?: any;
        }
    }
}

export const authenticateToken = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> => {
    try {
        // Get token from header
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Access token is required'
            });
        }

        // Verify token
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET || 'your-secret-key'
        ) as { userId: string };

        // Get user from database
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: {
                id: true,
                email: true,
                fullName: true,
                createdAt: true,
                updatedAt: true
            }
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }

        // Attach user to request object
        req.user = user;
        next();
    } catch (error) {
        if (error instanceof jwt.JsonWebTokenError) {
            return res.status(403).json({
                success: false,
                message: 'Invalid or expired token'
            });
        }

        console.error('Authentication error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error during authentication'
        });
    }
};
