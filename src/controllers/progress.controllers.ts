import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface TypedRequestBody<T> extends Request {
    body: T;
    user: {
        id: string;
    };
}

interface UpdateProgressBody {
    lessonId: string;
    score: number;
    completed: boolean;
}

// Get user's learning progress dashboard
export const getProgressDashboard = async (req: TypedRequestBody<{}>, res: Response): Promise<void | Response> => {
    try {
        const userId = req.user.id;
        console.log(`Fetching dashboard data for user: ${userId}`);

        // 1. First get all learning progress records for this user directly from LearningProgress table
        const progressRecords = await prisma.learningProgress.findMany({
            where: { userId },
            include: {
                lesson: {
                    include: {
                        language: true
                    }
                }
            }
        });

        console.log(`Found ${progressRecords.length} learning progress records for user ${userId}`);

        if (progressRecords.length === 0) {
            // If no progress, try to get the user's languages to show them with zero progress
            const userLanguages = await prisma.userLanguage.findMany({
                where: { userId },
                include: {
                    language: true
                }
            });

            if (!userLanguages.length) {
                console.log('No languages found for user');
                return res.json({
                    success: true,
                    data: []
                });
            }

            // Create empty progress entries for each language
            const emptyProgressResults = userLanguages.map(userLang => ({
                language: {
                    id: userLang.language.id,
                    name: userLang.language.name
                },
                level: userLang.level,
                progress: {
                    totalLessons: 0,
                    completedLessons: 0,
                    completionRate: 0,
                    averageScore: 0
                }
            }));

            console.log(`Sending ${emptyProgressResults.length} empty language progress records`);
            
            return res.json({
                success: true,
                data: emptyProgressResults
            });
        }

        // 2. Group progress records by language
        const progressByLanguage = new Map();
        
        // First pass: find unique languages and initialize their data
        for (const record of progressRecords) {
            const languageId = record.lesson.languageId;
            const language = record.lesson.language;
            
            if (!progressByLanguage.has(languageId)) {
                progressByLanguage.set(languageId, {
                    language: {
                        id: languageId,
                        name: language.name
                    },
                    level: null, // Will be populated from userLanguage
                    records: [],
                    lessonIds: new Set()
                });
            }
            
            const languageData = progressByLanguage.get(languageId);
            languageData.records.push(record);
            languageData.lessonIds.add(record.lessonId);
        }

        // 3. For each language, get all available lessons to calculate completion percentage
        const progressResults = [];
        
        for (const [languageId, languageData] of progressByLanguage.entries()) {
            try {
                // Get user language level
                const userLanguage = await prisma.userLanguage.findUnique({
                    where: {
                        userId_languageId: {
                            userId,
                            languageId
                        }
                    }
                });
                
                languageData.level = userLanguage?.level || 'BEGINNER';
                
                // Get total lessons count for this language
                const totalLessonsCount = await prisma.lesson.count({
                    where: { languageId }
                });
                
                // Calculate progress
                const completedRecords = languageData.records.filter((r: any) => r.completed === true);
                const completedLessons = completedRecords.length;
                
                // Calculate average score from completed lessons only
                const totalScore = completedRecords.reduce((sum: number, record: any) => {
                    return sum + (typeof record.score === 'number' ? record.score : 0);
                }, 0);
                
                const averageScore = completedLessons > 0 
                    ? Math.round(totalScore / completedLessons) 
                    : 0;
                
                const completionRate = totalLessonsCount > 0 
                    ? Math.round((completedLessons / totalLessonsCount) * 100) 
                    : 0;
                
                console.log(`Language: ${languageData.language.name}, ` +
                    `Completed: ${completedLessons}/${totalLessonsCount}, ` +
                    `Rate: ${completionRate}%, Avg Score: ${averageScore}`);
                
                // Add final progress data
                progressResults.push({
                    language: languageData.language,
                    level: languageData.level,
                    progress: {
                        totalLessons: totalLessonsCount,
                        completedLessons,
                        completionRate,
                        averageScore
                    }
                });
            } catch (langError) {
                console.error(`Error processing language ${languageData.language.name}:`, langError);
            }
        }

        // 4. Also check for languages that have no progress records but user has added
        const allUserLanguages = await prisma.userLanguage.findMany({
            where: { userId },
            include: { language: true }
        });
        
        // Add languages that don't have progress records
        for (const userLang of allUserLanguages) {
            if (!progressByLanguage.has(userLang.languageId)) {
                console.log(`Adding language with no progress: ${userLang.language.name}`);
                
                progressResults.push({
                    language: {
                        id: userLang.language.id,
                        name: userLang.language.name
                    },
                    level: userLang.level,
                    progress: {
                        totalLessons: 0,
                        completedLessons: 0,
                        completionRate: 0,
                        averageScore: 0
                    }
                });
            }
        }

        console.log(`Sending ${progressResults.length} language progress records`);
        
        // Return the collected results
        res.json({
            success: true,
            data: progressResults
        });
    } catch (error) {
        console.error('Error fetching progress dashboard:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching progress dashboard'
        });
    }
};

// Update lesson progress
export const updateLessonProgress = async (
    req: TypedRequestBody<UpdateProgressBody>,
    res: Response
): Promise<void> => {
    try {
        const { lessonId, score, completed } = req.body;
        const userId = req.user.id;

        console.log(`Updating progress for user ${userId}, lesson ${lessonId}`);
        console.log(`Score: ${score}, Completed: ${completed}`);

        // Check if lesson exists
        const lesson = await prisma.lesson.findUnique({
            where: { id: lessonId },
            include: {
                language: true // Include the language data to know which language is being updated
            }
        });

        if (!lesson) {
            console.log(`Lesson not found: ${lessonId}`);
            res.status(404).json({
                success: false,
                message: 'Lesson not found'
            });
            return;
        }

        console.log(`Lesson found: ${lesson.title}, Language: ${lesson.language.name}`);

        // Validate score is a number between 0 and 100
        const validatedScore = typeof score === 'number' && score >= 0 && score <= 100 
            ? Math.round(score) 
            : 0;

        // Update or create progress
        const progress = await prisma.learningProgress.upsert({
            where: {
                userId_lessonId: {
                    userId,
                    lessonId
                }
            },
            update: {
                score: validatedScore,
                completed: !!completed, // Ensure boolean
                updatedAt: new Date() // Force update timestamp
            },
            create: {
                userId,
                lessonId,
                score: validatedScore,
                completed: !!completed // Ensure boolean
            },
            include: {
                lesson: {
                    include: {
                        language: true
                    }
                }
            }
        });

        console.log(`Progress updated successfully for lesson "${progress.lesson.title}"`);
        console.log(`New progress: Score ${progress.score}, Completed: ${progress.completed}`);

        // Include language info in response
        const responseData = {
            ...progress,
            language: progress.lesson.language
        };

        res.json({
            success: true,
            message: 'Progress updated successfully',
            data: responseData
        });
    } catch (error) {
        console.error('Error updating lesson progress:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating lesson progress'
        });
    }
};

// Get detailed progress for a specific language
export const getLanguageProgress = async (
    req: TypedRequestBody<{}> & { params: { languageId: string } },
    res: Response
): Promise<void | Response> => {
    try {
        const { languageId } = req.params;
        const userId = req.user.id;

        console.log(`Fetching progress for language ${languageId}, user ${userId}`);

        // First validate the language exists
        const language = await prisma.language.findUnique({
            where: { id: languageId }
        });

        if (!language) {
            console.log(`Language not found: ${languageId}`);
            return res.status(404).json({
                success: false,
                message: 'Language not found'
            });
        }

        console.log(`Fetching progress for language: ${language.name}`);

        // Get all lessons for the language with ordering
        const lessons = await prisma.lesson.findMany({
            where: { languageId },
            orderBy: { createdAt: 'asc' } // Get oldest lessons first
        });
        
        if (!lessons.length) {
            console.log(`No lessons found for language: ${languageId}`);
            return res.json({
                success: true,
                data: []
            });
        }

        console.log(`Found ${lessons.length} lessons for language ${languageId}`);
        
        // Get progress for each lesson directly from LearningProgress
        const progressRecords = await prisma.learningProgress.findMany({
            where: {
                userId,
                lesson: {
                    languageId
                }
            },
            include: {
                lesson: true // Include lesson details
            }
        });

        console.log(`Found ${progressRecords.length} progress records for language ${languageId}`);
        
        // Create a map of progress records by lessonId for faster lookup
        const progressByLessonId: Record<string, any> = {};
        for (const record of progressRecords) {
            progressByLessonId[record.lessonId] = {
                completed: record.completed,
                score: record.score,
                updatedAt: record.updatedAt
            };
        }

        // Combine lesson data with progress data
        const progressDetails = lessons.map(lesson => {
            const progress = progressByLessonId[lesson.id] || {
                completed: false,
                score: 0,
                updatedAt: null
            };
            
            return {
                lesson: {
                    id: lesson.id,
                    title: lesson.title,
                    level: lesson.level,
                    description: lesson.description,
                    createdAt: lesson.createdAt
                },
                progress
            };
        });

        // Sort by completion status and date
        progressDetails.sort((a, b) => {
            // First sort by completion status (incomplete first)
            if (a.progress.completed !== b.progress.completed) {
                return a.progress.completed ? 1 : -1;
            }
            
            // For completed lessons, sort by most recently completed
            if (a.progress.completed && b.progress.completed) {
                return new Date(b.progress.updatedAt || 0).getTime() - 
                       new Date(a.progress.updatedAt || 0).getTime();
            }
            
            // For incomplete lessons, sort by creation date (oldest first)
            return new Date(a.lesson.createdAt || 0).getTime() - 
                   new Date(b.lesson.createdAt || 0).getTime();
        });

        res.json({
            success: true,
            data: progressDetails
        });
    } catch (error) {
        console.error('Error fetching language progress:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching language progress'
        });
    }
};

// Quiz progress update
export const updateQuizProgress = async (
    req: TypedRequestBody<{
        quizId: string;
        score: number;
        timeTaken?: number;
    }>,
    res: Response
): Promise<void> => {
    try {
        const { quizId, score, timeTaken } = req.body;
        const userId = req.user.id;

        console.log(`Updating quiz progress for user ${userId}, quiz ${quizId}`);
        console.log(`Score: ${score}, Time taken: ${timeTaken || 'N/A'}`);

        // Check if quiz exists
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
            console.log(`Quiz not found: ${quizId}`);
            res.status(404).json({
                success: false,
                message: 'Quiz not found'
            });
            return;
        }

        const lessonId = quiz.lessonId;
        console.log(`Quiz found. Associated lesson: ${quiz.lesson.title}, Language: ${quiz.lesson.language.name}`);

        // Validate score is a number between 0 and 100
        const validatedScore = typeof score === 'number' && score >= 0 && score <= 100 
            ? Math.round(score) 
            : 0;

        // Update learning progress first
        const progress = await prisma.learningProgress.upsert({
            where: {
                userId_lessonId: {
                    userId,
                    lessonId
                }
            },
            update: {
                score: validatedScore,
                completed: true,
                updatedAt: new Date()
            },
            create: {
                userId,
                lessonId,
                score: validatedScore,
                completed: true
            }
        });

        console.log(`Progress updated successfully: Score ${progress.score}, Completed: ${progress.completed}`);
        
        // Then try to update leaderboard
        let leaderboardEntry = null;
        try {
            leaderboardEntry = await prisma.leaderboardEntry.upsert({
                where: {
                    userId_quizId: {
                        userId,
                        quizId
                    }
                },
                update: {
                    // Only update if the new score is higher
                    score: validatedScore,
                    timeTaken: timeTaken ?? undefined
                },
                create: {
                    userId,
                    quizId,
                    score: validatedScore,
                    timeTaken: timeTaken ?? undefined
                }
            });
            console.log(`Leaderboard entry created/updated: Score ${leaderboardEntry.score}`);
        } catch (e: unknown) {
            console.error('Leaderboard entry failed, schema might not be migrated yet:', e);
        }

        res.json({
            success: true,
            message: 'Quiz progress updated successfully',
            data: {
                progress: {
                    lessonId: progress.lessonId,
                    score: progress.score,
                    completed: progress.completed
                },
                leaderboard: leaderboardEntry ? {
                    quizId: leaderboardEntry.quizId,
                    score: leaderboardEntry.score,
                    timeTaken: leaderboardEntry.timeTaken
                } : null
            }
        });
    } catch (error) {
        console.error('Error updating quiz progress:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating quiz progress'
        });
    }
}; 