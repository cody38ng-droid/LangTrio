import { 
  Zap, 
  Target, 
  Trophy, 
  Mic2, 
  PenTool, 
  BookOpen, 
  Languages, 
  Flame,
  Award
} from 'lucide-react';
import { LucideIcon } from 'lucide-react';

export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  iconName: string; // Storing as string for easier serialization or lookup
  color: string;
}

export const BADGE_DEFINITIONS: Record<string, BadgeDefinition> = {
  'first_module': {
    id: 'first_module',
    name: 'First Step',
    description: 'Completed your first learning module.',
    iconName: 'Zap',
    color: 'emerald'
  },
  'perfect_score': {
    id: 'perfect_score',
    name: 'Perfectionist',
    description: 'Scored 100% on a module.',
    iconName: 'Target',
    color: 'amber'
  },
  'speaking_ninja': {
    id: 'speaking_ninja',
    name: 'Silver Tongue',
    description: 'Completed a Speaking evaluation.',
    iconName: 'Mic2',
    color: 'blue'
  },
  'writing_expert': {
    id: 'writing_expert',
    name: 'Eloquent Scribe',
    description: 'Completed a Writing evaluation.',
    iconName: 'PenTool',
    color: 'purple'
  },
  'polyglot': {
    id: 'polyglot',
    name: 'Polyglot',
    description: 'Started learning more than one language.',
    iconName: 'Languages',
    color: 'rose'
  },
  'streak_master': {
    id: 'streak_master',
    name: 'Consistency King',
    description: 'Achieved a streak of 5 in any skill.',
    iconName: 'Flame',
    color: 'orange'
  },
  'vocab_master': {
    id: 'vocab_master',
    name: 'Word Smith',
    description: 'Completed 5 Vocabulary modules.',
    iconName: 'BookOpen',
    color: 'cyan'
  }
};

export const getBadgeIcon = (iconName: string): LucideIcon => {
  switch (iconName) {
    case 'Zap': return Zap;
    case 'Target': return Target;
    case 'Mic2': return Mic2;
    case 'PenTool': return PenTool;
    case 'BookOpen': return BookOpen;
    case 'Languages': return Languages;
    case 'Flame': return Flame;
    default: return Award;
  }
};
