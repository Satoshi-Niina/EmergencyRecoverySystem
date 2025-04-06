import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
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
  exportChatHistory: () => Promise<void>;
  lastExportTimestamp: Date | null;
  isExporting: boolean;
  hasUnexportedMessages: boolean;
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
  const [lastExportTimestamp, setLastExportTimestamp] = useState<Date | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [hasUnexportedMessages, setHasUnexportedMessages] = useState(false);
  const [chatId, setChatId] = useState<number | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [tempMedia, setTempMedia] = useState<{ type: string, url: string, thumbnail?: string }[]>([]);
  const { toast } = useToast();
  
  // チャットの初期化
  const initializeChat = useCallback(async () => {
    try {
      setIsInitializing(true);
      
      // 既存のチャットを取得する
      const chatsResponse = await apiRequest('GET', '/api/chats');
      
      if (!chatsResponse.ok) {
        // 認証エラーなどの場合は処理を中断
        throw new Error('チャットの取得に失敗しました');
      }
      
      const chats = await chatsResponse.json();
      
      // チャットが存在する場合は最初のチャットを使用
      if (chats && chats.length > 0) {
        setChatId(chats[0].id);
        return chats[0].id;
      }
      
      // チャットが存在しない場合は新しいチャットを作成
      const createResponse = await apiRequest('POST', '/api/chats', {
        title: '保守用車ナレッジチャット'
      });
      
      const newChat = await createResponse.json();
      setChatId(newChat.id);
      return newChat.id;
    } catch (error) {
      console.error('Failed to initialize chat:', error);
      toast({
        title: 'チャット初期化エラー',
        description: 'チャットの初期化に失敗しました。',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsInitializing(false);
    }
  }, [toast]);
  
  // コンポーネントマウント時にチャットを初期化
  useEffect(() => {
    initializeChat();
  }, [initializeChat]);

  // チャットメッセージの初期読み込み
  useEffect(() => {
    const loadMessages = async () => {
      if (!chatId) return;
      
      try {
        const response = await apiRequest('GET', `/api/chats/${chatId}/messages`);
        if (response.ok) {
          const data = await response.json();
          setMessages(data.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          })));
        }
      } catch (error) {
        console.error('Failed to load messages:', error);
      }
    };
    
    if (chatId) {
      loadMessages();
    }
  }, [chatId]);

  const sendMessage = async (content: string, mediaUrls?: { type: string, url: string, thumbnail?: string }[]) => {
    try {
      if (!chatId) {
        // チャットが初期化されていない場合は初期化
        const newChatId = await initializeChat();
        if (!newChatId) {
          throw new Error('チャットの初期化に失敗しました');
        }
      }
      
      setIsLoading(true);
      
      const currentChatId = chatId || 1;
      
      const response = await apiRequest('POST', `/api/chats/${currentChatId}/messages`, { content });
      if (!response.ok) {
        throw new Error('メッセージの送信に失敗しました');
      }
      
      const data = await response.json();
      
      // 一時保存されたメディアとパラメータで渡されたメディアを結合
      const allMedia = [
        ...(tempMedia || []),
        ...(mediaUrls || [])
      ];
      
      // Add user message to the messages state
      setMessages(prev => [
        ...prev, 
        { 
          ...data.userMessage, 
          timestamp: new Date(data.userMessage.timestamp),
          media: allMedia.length > 0 ? allMedia.map((media, idx) => ({
            id: Date.now() + idx,
            messageId: data.userMessage.id,
            ...media
          })) : []
        }
      ]);
      
      // AI 応答を検索結果として表示する
      setSearchResults([
        {
          id: data.aiMessage.id,
          title: "AIによる回答",
          type: "ai-response",
          content: data.aiMessage.content,
          timestamp: new Date(data.aiMessage.timestamp)
        }
      ]);
      
      // 一時メディアをクリア
      setTempMedia([]);
      
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
      // 一時的にメディアを保存
      const newMedia = {
        type,
        url: imageData,
        thumbnail: type === 'video' ? imageData : undefined
      };
      
      setTempMedia(prev => [...prev, newMedia]);
      
      // プレビュー用のイベントを発火
      window.dispatchEvent(new CustomEvent('preview-image', { 
        detail: { 
          url: imageData,
          isTemp: true 
        }
      }));
      
      toast({
        title: `${type === 'image' ? '画像' : '動画'}がキャプチャされました`,
        description: 'メッセージを入力して送信してください。',
      });
    } catch (error) {
      toast({
        title: 'キャプチャエラー',
        description: 'メディアのキャプチャに失敗しました。',
        variant: 'destructive',
      });
    }
  };
  
  // チャット履歴をエクスポートする関数
  const exportChatHistory = async () => {
    if (!chatId) return;
    
    try {
      setIsExporting(true);
      
      // 最後のエクスポートタイムスタンプを送信
      const response = await apiRequest(
        'POST', 
        `/api/chats/${chatId}/export`, 
        { lastExportTimestamp: lastExportTimestamp ? lastExportTimestamp.toISOString() : null }
      );
      
      const result = await response.json();
      
      if (result.success) {
        // 新しいエクスポートタイムスタンプを設定
        setLastExportTimestamp(new Date(result.exportTimestamp));
        setHasUnexportedMessages(false);
        
        toast({
          title: 'チャット履歴を送信しました',
          description: `${result.messageCount}件のメッセージが正常に送信されました。`,
        });
      }
    } catch (error) {
      toast({
        title: '履歴送信エラー',
        description: 'チャット履歴の送信に失敗しました。',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };
  
  // 最後のエクスポート履歴を取得
  const fetchLastExport = useCallback(async () => {
    if (!chatId) return;
    
    try {
      const response = await apiRequest('GET', `/api/chats/${chatId}/last-export`);
      const data = await response.json();
      
      if (data.timestamp) {
        setLastExportTimestamp(new Date(data.timestamp));
      }
    } catch (error) {
      console.error('Failed to fetch last export:', error);
    }
  }, [chatId]);
  
  // コンポーネントがマウントされたときに最後のエクスポート履歴を取得
  useEffect(() => {
    fetchLastExport();
  }, [fetchLastExport]);
  
  // メッセージが追加されたときに、未エクスポートのメッセージがあることを示す
  useEffect(() => {
    if (messages.length > 0 && lastExportTimestamp) {
      // 最後のエクスポート以降のメッセージがあるかチェック
      const hasNewMessages = messages.some(msg => new Date(msg.timestamp) > lastExportTimestamp);
      setHasUnexportedMessages(hasNewMessages);
    } else if (messages.length > 0) {
      // まだエクスポートしていない場合は、メッセージがあれば未エクスポート状態
      setHasUnexportedMessages(true);
    }
  }, [messages, lastExportTimestamp]);

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
        exportChatHistory,
        lastExportTimestamp,
        isExporting,
        hasUnexportedMessages,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};
