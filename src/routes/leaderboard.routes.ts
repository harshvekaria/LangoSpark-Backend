import { Router } from 'express';
import { 
    addLeaderboardEntry,
    getGlobalLeaderboard,
    getQuizLeaderboard,
    getLanguageLeaderboard,
    getUserLeaderboardStats
} from '../controllers/leaderboard.controllers';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// Public endpoints
router.get('/global', getGlobalLeaderboard);
router.get('/quiz/:quizId', getQuizLeaderboard);
router.get('/language/:languageId', getLanguageLeaderboard);

// Protected endpoints
router.post('/entry', authenticateToken, addLeaderboardEntry as any);
router.get('/user-stats', authenticateToken, getUserLeaderboardStats as any);

export default router; 