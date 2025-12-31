import { Router } from 'express';
import { 
    signup, 
    login, 
    getProfile, 
    updateProfile, 
    changePassword 
} from '../controllers/auth.controllers';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

/**
 * Authentication Routes
 * Base path: /api/auth
 */

// Public Authentication Routes
router.post('/register', signup);           // Register new user
router.post('/login', login);               // Login user
router.post('/logout', authenticateToken, (_req, res) => {
    // Since we're using JWT, we don't need server-side logout
    // Client should remove the token
    res.json({
        success: true,
        message: 'Logged out successfully'
    });
});

// User Profile Routes (Protected)
router.get('/me', authenticateToken, getProfile);                    // Get current user profile
router.put('/me', authenticateToken, updateProfile);                // Update user profile
router.put('/me/password', authenticateToken, changePassword);      // Change password

// Password Management Routes (Protected)
router.post('/forgot-password', (_req, res) => {
    // TODO: Implement forgot password functionality
    res.status(501).json({
        success: false,
        message: 'Forgot password functionality not implemented yet'
    });
});

router.post('/reset-password', (_req, res) => {
    // TODO: Implement reset password functionality
    res.status(501).json({
        success: false,
        message: 'Reset password functionality not implemented yet'
    });
});

// Email Verification Routes (Protected)
router.post('/verify-email', (_req, res) => {
    // TODO: Implement email verification functionality
    res.status(501).json({
        success: false,
        message: 'Email verification functionality not implemented yet'
    });
});

router.post('/resend-verification', authenticateToken, (_req, res) => {
    // TODO: Implement resend verification email functionality
    res.status(501).json({
        success: false,
        message: 'Resend verification email functionality not implemented yet'
    });
});

export default router;
