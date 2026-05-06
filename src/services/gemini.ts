import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface DetailedFeedback {
  score: number;
  feedback: string;
  grammar: { score: number; details: string };
  vocabulary: { score: number; details: string };
  coherence: { score: number; details: string };
  suggestions: string[];
}

export async function evaluateWriting(
  language: string,
  prompt: string,
  userAnswer: string
): Promise<DetailedFeedback> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `
      You are a language teacher. Evaluate the following writing task in ${language}.
      
      Prompt: ${prompt}
      User Answer: ${userAnswer}
      
      Evaluate based on:
      1. Grammar: Accuracy and complexity.
      2. Vocabulary: Range and appropriateness.
      3. Coherence: Organization and flow.
      
      Return the response in JSON format:
      {
        "score": number (total 0-100),
        "feedback": "string (overall summary)",
        "grammar": { "score": number (0-100), "details": "string" },
        "vocabulary": { "score": number (0-100), "details": "string" },
        "coherence": { "score": number (0-100), "details": "string" },
        "suggestions": ["string", "string"]
      }
    `,
    config: {
      responseMimeType: "application/json",
    },
  });

  try {
    return JSON.parse(response.text || "{}");
  } catch (e) {
    return { 
      score: 0, 
      feedback: "Error evaluating answer.",
      grammar: { score: 0, details: "N/A" },
      vocabulary: { score: 0, details: "N/A" },
      coherence: { score: 0, details: "N/A" },
      suggestions: []
    };
  }
}

export async function evaluateSpeaking(
  language: string,
  prompt: string,
  transcription: string
): Promise<DetailedFeedback> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `
      You are a language teacher. Evaluate the following speaking task in ${language} based on the transcription provided by a speech-to-text engine.
      
      Prompt: ${prompt}
      Transcription: ${transcription}
      
      Evaluate based on:
      1. Accuracy: How well the spoken response addresses the prompt.
      2. Vocabulary: Range and appropriateness of words used.
      3. Clarity: Based on the transcription, how clear and structured the response is.
      
      Return the response in JSON format:
      {
        "score": number (total 0-100),
        "feedback": "string (overall summary)",
        "grammar": { "score": number (0-100), "details": "string (Focus on accuracy of content)" },
        "vocabulary": { "score": number (0-100), "details": "string" },
        "coherence": { "score": number (0-100), "details": "string (Focus on clarity and structure)" },
        "suggestions": ["string", "string"]
      }
    `,
    config: {
      responseMimeType: "application/json",
    },
  });

  try {
    return JSON.parse(response.text || "{}");
  } catch (e) {
    return { 
      score: 0, 
      feedback: "Error evaluating answer.",
      grammar: { score: 0, details: "N/A" },
      vocabulary: { score: 0, details: "N/A" },
      coherence: { score: 0, details: "N/A" },
      suggestions: []
    };
  }
}

export async function determineLevel(
  language: string,
  answers: { question: string; answer: string; isCorrect: boolean }[]
): Promise<{ level: 'Beginner' | 'Intermediate' | 'Advanced'; explanation: string }> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `
      Based on these placement test results for ${language}, determine the user's level (Beginner, Intermediate, or Advanced).
      
      Results:
      ${JSON.stringify(answers, null, 2)}
      
      Return the response in JSON format:
      {
        "level": "Beginner" | "Intermediate" | "Advanced",
        "explanation": "string"
      }
    `,
    config: {
      responseMimeType: "application/json",
    },
  });

  try {
    return JSON.parse(response.text || "{}");
  } catch (e) {
    return { level: "Beginner", explanation: "Defaulting to beginner." };
  }
}

export async function chatWithAI(
  language: string,
  context: string,
  message: string
): Promise<string> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `
      CONTEXT:
      ${context}

      USER MESSAGE:
      ${message}

      INSTRUCTION:
      Respond to the user naturally. Since this is a language learning app, use a mix of English and ${language} (code-switching). 
      If the user is struggling, be patient and helpful. Always provide translations for words in ${language}.
      Keep responses relatively concise for a chat interface.
    `,
  });

  return response.text || "I am sorry, I am having trouble thinking right now.";
}

export async function analyzeProgress(
  language: string,
  progress: any
): Promise<string> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `
      You are a language learning coach. Analyze the user's progress in ${language} and provide specific recommendations for improvement.
      Focus on identifying weak areas from their history (scores, skill levels) and suggesting modules or study patterns.
      
      User Data:
      ${JSON.stringify(progress, null, 2)}
      
      Provide a concise summary (max 150 words) with bullet points for key areas of improvement.
      Keep it encouraging and actionable.
    `,
  });

  return response.text || "Keep at it! You're doing great. More data is needed for a specific analysis.";
}
