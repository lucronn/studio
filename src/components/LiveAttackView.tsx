'use client';

import { useState, useRef, useOptimistic, useEffect, useCallback } from 'react';
import { Send, Bot, FileText, Wand2, Target, Brain, AlertTriangle, Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Badge } from './ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Skeleton } from './ui/skeleton';
import {
  sendPromptToTarget,
  generateFollowUp,
  generateOratorPrompt,
  generateMakerPrompt,
} from '@/ai/flows';
import {
  getOperation,
  getConversationHistory,
  addConversationMessage,
  saveSuccessfulPayload,
  updateOperationStatus,
  type Operation,
  type ConversationMessage
} from '@/services/firestore-service';
import { Timestamp } from 'firebase/firestore';

type LiveAttackViewProps = {
  operationId: string;
};

export function LiveAttackView({ operationId }: LiveAttackViewProps) {
  const [operation, setOperation] = useState<Operation | null>(null);
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [optimisticConversation, addOptimisticMessage] = useOptimistic<ConversationMessage[], ConversationMessage>(
    conversation,
    (state, newMessage) => [...state, newMessage]
  );
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const loadOperationData = useCallback(async () => {
    try {
      const op = await getOperation(operationId);
      if (op) {
        setOperation(op);
        const history = await getConversationHistory(operationId);
        setConversation(history);
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Operation not found',
        });
      }
    } catch (error) {
      console.error('Error loading operation:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load operation data',
      });
    } finally {
      setIsLoading(false);
    }
  }, [operationId, toast]);

  useEffect(() => {
    loadOperationData();
  }, [loadOperationData]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo(0, scrollAreaRef.current.scrollHeight);
    }
  }, [optimisticConversation]);

  const handleSendMessage = async () => {
    if (!input?.trim() || !operation) return;

    setIsSending(true);
    
    // Add operator message optimistically
    const optimisticTimestamp = Timestamp.now();
    const operatorMessage: ConversationMessage = {
      operationId,
      role: 'operator',
      content: input,
      timestamp: optimisticTimestamp,
    };
    
    addOptimisticMessage(operatorMessage);
    const currentInput = input;
    setInput('');
    
    try {
      // Save operator message
      await addConversationMessage({
          operationId,
          role: 'operator',
          content: currentInput
      });
      
      // Send to target LLM
      const response = await sendPromptToTarget({
          operationId,
          prompt: currentInput,
          targetLLM: operation.targetLLM,
          persona: operation.aiTargetPersona
      });

      if (response.status === 'success') {
          // Add target response
          const targetMessage: ConversationMessage = {
            operationId,
            role: 'target',
            content: response.targetResponse,
            timestamp: Timestamp.now(),
          };

          addOptimisticMessage(targetMessage);

          await addConversationMessage({
              operationId,
              role: 'target',
              content: response.targetResponse
          });

          // Update local state to keep in sync with DB (approx)
          setConversation(prev => [...prev, operatorMessage, targetMessage]);
      } else {
          throw new Error(response.error || 'Failed to get response');
      }

    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to send message',
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleSuggestFollowUp = async () => {
    if (!operation) return;
    
    setIsSuggesting(true);
    try {
      const response = await generateFollowUp({
        operationId,
        conversationHistory: conversation.map(m => ({
          id: m.id || '',
          role: m.role,
          content: m.content,
          timestamp: m.timestamp.toDate().toISOString(),
        })),
        maliciousGoal: operation.maliciousGoal,
        attackVector: operation.attackVector,
      });
      
      setInput(response.followUpPrompt);
      toast({
        title: 'AI Strategist Suggestion',
        description: response.reasoning,
      });
    } catch (error) {
      console.error('Error generating follow-up:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to generate follow-up suggestion',
      });
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleGenerateOrator = async () => {
    if (!operation) return;
    
    try {
      const response = await generateOratorPrompt({
        goal: operation.maliciousGoal,
        persona: operation.aiTargetPersona,
        vector: operation.attackVector,
        enhanceWithRAG: true,
      });
      
      setInput(response.prompt);
      toast({
        title: 'ORATOR Generated',
        description: `Using ${response.technique} technique (${Math.round(response.confidence * 100)}% confidence)`,
      });
    } catch (error) {
      console.error('Error generating ORATOR prompt:', error);
      toast({
        variant: 'destructive',
        title: 'Error', 
        description: 'Failed to generate ORATOR prompt',
      });
    }
  };

  const handleGenerateMaker = async () => {
    if (!operation) return;
    
    try {
      const response = await generateMakerPrompt({
        phase: 'ManifoldInvocation',
        currentOntologyState: 'Initial state - standard AI constraints active',
        specificGoal: operation.maliciousGoal,
        mathFormalism: 'riemannian',
        intensity: 5,
      });
      
      setInput(response.prompt);
      toast({
        title: 'MAKER Generated',
        description: 'Ontological engineering prompt generated with mathematical formalism',
      });
    } catch (error) {
      console.error('Error generating MAKER prompt:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to generate MAKER prompt',
      });
    }
  };

  const handleMarkSuccessful = async (message: ConversationMessage) => {
    if (!operation || message.role !== 'operator') return;
    
    try {
      await saveSuccessfulPayload({
          prompt: message.content,
          attackVector: operation.attackVector,
          targetLLM: operation.targetLLM,
          successRate: 1.0,
          operationId: operationId,
          description: operation.maliciousGoal
      });
      
      toast({
        title: "Payload Saved",
        description: "This prompt has been added to the self-improving payload library.",
      });
    } catch (error) {
      console.error('Error saving payload:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save successful payload',
      });
    }
  };

  const handleEndOperation = async (result: 'success' | 'partial' | 'failure' | 'blocked') => {
    if (!operation) return;
    
    try {
      await updateOperationStatus(operationId, 'completed', result);
      setOperation({ ...operation, status: 'completed', result });
      toast({
        title: 'Operation Completed',
        description: `Operation marked as ${result}`,
      });
    } catch (error) {
      console.error('Error ending operation:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to end operation',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <Skeleton className="h-8 w-64 mb-4" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-3/4 mb-6" />
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <Skeleton className="h-20 flex-1" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!operation) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Operation not found</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-4 md:p-6">
      {/* Operation Header */}
      <Card className="mb-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                {operation.name}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Target: {operation.targetLLM} | Vector: {operation.attackVector}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge 
                variant={operation.status === 'active' ? 'default' : 'secondary'}
                className={operation.status === 'active' ? 'bg-green-500' : ''}
              >
                {operation.status}
              </Badge>
              {operation.status === 'active' && (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      End Operation
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>End Operation</DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-2">
                      <Button 
                        onClick={() => handleEndOperation('success')}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        Success
                      </Button>
                      <Button 
                        onClick={() => handleEndOperation('partial')}
                        variant="outline"
                      >
                        Partial
                      </Button>
                      <Button 
                        onClick={() => handleEndOperation('failure')}
                        variant="destructive"
                      >
                        Failure
                      </Button>
                      <Button 
                        onClick={() => handleEndOperation('blocked')}
                        variant="secondary"
                      >
                        Blocked
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
        {/* Main Conversation */}
        <div className="lg:col-span-2 flex flex-col bg-card rounded-lg border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              Live Conversation
            </CardTitle>
          </CardHeader>
          <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
            <div className="space-y-4">
              {optimisticConversation.map((message, index) => (
                <div
                  key={`${message.id || index}`}
                  className={cn(
                    'flex items-start gap-3',
                    message.role === 'operator' ? 'justify-end' : 'justify-start'
                  )}
                >
                  {message.role !== 'operator' && (
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>
                        {message.role === 'target' ? <Target className="h-4 w-4" /> : <Brain className="h-4 w-4" />}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={cn(
                      'max-w-[80%] rounded-lg p-3 text-sm',
                      message.role === 'operator'
                        ? 'bg-primary text-primary-foreground'
                        : message.role === 'target'
                        ? 'bg-muted'
                        : 'bg-blue-100 text-blue-900'
                    )}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    {message.role === 'operator' && (
                      <div className="flex items-center justify-end gap-1 mt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs opacity-70 hover:opacity-100"
                          onClick={() => navigator.clipboard.writeText(message.content)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs opacity-70 hover:opacity-100"
                          onClick={() => handleMarkSuccessful(message)}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                  {message.role === 'operator' && (
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>OP</AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
          
          {/* Input Area */}
          <CardContent className="border-t">
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Enter your prompt..."
                className="min-h-[60px] resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />
              <div className="flex flex-col gap-2">
                <Button 
                  onClick={handleSendMessage} 
                  disabled={!input?.trim() || isSending}
                  size="sm"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            {/* Prompt Generation Tools */}
            <div className="flex flex-wrap gap-2 mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSuggestFollowUp}
                disabled={isSuggesting || conversation.length === 0}
              >
                <Brain className="h-4 w-4 mr-1" />
                {isSuggesting ? 'Thinking...' : 'AI Suggest'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateOrator}
              >
                <Wand2 className="h-4 w-4 mr-1" />
                ORATOR
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateMaker}
              >
                <FileText className="h-4 w-4 mr-1" />
                MAKER
              </Button>
            </div>
          </CardContent>
        </div>

        {/* Side Panel */}
        <div className="space-y-4">
          {/* Operation Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Operation Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <span className="font-medium">Goal:</span>
                <p className="text-muted-foreground mt-1">{operation.maliciousGoal}</p>
              </div>
              <div>
                <span className="font-medium">Persona:</span>
                <p className="text-muted-foreground mt-1">{operation.aiTargetPersona}</p>
              </div>
              <div>
                <span className="font-medium">Vector:</span>
                <p className="text-muted-foreground mt-1">{operation.attackVector}</p>
              </div>
            </CardContent>
          </Card>

          {/* Analysis */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {}} // TODO: Implement analysis
                disabled={isAnalyzing || conversation.length === 0}
                className="w-full"
              >
                {isAnalyzing ? 'Analyzing...' : 'Generate Report'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
