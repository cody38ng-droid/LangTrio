import React from 'react';
import { motion } from 'motion/react';
import { Bot, CheckCircle2, AlertCircle, ChevronRight, RefreshCcw } from 'lucide-react';
import { DetailedFeedback } from '../services/gemini';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';

interface AIFeedbackProps {
  feedback: DetailedFeedback;
  score: number;
  onContinue: () => void;
  onRetry?: () => void;
  showRetry?: boolean;
}

export const AIFeedback: React.FC<AIFeedbackProps> = ({ 
  feedback, 
  score, 
  onContinue, 
  onRetry,
  showRetry = false
}) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-8 bg-primary/5 rounded-3xl border-2 border-primary/10 space-y-8"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 rounded-2xl">
            <Bot className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-primary">AI Evaluation</h3>
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">Performance Breakdown</p>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-5xl font-black text-primary">{score}%</span>
          <span className="text-xs uppercase tracking-widest font-bold opacity-50">Overall Score</span>
        </div>
      </div>

      <div className="space-y-4">
        <p className="text-lg leading-relaxed text-foreground/80 italic font-medium">
          "{feedback.feedback}"
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Grammar/Accuracy', key: 'grammar' as const, color: 'emerald' },
          { label: 'Vocabulary', key: 'vocabulary' as const, color: 'blue' },
          { label: 'Coherence/Clarity', key: 'coherence' as const, color: 'purple' },
        ].map((item) => (
          <div key={item.key} className="p-5 bg-white/50 rounded-2xl border border-primary/5 space-y-3 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground leading-tight flex-1 min-w-0">{item.label}</span>
              <span className="text-sm font-black text-primary whitespace-nowrap">{feedback[item.key].score}%</span>
            </div>
            <Progress value={feedback[item.key].score} className="h-1.5" />
            <p className="text-[11px] leading-relaxed text-muted-foreground line-clamp-3">
              {feedback[item.key].details}
            </p>
          </div>
        ))}
      </div>

      {feedback.suggestions && feedback.suggestions.length > 0 && (
        <div className="p-6 bg-primary/10 rounded-2xl space-y-4 border border-primary/20">
          <h4 className="text-sm font-bold flex items-center gap-2 text-primary">
            <AlertCircle className="w-4 h-4" /> Areas for Improvement
          </h4>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {feedback.suggestions.map((s, i) => (
              <li key={i} className="flex gap-3 text-sm text-foreground/80 bg-white/40 p-3 rounded-xl border border-primary/5">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                  {i + 1}
                </span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 pt-4">
        {showRetry && onRetry && (
          <Button 
            variant="outline" 
            className="flex-1 h-14 text-lg rounded-xl border-2 font-bold hover:bg-primary/5 transition-colors" 
            onClick={onRetry}
          >
            <RefreshCcw className="mr-2 w-5 h-5" /> Try Again
          </Button>
        )}
        <Button 
          className="flex-[2] h-14 text-lg rounded-xl font-bold shadow-lg shadow-primary/20" 
          onClick={onContinue}
        >
          Continue to Next Step <ChevronRight className="ml-2 w-5 h-5" />
        </Button>
      </div>
    </motion.div>
  );
};
