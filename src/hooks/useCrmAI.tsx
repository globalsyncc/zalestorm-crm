import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface LeadScore {
  score: number;
  reasons: string[];
  recommendations: string[];
}

interface SuggestedAction {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  type: 'call' | 'email' | 'meeting' | 'task';
}

interface DraftEmail {
  subject: string;
  body: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crm-ai`;

export function useCrmAI() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const streamChat = useCallback(async (userMessage: string) => {
    const userMsg: Message = { role: 'user', content: userMessage };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    let assistantContent = '';

    try {
      // Get user session for proper JWT authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Session expirée, veuillez vous reconnecter');
      }

      const response = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`, // Use JWT instead of anon key
        },
        body: JSON.stringify({
          action: 'chat',
          messages: [...messages, userMsg],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur de connexion');
      }

      if (!response.body) throw new Error('Pas de réponse');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') {
                  return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantContent } : m));
                }
                return [...prev, { role: 'assistant', content: assistantContent }];
              });
            }
          } catch {
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      toast({
        title: 'Erreur',
        description: error instanceof Error ? error.message : 'Erreur de connexion IA',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [messages, toast]);

  const getLeadScore = useCallback(async (context: any): Promise<LeadScore | null> => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('crm-ai', {
        body: { action: 'lead_scoring', context },
      });
      if (error) throw error;
      return data as LeadScore;
    } catch (error) {
      console.error('Lead scoring error:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de calculer le score',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const getSuggestedActions = useCallback(async (context: any): Promise<SuggestedAction[] | null> => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('crm-ai', {
        body: { action: 'suggest_actions', context },
      });
      if (error) throw error;
      return data?.actions || [];
    } catch (error) {
      console.error('Suggestions error:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de générer les suggestions',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const draftEmail = useCallback(async (context: any): Promise<DraftEmail | null> => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('crm-ai', {
        body: { action: 'draft_email', context },
      });
      if (error) throw error;
      return data as DraftEmail;
    } catch (error) {
      console.error('Draft email error:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de rédiger l\'email',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    isLoading,
    streamChat,
    getLeadScore,
    getSuggestedActions,
    draftEmail,
    clearMessages,
  };
}
