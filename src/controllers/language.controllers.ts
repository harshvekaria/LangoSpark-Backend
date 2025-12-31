import { Request, Response } from 'express';
import { PrismaClient, Level } from '@prisma/client';

const prisma = new PrismaClient();

interface TypedRequestBody<T> extends Request {
    body: T;
    user: {
        id: string;
    };
}

interface AddLanguageBody {
    name: string;
    code: string;
    level?: Level;
}

interface UpdateLevelBody {
    languageId: string;
    level: Level;
}

// Get all available languages
export const getAllLanguages = async (_req: Request, res: Response): Promise<void> => {
    try {
        const languages = await prisma.language.findMany();
        res.json({
            success: true,
            data: languages
        });
    } catch (error) {
        console.error('Error fetching languages:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching languages'
        });
    }
};

// Get language by ID
export const getLanguageById = async (req: Request & { params: { id: string } }, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        
        const language = await prisma.language.findUnique({
            where: { id }
        });

        if (!language) {
            res.status(404).json({
                success: false,
                message: 'Language not found'
            });
            return;
        }

        res.json({
            success: true,
            data: language
        });
    } catch (error) {
        console.error('Error fetching language:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching language'
        });
    }
};

// Add a language to user's learning list
export const addUserLanguage = async (
    req: TypedRequestBody<AddLanguageBody>,
    res: Response
): Promise<void> => {
    try {
        const { name, code, level } = req.body;
        const userId = req.user.id;

        // First, create or find the language
        let language = await prisma.language.findUnique({
            where: { code }
        });

        if (!language) {
            language = await prisma.language.create({
                data: {
                    name,
                    code
                }
            });
        }

        // Check if user already has this language
        const existingUserLanguage = await prisma.userLanguage.findUnique({
            where: {
                userId_languageId: {
                    userId,
                    languageId: language.id
                }
            }
        });

        if (existingUserLanguage) {
            res.status(400).json({
                success: false,
                message: 'Language already added to your learning list'
            });
            return;
        }

        // Add language to user's list
        const userLanguage = await prisma.userLanguage.create({
            data: {
                userId,
                languageId: language.id,
                level: level || 'BEGINNER'
            },
            include: {
                language: true
            }
        });

        res.status(201).json({
            success: true,
            message: 'Language added to learning list',
            data: userLanguage
        });
    } catch (error) {
        console.error('Error adding user language:', error);
        res.status(500).json({
            success: false,
            message: 'Error adding language to learning list'
        });
    }
};

// Get user's learning languages
export const getUserLanguages = async (req: TypedRequestBody<{}>, res: Response): Promise<void> => {
    try {
        const userId = req.user.id;

        const userLanguages = await prisma.userLanguage.findMany({
            where: { userId },
            include: {
                language: true
            }
        });

        res.json({
            success: true,
            data: userLanguages
        });
    } catch (error) {
        console.error('Error fetching user languages:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching user languages'
        });
    }
};

// Update language level
export const updateLanguageLevel = async (
    req: TypedRequestBody<UpdateLevelBody>,
    res: Response
): Promise<void> => {
    try {
        const { languageId, level } = req.body;
        const userId = req.user.id;

        const userLanguage = await prisma.userLanguage.update({
            where: {
                userId_languageId: {
                    userId,
                    languageId
                }
            },
            data: { level },
            include: {
                language: true
            }
        });

        res.json({
            success: true,
            message: 'Language level updated',
            data: userLanguage
        });
    } catch (error) {
        console.error('Error updating language level:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating language level'
        });
    }
};

// Remove language from user's list
export const removeUserLanguage = async (
    req: TypedRequestBody<{}> & { params: { languageId: string } },
    res: Response
): Promise<void> => {
    try {
        const { languageId } = req.params;
        const userId = req.user.id;

        await prisma.userLanguage.delete({
            where: {
                userId_languageId: {
                    userId,
                    languageId
                }
            }
        });

        res.json({
            success: true,
            message: 'Language removed from learning list'
        });
    } catch (error) {
        console.error('Error removing user language:', error);
        res.status(500).json({
            success: false,
            message: 'Error removing language from learning list'
        });
    }
}; 