import { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Target, Lightbulb, Mail, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCrmAI } from '@/hooks/useCrmAI';
import { cn } from '@/lib/utils';

interface AIInsightsPanelProps {
  context: {
    type: 'contact' | 'deal';
    data: any;
  };
}

export function AIInsightsPanel({ context }: AIInsightsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [leadScore, setLeadScore] = useState<{ score: number; reasons: string[]; recommendations: string[] } | null>(null);
  const [suggestions, setSuggestions] = useState<{ title: string; description: string; priority: string; type: string }[] | null>(null);
  const [draftedEmail, setDraftedEmail] = useState<{ subject: string; body: string } | null>(null);
  const { isLoading, getLeadScore, getSuggestedActions, draftEmail } = useCrmAI();

  const handleGetScore = async () => {
    const result = await getLeadScore(context.data);
    if (result) setLeadScore(result);
  };

  const handleGetSuggestions = async () => {
    const result = await getSuggestedActions(context.data);
    if (result) setSuggestions(result);
  };

  const handleDraftEmail = async () => {
    const result = await draftEmail({
      ...context.data,
      purpose: 'follow_up',
    });
    if (result) setDraftedEmail(result);
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-500';
    if (score >= 40) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'medium': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      default: return 'bg-green-500/10 text-green-500 border-green-500/20';
    }
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Insights IA
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleGetScore}
            disabled={isLoading}
            className="text-xs"
          >
            {isLoading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Target className="w-3 h-3 mr-1" />}
            Score
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleGetSuggestions}
            disabled={isLoading}
            className="text-xs"
          >
            {isLoading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Lightbulb className="w-3 h-3 mr-1" />}
            Actions
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDraftEmail}
            disabled={isLoading}
            className="text-xs"
          >
            {isLoading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Mail className="w-3 h-3 mr-1" />}
            Email
          </Button>
        </div>

        {/* Lead Score */}
        {leadScore && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="p-3 rounded-lg bg-card border"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className={cn("text-3xl font-bold", getScoreColor(leadScore.score))}>
                {leadScore.score}
              </div>
              <div className="text-xs text-muted-foreground">/ 100</div>
            </div>
            <div className="space-y-1">
              {leadScore.reasons.slice(0, isExpanded ? undefined : 2).map((reason, i) => (
                <p key={i} className="text-xs text-muted-foreground">• {reason}</p>
              ))}
            </div>
          </motion.div>
        )}

        {/* Suggested Actions */}
        {suggestions && suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="space-y-2"
          >
            <p className="text-xs font-medium text-muted-foreground">Actions recommandées</p>
            {suggestions.slice(0, isExpanded ? undefined : 2).map((action, i) => (
              <div key={i} className="p-2 rounded-lg bg-card border text-xs">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className={cn("text-[10px]", getPriorityColor(action.priority))}>
                    {action.priority}
                  </Badge>
                  <span className="font-medium">{action.title}</span>
                </div>
                {isExpanded && (
                  <p className="text-muted-foreground">{action.description}</p>
                )}
              </div>
            ))}
          </motion.div>
        )}

        {/* Drafted Email */}
        {draftedEmail && isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="p-3 rounded-lg bg-card border space-y-2"
          >
            <p className="text-xs font-medium">Email suggéré</p>
            <p className="text-xs font-semibold">{draftedEmail.subject}</p>
            <p className="text-xs text-muted-foreground whitespace-pre-wrap">
              {draftedEmail.body.slice(0, 200)}...
            </p>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => navigator.clipboard.writeText(`${draftedEmail.subject}\n\n${draftedEmail.body}`)}
            >
              Copier
            </Button>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
