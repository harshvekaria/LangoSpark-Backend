import { Router } from 'express';
import { 
    getAllLanguages,
    addUserLanguage,
    getUserLanguages,
    updateLanguageLevel,
    removeUserLanguage,
    getLanguageById
} from '../controllers/language.controllers';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// Public routes
router.get('/list', getAllLanguages as any);

// Protected routes
router.get('/my-languages', authenticateToken, getUserLanguages as any);
router.post('/add', authenticateToken, addUserLanguage as any);
router.put('/level', authenticateToken, updateLanguageLevel as any);
router.delete('/:languageId', authenticateToken, removeUserLanguage as any);

// Put dynamic routes last to avoid conflicts
router.get('/:id', getLanguageById as any);

export default router; 