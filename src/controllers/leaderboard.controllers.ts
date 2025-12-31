import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface TypedRequestBody<T> extends Request {
    body: T;
    user: {
        id: string;
    };
}

interface LeaderboardEntryBody {
    quizId: string;
    score: number;
    timeTaken?: number;
}

interface LeaderboardEntry {
    id: string;
    userId: string;
    quizId: string;
    score: number;
    timeTaken?: number | null;
    createdAt: Date;
    user: {
        fullName: string;
        id?: string;
    };
}

/**
 * Add or update a user's score on the leaderboard for a specific quiz
 */
export const addLeaderboardEntry = async (
    req: TypedRequestBody<LeaderboardEntryBody>,
    res: Response
): Promise<void> => {
    try {
        const { quizId, score, timeTaken } = req.body;
        const userId = req.user.id;

        // Validate quiz exists
        const quiz = await prisma.quiz.findUnique({
            where: { id: quizId },
            include: {
                lesson: {
                    include: {
                        language: true
                    }
                }
            }
        });

        if (!quiz) {
            res.status(404).json({
                success: false,
                message: 'Quiz not found'
            });
            return;
        }

        // Validate score (must be between 0-100)
        const validatedScore = typeof score === 'number' && score >= 0 && score <= 100 
            ? Math.round(score) 
            : 0;

        // Add or update leaderboard entry
        const entry = await prisma.$transaction(async (tx) => {
            // Check if entry exists
            const existingEntry = await tx.leaderboardEntry.findUnique({
                where: {
                    userId_quizId: {
                        userId,
                        quizId
                    }
                }
            });

            if (existingEntry) {
                // Update if score is better
                return await tx.leaderboardEntry.update({
                    where: {
                        id: existingEntry.id
                    },
                    data: {
                        score: validatedScore,
                        timeTaken: timeTaken !== undefined ? timeTaken : existingEntry.timeTaken
                    },
                    include: {
                        user: {
                            select: {
                                fullName: true
                            }
                        }
                    }
                });
            } else {
                // Create new entry
                return await tx.leaderboardEntry.create({
                    data: {
                        userId,
                        quizId,
                        score: validatedScore,
                        timeTaken
                    },
                    include: {
                        user: {
                            select: {
                                fullName: true
                            }
                        }
                    }
                });
            }
        });

        // Also update learning progress for this lesson
        await prisma.learningProgress.upsert({
            where: {
                userId_lessonId: {
                    userId,
                    lessonId: quiz.lessonId
                }
            },
            update: {
                score: validatedScore,
                completed: true
            },
            create: {
                userId,
                lessonId: quiz.lessonId,
                score: validatedScore,
                completed: true
            }
        });

        res.json({
            success: true,
            message: 'Leaderboard entry added/updated successfully',
            data: {
                id: entry.id,
                quizId: entry.quizId,
                score: entry.score,
                timeTaken: entry.timeTaken,
                userName: entry.user.fullName
            }
        });
    } catch (error) {
        console.error('Error adding leaderboard entry:', error);
        res.status(500).json({
            success: false,
            message: 'Error adding leaderboard entry'
        });
    }
};

/**
 * Get the global leaderboard across all quizzes
 */
export const getGlobalLeaderboard = async (
    _req: Request, 
    res: Response
): Promise<void> => {
    try {
        // Get the top scorers based on average quiz scores
        const topUsers = await prisma.$queryRaw`
            SELECT 
                u."id" as "userId",
                u."fullName" as "userName",
                COUNT(le."id") as "quizzesCompleted",
                ROUND(AVG(le."score")::numeric, 2) as "averageScore",
                SUM(le."score") as "totalScore"
            FROM "User" u
            JOIN "LeaderboardEntry" le ON u."id" = le."userId"
            GROUP BY u."id", u."fullName"
            ORDER BY "averageScore" DESC, "quizzesCompleted" DESC
            LIMIT 20
        `;

        // Format numeric values to ensure they are numbers, not strings
        const formattedTopUsers = Array.isArray(topUsers) ? topUsers.map(user => ({
            userId: user.userId,
            userName: user.userName,
            quizzesCompleted: Number(user.quizzesCompleted),
            averageScore: Number(user.averageScore),
            totalScore: Number(user.totalScore)
        })) : [];

        res.json({
            success: true,
            data: formattedTopUsers
        });
    } catch (error) {
        console.error('Error fetching global leaderboard:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching global leaderboard'
        });
    }
};

/**
 * Get the leaderboard for a specific quiz
 */
export const getQuizLeaderboard = async (
    req: Request & { params: { quizId: string } }, 
    res: Response
): Promise<void> => {
    try {
        const { quizId } = req.params;

        // Validate quiz exists
        const quiz = await prisma.quiz.findUnique({
            where: { id: quizId },
            include: {
                lesson: true
            }
        });

        if (!quiz) {
            res.status(404).json({
                success: false,
                message: 'Quiz not found'
            });
            return;
        }

        // Get the leaderboard entries for this quiz
        const leaderboard = await prisma.leaderboardEntry.findMany({
            where: {
                quizId
            },
            orderBy: [
                { score: 'desc' },
                { timeTaken: 'asc' }
            ],
            include: {
                user: {
                    select: {
                        id: true,
                        fullName: true
                    }
                }
            },
            take: 20 // Limit to top 20 scores
        });

        // Format the response
        const formattedLeaderboard = leaderboard.map((entry: LeaderboardEntry, index: number) => ({
            rank: index + 1,
            userId: entry.user.id,
            userName: entry.user.fullName,
            score: entry.score,
            timeTaken: entry.timeTaken,
            createdAt: entry.createdAt
        }));

        res.json({
            success: true,
            data: {
                quizInfo: {
                    id: quiz.id,
                    lessonId: quiz.lessonId,
                    lessonTitle: quiz.lesson.title
                },
                leaderboard: formattedLeaderboard
            }
        });
    } catch (error) {
        console.error('Error fetching quiz leaderboard:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching quiz leaderboard'
        });
    }
};

/**
 * Get the leaderboard for a specific language
 */
export const getLanguageLeaderboard = async (
    req: Request & { params: { languageId: string } }, 
    res: Response
): Promise<void> => {
    try {
        const { languageId } = req.params;

        // Validate language exists
        const language = await prisma.language.findUnique({
            where: { id: languageId }
        });

        if (!language) {
            res.status(404).json({
                success: false,
                message: 'Language not found'
            });
            return;
        }

        // Get the top users for this language
        const languageLeaderboard = await prisma.$queryRaw`
            SELECT 
                u."id" as "userId",
                u."fullName" as "userName",
                COUNT(le."id") as "quizzesCompleted",
                ROUND(AVG(le."score")::numeric, 2) as "averageScore",
                SUM(le."score") as "totalScore"
            FROM "User" u
            JOIN "LeaderboardEntry" le ON u."id" = le."userId"
            JOIN "Quiz" q ON le."quizId" = q."id"
            JOIN "Lesson" l ON q."lessonId" = l."id"
            WHERE l."languageId" = ${languageId}
            GROUP BY u."id", u."fullName"
            ORDER BY "averageScore" DESC, "quizzesCompleted" DESC
            LIMIT 20
        `;

        res.json({
            success: true,
            data: {
                language: {
                    id: language.id,
                    name: language.name,
                },
                leaderboard: languageLeaderboard
            }
        });
    } catch (error) {
        console.error('Error fetching language leaderboard:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching language leaderboard'
        });
    }
};

/**
 * Get a user's position and stats across all leaderboards
 */
export const getUserLeaderboardStats = async (
    req: TypedRequestBody<{}>, 
    res: Response
): Promise<void> => {
    try {
        const userId = req.user.id;

        // Get the user's entries
        const userEntries = await prisma.leaderboardEntry.findMany({
            where: {
                userId
            },
            include: {
                quiz: {
                    include: {
                        lesson: {
                            include: {
                                language: true
                            }
                        }
                    }
                }
            }
        });

        if (!userEntries.length) {
            // User has no entries yet
            res.json({
                success: true,
                data: {
                    quizzesCompleted: 0,
                    averageScore: 0,
                    bestScore: 0,
                    languageBreakdown: []
                }
            });
            return;
        }

        // Calculate overall stats
        const totalScore = userEntries.reduce((sum: number, entry: any) => sum + entry.score, 0);
        const averageScore = Math.round((totalScore / userEntries.length) * 100) / 100;
        const bestScore = Math.max(...userEntries.map((entry: any) => entry.score));

        // Calculate stats by language
        const languageMap = new Map();
        
        userEntries.forEach((entry: any) => {
            const languageId = entry.quiz.lesson.language.id;
            const languageName = entry.quiz.lesson.language.name;
            
            if (!languageMap.has(languageId)) {
                languageMap.set(languageId, {
                    languageId,
                    languageName,
                    quizCount: 0,
                    totalScore: 0
                });
            }
            
            const langStats = languageMap.get(languageId);
            langStats.quizCount++;
            langStats.totalScore += entry.score;
        });
        
        // Convert map to array and calculate averages
        const languageBreakdown = Array.from(languageMap.values()).map(stats => ({
            languageId: stats.languageId,
            languageName: stats.languageName,
            quizzesCompleted: stats.quizCount,
            averageScore: Math.round((stats.totalScore / stats.quizCount) * 100) / 100
        }));

        res.json({
            success: true,
            data: {
                quizzesCompleted: userEntries.length,
                averageScore,
                bestScore,
                languageBreakdown
            }
        });
    } catch (error) {
        console.error('Error fetching user leaderboard stats:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching user leaderboard stats'
        });
    }
}; 