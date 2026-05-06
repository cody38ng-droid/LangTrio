export type Language = 'Malay' | 'Chinese' | 'English';
export type Level = 'Beginner' | 'Intermediate' | 'Advanced';
export type ModuleType = 'Comprehension' | 'Speaking' | 'Writing' | 'Listening' | 'Vocabulary' | 'Grammar';

export interface Question {
  id: string;
  type: ModuleType;
  question: string;
  options?: string[];
  correctAnswer?: string;
  audioText?: string; // For listening
  sampleAnswer?: string; // For writing/speaking
  explanation?: string; // Explanation for the correct answer
  pinyin?: string; // For Chinese pinyin
}

export interface SRSItem {
  id: string; // moduleId or questionId
  type: 'vocabulary' | 'grammar' | 'module';
  content: string; // The word, rule, or module title
  interval: number; // in days
  easeFactor: number; // default 2.5
  nextReview: string; // ISO date
  repetitions: number;
}

export interface UserProgress {
  language: Language;
  overallLevel: Level;
  sectionLevels: Record<ModuleType, Level>;
  sectionStreaks: Record<ModuleType, number>; // Number of times scored >= 80%
  completedModules: string[];
  moduleHistory: Record<string, { score: number; date: string }[]>; // moduleId -> history
  srsItems: SRSItem[];
  earnedBadges: string[];
}

export interface Module {
  id: string;
  language: Language;
  level: Level;
  type: ModuleType;
  title: string;
  description: string;
  questions: Question[];
}
