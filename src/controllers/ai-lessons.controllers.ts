import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { GoogleGenerativeAI } from "@google/generative-ai";

const prisma = new PrismaClient();

// Gemini setup
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

console.log("GEMINI_API_KEY loaded?", !!process.env.GEMINI_API_KEY);
console.log("GEMINI_MODEL:", GEMINI_MODEL);

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);


function safeJsonParse<T = any>(raw: string): T {
  const text = String(raw || "").trim();

  try {
    return JSON.parse(text);
  } catch {}

  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {}

  const objMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      return JSON.parse(objMatch[0]);
    } catch {}
  }

  const arrMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try {
      return JSON.parse(arrMatch[0]);
    } catch {}
  }

  throw new Error("Gemini did not return valid JSON");
}

async function callGeminiText(prompt: string, maxOutputTokens = 1200): Promise<string> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Missing GEMINI_API_KEY in environment variables");
  }

  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      maxOutputTokens,
      temperature: 0.7,
    },
  });

  return result.response.text();
}

async function callGeminiJSON<T = any>(prompt: string, maxOutputTokens = 2000): Promise<T> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Missing GEMINI_API_KEY in environment variables");
  }

  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `
You MUST respond with ONLY valid JSON.
No markdown. No code fences. No explanation. No extra text.

${prompt}
            `.trim(),
          },
        ],
      },
    ],
    generationConfig: {
      maxOutputTokens,
      temperature: 0.4,
      responseMimeType: "application/json",
    },
  });

  const raw = result.response.text();
  return safeJsonParse<T>(raw);
}

interface LessonRequest {
  languageId: string;
  level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  topic?: string;
}

interface QuizRequest {
  lessonId: string;
  numberOfQuestions?: number;
}

interface PronunciationFeedbackRequest {
  languageId: string;
  audioData: string;
  targetText: string;
  level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
}

interface PronunciationFeedback {
  accuracy: number;
  feedback: string;
  suggestions: string[];
  phonemes: Array<{
    sound: string;
    accuracy: number;
    feedback: string;
  }>;
}

/**
 * Generate a language lesson using Gemini
 */
export const generateLesson = async (req: Request, res: Response) => {
  try {
    const { languageId, level, topic } = req.body as LessonRequest;
    const userId = (req as any).user?.id;

    if (!languageId || !level) {
      return res.status(400).json({
        success: false,
        message: "languageId and level are required",
      });
    }
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const language = await prisma.language.findUnique({ where: { id: languageId } });
    if (!language) {
      return res.status(404).json({ success: false, message: "Language not found" });
    }

    let lessonContent: any;
    try {
      lessonContent = await callGeminiJSON(
        `
Generate a structured ${level.toLowerCase()} level lesson for learning ${language.name}${
          topic ? ` about ${topic}` : ""
        }.

Return JSON with exactly:
{
  "vocabulary": [{"word":"","translation":"","example":""}],
  "grammar": "",
  "examples": [],
  "exercises": [],
  "culturalNotes": ""
}

Rules:
- vocabulary: 5 to 10 items
- examples: 3 to 6 short sentences
- exercises: 3 to 6 prompts/questions
- Keep beginner friendly if BEGINNER
        `.trim(),
        2400
      );
    } catch (e) {
      console.error("Lesson JSON generation failed:", e);
      lessonContent = {
        vocabulary: [],
        grammar: "Lesson generated but JSON formatting failed. Please retry.",
        examples: [],
        exercises: [],
        culturalNotes: "",
      };
    }

    const lesson = await prisma.lesson.create({
      data: {
        title: topic || `${level} ${language.name} Lesson`,
        description: "AI-generated lesson",
        languageId,
        level,
        content: lessonContent,
      },
    });

    try {
      await generateQuizInternal(lesson.id, lessonContent, 5);
    } catch (e) {
      console.error("Auto quiz generation failed:", e);
    }

    const progress = await prisma.learningProgress.create({
      data: {
        userId,
        lessonId: lesson.id,
        score: 0,
        completed: false,
      },
    });

    return res.json({
      success: true,
      lesson: { ...lesson, content: lessonContent },
      progress: {
        id: progress.id,
        completed: progress.completed,
        score: progress.score,
      },
    });
  } catch (error) {
    console.error("Error generating lesson:", error);
    return res.status(500).json({ success: false, message: "Error generating lesson" });
  }
};


export const generateQuiz = async (req: Request, res: Response) => {
  try {
    const { lessonId, numberOfQuestions = 5 } = req.body as QuizRequest;

    if (!lessonId) {
      return res.status(400).json({ success: false, message: "lessonId is required" });
    }

    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { language: true, Quiz: true },
    });

    if (!lesson) {
      return res.status(404).json({ success: false, message: "Lesson not found" });
    }

    if (lesson.Quiz && lesson.Quiz.length > 0) {
      const existing = lesson.Quiz[0];
      const questions = Array.isArray(existing.questions) ? existing.questions : [];
      return res.json({
        success: true,
        quiz: { id: existing.id, lessonId: existing.lessonId, questions },
      });
    }

    const quiz = await generateQuizInternal(lessonId, lesson.content, numberOfQuestions);
    const questions = Array.isArray(quiz.questions) ? quiz.questions : [];

    return res.json({
      success: true,
      quiz: { id: quiz.id, lessonId: quiz.lessonId, questions },
    });
  } catch (error) {
    console.error("Error generating quiz:", error);
    return res.status(500).json({ success: false, message: "Error generating quiz" });
  }
};

async function generateQuizInternal(lessonId: string, lessonContent: any = null, numberOfQuestions = 5) {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { language: true },
  });

  if (!lesson) throw new Error("Lesson not found");

  let quizContent: any[] = [];
  try {
    quizContent = await callGeminiJSON<any[]>(
      `
Generate ${numberOfQuestions} multiple-choice questions for a ${lesson.level.toLowerCase()} level ${lesson.language.name} lesson.

If content is provided, base questions on it:
CONTENT: ${lessonContent ? JSON.stringify(lessonContent) : "N/A"}

Return ONLY a JSON array like:
[
  {
    "question": "",
    "options": ["", "", "", ""],
    "correctAnswer": 0,
    "explanation": ""
  }
]

Rules:
- correctAnswer is the index (0-3)
- options must have 4 items
- keep language learner friendly
      `.trim(),
      2400
    );
  } catch (e) {
    console.error("Quiz JSON generation failed:", e);
    quizContent = [];
  }

  return prisma.quiz.create({
    data: {
      lessonId,
      questions: quizContent,
    },
  });
}

export const generateConversationPrompt = async (req: Request, res: Response) => {
  try {
    const { languageId, level, scenario } = req.body;
    const userId = (req as any).user?.id;

    if (!languageId || !level) {
      return res.status(400).json({
        success: false,
        message: "languageId and level are required",
      });
    }
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const language = await prisma.language.findUnique({ where: { id: languageId } });
    if (!language) {
      return res.status(404).json({ success: false, message: "Language not found" });
    }

    let conversationContent: any;
    try {
      conversationContent = await callGeminiJSON(
        `
Generate a realistic conversation scenario in ${language.name} for ${String(level).toLowerCase()} level${
          scenario ? ` about ${scenario}` : ""
        }.

Return ONLY JSON:
{
  "context": "",
  "vocabulary": [{"word":"","translation":""}],
  "script": [{"${language.code}":"","english":""}],
  "culturalNotes": ""
}

Rules:
- vocabulary: 5 to 10 items
- script: 6 to 12 lines total
- keep it natural & useful
        `.trim(),
        2400
      );
    } catch (e) {
      console.error("Conversation JSON generation failed:", e);
      conversationContent = {
        context: "Practice conversation",
        vocabulary: [],
        script: [
          { [language.code]: "Hola", english: "Hello" },
          { [language.code]: "¿Cómo estás?", english: "How are you?" },
        ],
        culturalNotes: "",
      };
    }

    const conversation = await prisma.conversationPractice.create({
      data: {
        userId,
        transcript: {
          languageId,
          level: level || "BEGINNER",
          scenario: scenario || "General conversation",
          content: conversationContent,
        },
      },
    });

    return res.json({
      success: true,
      conversation: {
        id: conversation.id,
        languageId,
        level,
        scenario: scenario || "General conversation",
        content: conversationContent,
      },
    });
  } catch (error) {
    console.error("Error generating conversation prompt:", error);
    return res.status(500).json({
      success: false,
      message: "Error generating conversation prompt",
    });
  }
};

export const getConversationResponse = async (req: Request, res: Response) => {
  try {
    const { languageId, message } = req.body;
    const userId = (req as any).user?.id;

    if (!languageId) {
      return res.status(400).json({ success: false, message: "Missing languageId" });
    }
    if (!message || typeof message !== "string") {
      return res.status(400).json({ success: false, message: "Missing or invalid message" });
    }
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const language = await prisma.language.findUnique({ where: { id: languageId } });
    if (!language) {
      return res.status(404).json({ success: false, message: "Language not found" });
    }

    const prompt = `
You are a language learning assistant for ${language.name}.
Respond to this learner message: "${message}"

Your response must:
1) Be helpful and encouraging
2) Use simple language
3) Provide corrections if there are grammar mistakes
4) Include the correct ${language.name} phrases when appropriate

Keep it under 150 words.
`.trim();

    const responseText = await callGeminiText(prompt, 700);

    try {
      await prisma.conversationExchange.create({
        data: {
          userId,
          languageId,
          userMessage: message,
          aiResponse: responseText,
        },
      });
    } catch (dbError) {
      console.error("Error saving conversation:", dbError);
    }

    return res.json({
      success: true,
      data: { response: responseText },
    });
  } catch (error) {
    console.error("Error generating conversation response:", error);
    return res.status(500).json({
      success: false,
      message: "Error generating conversation response",
    });
  }
};

export const getPronunciationFeedback = async (req: Request, res: Response) => {
  try {
    const { languageId, audioData, targetText, level } = req.body as PronunciationFeedbackRequest;

    if (!languageId || !audioData || !targetText || !level) {
      return res.status(400).json({
        success: false,
        error: "Missing required parameters: languageId, audioData, targetText, level",
      });
    }

    const language = await prisma.language.findUnique({ where: { id: languageId } });
    if (!language) {
      return res.status(404).json({ success: false, error: "Language not found" });
    }

    let feedback: PronunciationFeedback;

    try {
      feedback = await callGeminiJSON<PronunciationFeedback>(
        `
You are an expert pronunciation coach.

We cannot transcribe audio here, so give practical pronunciation feedback based on the TARGET TEXT only.
Target language: ${language.name}
Student level: ${level}
TARGET TEXT: "${targetText}"

Return ONLY JSON in this exact structure:
{
  "accuracy": 0.7,
  "feedback": "",
  "suggestions": ["", ""],
  "phonemes": [{"sound":"","accuracy":0.7,"feedback":""}]
}

Rules:
- accuracy must be between 0.0 and 1.0
- suggestions: 2 to 4 items
- phonemes: 2 to 5 key sounds or tricky parts from the phrase
- Be encouraging and actionable.
        `.trim(),
        1800
      );

      if (typeof feedback.accuracy !== "number" || feedback.accuracy < 0 || feedback.accuracy > 1) {
        feedback.accuracy = 0.7;
      }
      if (typeof feedback.feedback !== "string") feedback.feedback = "Good attempt—keep practicing!";
      if (!Array.isArray(feedback.suggestions)) feedback.suggestions = [];
      if (!Array.isArray(feedback.phonemes)) feedback.phonemes = [];
    } catch (e) {
      console.error("Pronunciation JSON generation failed:", e);
      feedback = {
        accuracy: 0.7,
        feedback: `We received your pronunciation attempt for "${targetText}". Here are general tips to improve.`,
        suggestions: [
          "Speak slowly and clearly, then speed up gradually",
          "Repeat the phrase 3 times focusing on vowel sounds",
          "Record again in a quiet room with mic close to you",
        ],
        phonemes: [
          {
            sound: targetText.split(" ")[0] || targetText,
            accuracy: 0.7,
            feedback: "Focus on clear articulation.",
          },
        ],
      };
    }

    await prisma.pronunciationFeedback.create({
      data: {
        userId: (req as any).user.id,
        sentence: targetText,
        accuracy: feedback.accuracy,
        feedback: JSON.stringify(feedback),
      },
    });

    return res.json({ success: true, feedback });
  } catch (error: any) {
    console.error("Error in getPronunciationFeedback:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to generate pronunciation feedback",
    });
  }
};

export const getLessonContent = async (req: Request, res: Response) => {
  try {
    const { lessonId } = req.params;

    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { Quiz: true, language: true },
    });

    if (!lesson) {
      return res.status(404).json({ success: false, message: "Lesson not found" });
    }

    const quiz = lesson.Quiz?.[0];
    const quizQuestions = quiz && Array.isArray(quiz.questions) ? quiz.questions : [];

    return res.json({
      success: true,
      lesson: {
        id: lesson.id,
        title: lesson.title,
        description: lesson.description,
        level: lesson.level,
        languageId: lesson.languageId,
        language: lesson.language,
        content:
          lesson.content || {
            vocabulary: [],
            grammar: "",
            examples: [],
            exercises: [],
            culturalNotes: "",
          },
        quiz: {
          id: quiz?.id || "",
          lessonId: lesson.id,
          questions: quizQuestions,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching lesson:", error);
    return res.status(500).json({ success: false, message: "Error fetching lesson" });
  }
};
