import { Router } from 'express';
import { 
    generateLesson,
    generateQuiz,
    generateConversationPrompt,
    getPronunciationFeedback,
    getLessonContent,
    getConversationResponse
} from '../controllers/ai-lessons.controllers';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

/**
 * AI-Powered Lesson Routes
 * Base path: /api/ai-lessons
 */

// All routes are protected
router.post('/generate-lesson', authenticateToken, generateLesson as any);
router.post('/generate-quiz', authenticateToken, generateQuiz as any);
router.get('/lesson/:lessonId', authenticateToken, getLessonContent as any);
router.post('/conversation-prompt', authenticateToken, generateConversationPrompt as any);
router.post('/conversation-response', authenticateToken, getConversationResponse as any);
router.post('/pronunciation-feedback', authenticateToken, getPronunciationFeedback as any);

export default router; 