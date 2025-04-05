import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { startSpeechRecognition, stopSpeechRecognition } from '@/lib/azure-speech';
import { searchByText } from '@/lib/image-search';

interface Media {
  id: number;
  messageId: number;
  type: string;
  url: string;
  thumbnail?: string;
}

interface Message {
  id: number;
  content: string;
  senderId: number | null;
  isAiResponse: boolean;
  timestamp: Date;
  chatId: number;
  media?: Media[];
}

interface ChatContextValue {
  messages: Message[];
  isLoading: boolean;
  searching: boolean;
  searchResults: any[];
  selectedText: string;
  setSelectedText: (text: string) => void;
  sendMessage: (content: string, mediaUrls?: { type: string, url: string, thumbnail?: string }[]) => Promise<void>;
  startRecording: () => void;
  stopRecording: () => void;
  isRecording: boolean;
  recordedText: string;
  searchBySelectedText: (text: string) => Promise<void>;
  clearSearchResults: () => void;
  captureImage: (imageData: string, type: 'image' | 'video') => Promise<void>;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export const useChat = () => {
  const context = useContext(ChatContext);
  if (context === null) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
};

export const ChatProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedText, setRecordedText] = useState('');
  const [selectedText, setSelectedText] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const { toast } = useToast();

  const sendMessage = async (content: string, mediaUrls?: { type: string, url: string, thumbnail?: string }[]) => {
    try {
      setIsLoading(true);
      
      // Create a default chat if none exists
      let chatId = 1; // For simplicity in this implementation
      
      const response = await apiRequest('POST', `/api/chats/${chatId}/messages`, { content });
      const data = await response.json();
      
      // Add user message and AI response to the state
      setMessages(prev => [
        ...prev, 
        { 
          ...data.userMessage, 
          timestamp: new Date(data.userMessage.timestamp),
          media: mediaUrls ? mediaUrls.map((media, idx) => ({
            id: Date.now() + idx,
            messageId: data.userMessage.id,
            ...media
          })) : []
        },
        { 
          ...data.aiMessage, 
          timestamp: new Date(data.aiMessage.timestamp),
          media: []
        }
      ]);
      
      setRecordedText('');
    } catch (error) {
      toast({
        title: 'メッセージ送信エラー',
        description: 'メッセージを送信できませんでした。',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const startRecording = useCallback(() => {
    setIsRecording(true);
    startSpeechRecognition((text) => {
      setRecordedText(prev => prev + ' ' + text);
    }, (error) => {
      toast({
        title: '音声認識エラー',
        description: error,
        variant: 'destructive',
      });
      setIsRecording(false);
    });
  }, [toast]);

  const stopRecording = useCallback(() => {
    setIsRecording(false);
    stopSpeechRecognition();
  }, []);

  const searchBySelectedText = async (text: string) => {
    try {
      setSearching(true);
      const results = await searchByText(text);
      setSearchResults(results);
    } catch (error) {
      toast({
        title: '検索エラー',
        description: '検索に失敗しました。',
        variant: 'destructive',
      });
    } finally {
      setSearching(false);
    }
  };

  const clearSearchResults = () => {
    setSearchResults([]);
  };

  const captureImage = async (imageData: string, type: 'image' | 'video') => {
    try {
      // In a real implementation, you would upload this to a server
      // For now, we'll just add it to the message directly
      const content = type === 'image' ? '画像を共有しました' : '動画を共有しました';
      await sendMessage(content, [
        {
          type,
          url: imageData,
          thumbnail: type === 'video' ? imageData : undefined
        }
      ]);
      
      toast({
        title: `${type === 'image' ? '画像' : '動画'}がアップロードされました`,
        description: 'メディアが正常にアップロードされました。',
      });
    } catch (error) {
      toast({
        title: 'アップロードエラー',
        description: 'メディアのアップロードに失敗しました。',
        variant: 'destructive',
      });
    }
  };

  return (
    <ChatContext.Provider
      value={{
        messages,
        isLoading,
        searching,
        searchResults,
        selectedText,
        setSelectedText,
        sendMessage,
        startRecording,
        stopRecording,
        isRecording,
        recordedText,
        searchBySelectedText,
        clearSearchResults,
        captureImage,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};
