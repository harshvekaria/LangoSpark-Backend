import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Signup Controller
export const signup = async (req: Request, res: Response): Promise<any> => {
    try {
        const { email, fullName, password } = req.body;

        if (!email || !fullName || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide all required fields'
            });
        }

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { email }
        });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User with this email already exists'
            });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create new user
        const user = await prisma.user.create({
            data: {
                email,
                fullName,
                password: hashedPassword
            }
        });

        const token = jwt.sign(
            { userId: user.id },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );

        const { password: _, ...userWithoutPassword } = user;

        return res.status(201).json({
            success: true,
            message: 'User registered successfully',
            data: {
                user: userWithoutPassword,
                token
            }
        });

    } catch (error) {
        console.error('Signup error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error during signup'
        });
    }
};

// Login Controller
export const login = async (req: Request, res: Response): Promise<any> => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email and password'
            });
        }

        const user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            { userId: user.id },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );

        // Remove password from response
        const { password: _, ...userWithoutPassword } = user;

        return res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
                user: userWithoutPassword,
                token
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error during login'
        });
    }
};

// Get Profile Controller
export const getProfile = async (req: Request, res: Response): Promise<any> => {
    try {
        return res.json({
            success: true,
            data: {
                user: req.user
            }
        });
    } catch (error) {
        console.error('Get profile error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching profile'
        });
    }
};

// Update Profile Controller
export const updateProfile = async (req: Request, res: Response): Promise<any> => {
    try {
        const { fullName } = req.body;
        const userId = req.user.id;

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: { fullName },
            select: {
                id: true,
                email: true,
                fullName: true,
                createdAt: true,
                updatedAt: true
            }
        });

        return res.json({
            success: true,
            message: 'Profile updated successfully',
            data: {
                user: updatedUser
            }
        });
    } catch (error) {
        console.error('Profile update error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error updating profile'
        });
    }
};

// Change Password Controller
export const changePassword = async (req: Request, res: Response): Promise<any> => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.id;

        // Get user with password
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Verify current password
        const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // Update password
        await prisma.user.update({
            where: { id: userId },
            data: { password: hashedPassword }
        });

        return res.json({
            success: true,
            message: 'Password changed successfully'
        });
    } catch (error) {
        console.error('Password change error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error changing password'
        });
    }
};
