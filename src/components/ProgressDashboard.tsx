import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  Trophy, 
  TrendingUp, 
  Target, 
  ChevronRight, 
  Star, 
  Clock, 
  BookOpen, 
  BarChart, 
  AlertCircle,
  BrainCircuit,
  Award,
  Zap,
  RefreshCcw,
  Power
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  Radar,
  AreaChart,
  Area
} from 'recharts';
import { Language, UserProgress, ModuleType, Level } from '../types';
import { MODULES } from '../data';
import { BADGE_DEFINITIONS, getBadgeIcon } from '../constants/badges';

interface ProgressDashboardProps {
  progress: Record<Language, UserProgress | null>;
  onClose: () => void;
  onAnalyzeProgress: (lang: Language) => void;
  aiFeedback: Record<Language, string | null>;
  isAnalyzing: boolean;
}

const levelToScore = (level: Level): number => {
  switch (level) {
    case 'Beginner': return 33;
    case 'Intermediate': return 66;
    case 'Advanced': return 100;
    default: return 0;
  }
};

export const ProgressDashboard: React.FC<ProgressDashboardProps> = ({ 
  progress, 
  onClose, 
  onAnalyzeProgress,
  aiFeedback,
  isAnalyzing
}) => {
  const activeLanguages = useMemo(() => 
    Object.keys(progress).filter(lang => progress[lang as Language] !== null) as Language[]
  , [progress]);

  const statsByLanguage = useMemo(() => {
    return activeLanguages.map(lang => {
      const langProgress = progress[lang]!;
      const completedCount = langProgress.completedModules.length;
      const totalAvailable = MODULES.filter(m => m.language === lang).length;
      
      // Calculate overall accuracy
      const historyValues = Object.values(langProgress.moduleHistory) as { score: number; date: string }[][];
      const allScores = historyValues.flatMap(h => h.map(e => e.score));
      const avgScore = allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0;

      // Prepare data for line chart (score history)
      const chronology = historyValues
        .flatMap(h => h)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(-10) // Last 10 results
        .map((entry, idx) => ({
          name: `Attempt ${idx + 1}`,
          score: entry.score,
          date: new Date(entry.date).toLocaleDateString()
        }));

      // Prepare data for skill radar
      const skillData = [
        { subject: 'Listening', value: levelToScore(langProgress.sectionLevels.Listening), fullMark: 100 },
        { subject: 'Speaking', value: levelToScore(langProgress.sectionLevels.Speaking), fullMark: 100 },
        { subject: 'Writing', value: levelToScore(langProgress.sectionLevels.Writing), fullMark: 100 },
        { subject: 'Comprehension', value: levelToScore(langProgress.sectionLevels.Comprehension), fullMark: 100 },
        { subject: 'Vocabulary', value: levelToScore(langProgress.sectionLevels.Vocabulary), fullMark: 100 },
        { subject: 'Grammar', value: levelToScore(langProgress.sectionLevels.Grammar), fullMark: 100 },
      ];

      return {
        lang,
        completedCount,
        totalAvailable,
        avgScore,
        chronology,
        skillData,
        overallLevel: langProgress.overallLevel,
        streaks: langProgress.sectionStreaks,
        badges: langProgress.earnedBadges || []
      };
    });
  }, [progress, activeLanguages]);

  if (activeLanguages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center space-y-6">
        <TrendingUp className="w-16 h-16 text-muted-foreground/30" />
        <div className="space-y-2">
          <h3 className="text-2xl font-bold">No Progress Recorded Yet</h3>
          <p className="text-muted-foreground max-w-sm">
            Start a placement test or complete a module to see your proficiency growth and statistics here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12 p-2 md:p-6 pb-20">
      {statsByLanguage.map((stats) => (
        <motion.div
          key={stats.lang}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                  {stats.overallLevel}
                </Badge>
                <h2 className="text-3xl font-black tracking-tight">{stats.lang} Proficiency</h2>
              </div>
              <p className="text-muted-foreground">Detailed performance analysis and skill distribution.</p>
            </div>
            
            <div className="flex items-center gap-3">
               <div className="text-right hidden md:block">
                  <p className="text-xs font-bold uppercase text-muted-foreground tracking-widest leading-none">Modules Completed</p>
                  <p className="text-2xl font-black tabular-nums">{stats.completedCount} / {stats.totalAvailable}</p>
               </div>
               <TrendingUp className="w-8 h-8 text-primary/40" />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Accuracy & Progress Overall */}
            <Card className="col-span-1 border-2 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Target className="w-4 h-4" /> Performance Metrics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-medium">Curriculum Coverage</span>
                    <Badge variant="secondary" className="font-bold">{Math.round((stats.completedCount / stats.totalAvailable) * 100)}%</Badge>
                  </div>
                  <Progress value={(stats.completedCount / stats.totalAvailable) * 100} className="h-3" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-secondary/30 border-2 border-secondary space-y-1">
                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Average Score</p>
                    <p className="text-3xl font-black text-primary">{Math.round(stats.avgScore)}%</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-primary/5 border-2 border-primary/10 space-y-1">
                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Global Rank</p>
                    <div className="flex items-baseline gap-1">
                      <p className="text-3xl font-black text-primary">#42</p>
                      <span className="text-[10px] font-bold text-muted-foreground">TOP 5%</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t space-y-4">
                   <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Skill Weaknesses</h4>
                   {Object.entries(stats.streaks as Record<string, number>).map(([skill, val]) => (
                     <div key={skill} className="flex items-center justify-between">
                       <span className="text-sm font-medium">{skill}</span>
                       <div className="flex gap-0.5">
                         {[1, 2, 3, 4, 5].map(i => (
                           <div 
                             key={i} 
                             className={`w-4 h-2 rounded-full ${i <= (val % 6) ? 'bg-primary' : 'bg-muted'}`} 
                           />
                         ))}
                       </div>
                     </div>
                   ))}
                </div>
              </CardContent>
            </Card>

            {/* Score History Chart */}
            <Card className="col-span-1 lg:col-span-2 border-2 shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <BarChart className="w-4 h-4" /> Score Growth Trend
                </CardTitle>
                <CardDescription>Visualizing your last 10 module attempts</CardDescription>
              </CardHeader>
              <CardContent className="h-[450px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.chronology}>
                    <defs>
                      <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fontWeight: 600 }}
                    />
                    <YAxis 
                      domain={[0, 100]} 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fontWeight: 600 }}
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="score" 
                      stroke="var(--primary)" 
                      strokeWidth={4}
                      fillOpacity={1} 
                      fill="url(#colorScore)" 
                      animationDuration={1500}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* AI Analysis Section */}
            <Card className="lg:col-span-3 border-2 border-primary/20 bg-primary/5 overflow-hidden">
               <div className="grid grid-cols-1 md:grid-cols-4 min-h-[220px]">
                  <div className="col-span-1 p-8 flex flex-col justify-center items-center text-center bg-white/40 border-b md:border-b-0 md:border-r border-primary/10">
                     <div className="space-y-4 mb-6 flex flex-col items-center">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                           <BrainCircuit className="w-6 h-6" />
                        </div>
                        <div className="space-y-0.5">
                           <h3 className="font-black text-xl leading-tight">LingoAI Coach</h3>
                           <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em]">Smart Analysis</p>
                        </div>
                     </div>
                     
                     <div className="relative group">
                        {/* Glow effect */}
                        <div className={`absolute inset-0 rounded-full blur-xl transition-all duration-1000 ${isAnalyzing ? 'bg-primary/40 animate-pulse' : 'bg-primary/20 group-hover:bg-primary/30'}`} />
                        
                        <Button 
                          onClick={() => onAnalyzeProgress(stats.lang)}
                          disabled={isAnalyzing}
                          className={`
                            relative w-20 h-20 rounded-full flex flex-col items-center justify-center gap-1
                            border-[4px] border-white shadow-2xl transition-all duration-500
                            ${isAnalyzing 
                              ? 'bg-primary scale-95 shadow-[inset_0_4px_10px_rgba(0,0,0,0.2)]' 
                              : 'bg-slate-900 hover:scale-110 active:scale-95 shadow-primary/20'
                            }
                          `}
                        >
                          <div className={`transition-all duration-500 ${isAnalyzing ? 'rotate-180 text-white' : 'text-primary animate-pulse'}`}>
                             {isAnalyzing ? (
                               <RefreshCcw className="w-8 h-8 animate-spin" />
                             ) : (
                               <Power className="w-8 h-8" />
                             )}
                          </div>
                          <span className={`text-[8px] font-black uppercase tracking-widest ${isAnalyzing ? 'text-white/80' : 'text-primary/80'}`}>
                            {isAnalyzing ? "Active" : "Engage"}
                          </span>
                        </Button>
                     </div>
                  </div>
                  
                  <div className="col-span-3 p-6 flex flex-col">
                     <ScrollArea className="flex-1 w-full rounded-md pr-4">
                        {aiFeedback[stats.lang] ? (
                          <div className="prose prose-sm dark:prose-invert max-w-none">
                            <h4 className="flex items-center gap-2 text-primary">
                              <Target className="w-4 h-4" /> 
                              Recommended Areas for Improvement
                            </h4>
                            <div className="text-sm leading-relaxed text-muted-foreground">
                              {aiFeedback[stats.lang]?.split('\n').map((line, i) => (
                                <p key={i} className="mb-2">{line}</p>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center text-center space-y-2 opacity-50">
                             <AlertCircle className="w-8 h-8" />
                             <p className="text-sm font-medium">Tap 'Refresh Insights' for personalized study recommendations based on your performance history.</p>
                          </div>
                        )}
                     </ScrollArea>
                  </div>
               </div>
            </Card>

            {/* Skill Radar */}
            <Card className="col-span-1 lg:col-span-1 border-2 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Award className="w-4 h-4" /> Skill Balance
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={stats.skillData}>
                      <PolarGrid strokeOpacity={0.1} />
                      <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fontWeight: 700 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} axisLine={false} tick={false} />
                      <Radar
                        name="Skills"
                        dataKey="value"
                        stroke="var(--primary)"
                        fill="var(--primary)"
                        fillOpacity={0.6}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* History Table */}
            <Card className="col-span-1 lg:col-span-2 border-2 shadow-sm overflow-hidden">
               <CardHeader className="border-b bg-muted/30">
                  <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Recent Module Activity</CardTitle>
               </CardHeader>
               <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-muted/30 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                          <th className="px-4 py-3 border-b">Module</th>
                          <th className="px-4 py-3 border-b">Type</th>
                          <th className="px-4 py-3 border-b">Date</th>
                          <th className="px-4 py-3 border-b text-right">Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(Object.entries(progress[stats.lang]!.moduleHistory) as [string, { score: number; date: string }[]][])
                          .flatMap(([id, attempts]) => attempts.map(a => ({ id, ...a })))
                          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                          .slice(0, 5)
                          .map((entry, i) => {
                            const mod = MODULES.find(m => m.id === entry.id);
                            return (
                              <tr key={i} className="group hover:bg-muted/50 transition-colors">
                                <td className="px-4 py-3 text-sm font-bold tracking-tight border-b">{mod?.title || entry.id}</td>
                                <td className="px-4 py-3 text-xs border-b">
                                  <Badge variant="secondary" className="text-[9px] font-black uppercase">
                                    {mod?.type}
                                  </Badge>
                                </td>
                                <td className="px-4 py-3 text-xs text-muted-foreground border-b">{new Date(entry.date).toLocaleDateString()}</td>
                                <td className="px-4 py-3 text-sm font-black text-right border-b">
                                   <span className={entry.score >= 80 ? "text-emerald-500" : entry.score >= 50 ? "text-amber-500" : "text-rose-500"}>
                                      {entry.score}%
                                   </span>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                  {Object.values(progress[stats.lang]!.moduleHistory).length === 0 && (
                    <div className="p-8 text-center text-sm text-muted-foreground italic">
                       No activity recorded yet.
                    </div>
                  )}
               </CardContent>
            </Card>

            {/* Hall of Badges */}
            <Card className="col-span-1 lg:col-span-3 border-2 shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-yellow-500" /> Hall of Badges
                </CardTitle>
                <CardDescription>Accomplishments and milestones you've achieved.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-6">
                  {stats.badges.length > 0 ? (
                    stats.badges.map(badgeId => {
                      const def = BADGE_DEFINITIONS[badgeId];
                      if (!def) return null;
                      const Icon = getBadgeIcon(def.iconName);
                      return (
                        <motion.div 
                          key={badgeId}
                          whileHover={{ scale: 1.05 }}
                          className="flex flex-col items-center space-y-2 w-28 text-center"
                        >
                          <div className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg bg-${def.color}-500/20 border-2 border-${def.color}-500 text-${def.color}-500`}>
                             <Icon className="w-8 h-8" />
                          </div>
                          <div>
                            <p className="text-xs font-black tracking-tight">{def.name}</p>
                            <p className="text-[9px] text-muted-foreground leading-tight px-1">{def.description}</p>
                          </div>
                        </motion.div>
                      );
                    })
                  ) : (
                    <div className="w-full py-12 flex flex-col items-center justify-center text-center space-y-3 opacity-30">
                       <Award className="w-12 h-12" />
                       <p className="text-sm font-medium italic">Complete more modules to earn badges!</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </motion.div>
      ))}
    </div>
  );
};
