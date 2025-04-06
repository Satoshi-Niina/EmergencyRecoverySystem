import { useEffect, useState } from "react";
import { useChat } from "@/context/chat-context";
import MessageBubble from "@/components/chat/message-bubble";
import MessageInput from "@/components/chat/message-input";
import TextSelectionControls from "@/components/chat/text-selection-controls";
import SearchResults from "@/components/chat/search-results";
import CameraModal from "@/components/chat/camera-modal";
import ImagePreviewModal from "@/components/chat/image-preview-modal";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Send, AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

export default function Chat() {
  const {
    messages,
    isLoading,
    selectedText,
    setSelectedText,
    searchBySelectedText,
    searchResults,
    clearSearchResults,
    exportChatHistory,
    lastExportTimestamp,
    isExporting,
    hasUnexportedMessages,
    draftMessage,
    clearChatHistory,
    isClearing
  } = useChat();
  
  const [isEndChatDialogOpen, setIsEndChatDialogOpen] = useState(false);

  // Fetch messages for the current chat
  const { data, isLoading: messagesLoading } = useQuery({
    queryKey: ['/api/chats/1/messages'],
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  useEffect(() => {
    // Handle text selection
    const handleSelection = () => {
      const selection = window.getSelection();
      if (selection && selection.toString().trim().length > 0) {
        setSelectedText(selection.toString().trim());
      } else {
        setSelectedText("");
      }
    };

    document.addEventListener("mouseup", handleSelection);
    return () => {
      document.removeEventListener("mouseup", handleSelection);
    };
  }, [setSelectedText]);

  // Show messages from the context or from the query
  const displayMessages = messages?.length > 0 ? messages : (data as any[] || []);
  
  // メッセージクリア時にデータも更新
  useEffect(() => {
    // messagesが空になった場合（クリアされた場合）はリロードして再読み込み
    if (messages !== undefined && messages.length === 0 && !isClearing) {
      // 読み込み完了後に再フェッチ
      queryClient.invalidateQueries({ queryKey: ['/api/chats/1/messages'] });
    }
  }, [messages]);

  // チャット終了確認ダイアログを表示
  const handleEndChat = () => {
    if (hasUnexportedMessages) {
      setIsEndChatDialogOpen(true);
    } else {
      // 未送信のメッセージがなければそのまま終了（ここでは単純にトップページに戻るなど）
      window.location.href = "/";
    }
  };

  // チャットを送信して終了
  const handleSendAndEnd = async () => {
    await exportChatHistory();
    setIsEndChatDialogOpen(false);
    // 送信後にページを移動
    window.location.href = "/";
  };

  return (
    <div className="flex flex-col w-full h-full bg-blue-50">
      <div className="border-b border-blue-200 p-3 flex justify-between items-center bg-blue-100">
        <h1 className="text-xl font-bold text-blue-800">緊急復旧サポート</h1>
        <div className="flex items-center gap-3">
          {/* チャット履歴クリアボタン */}
          <Button 
            variant="secondary"
            size="sm"
            onClick={clearChatHistory}
            disabled={isClearing || (displayMessages.length === 0)}
            className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700"
          >
            {isClearing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>クリア中...</span>
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                <span>履歴クリア</span>
              </>
            )}
          </Button>
          
          {/* チャット履歴送信ボタン */}
          <Button 
            variant="outline"
            size="sm"
            onClick={exportChatHistory}
            disabled={isExporting || !hasUnexportedMessages}
            className="flex items-center gap-2 border-blue-300 bg-white hover:bg-blue-50 text-blue-700"
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>送信中...</span>
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                <span>履歴送信</span>
              </>
            )}
          </Button>
          
          {/* チャット終了ボタン */}
          <Button 
            variant="destructive"
            size="sm"
            onClick={handleEndChat}
            className="flex items-center gap-1 bg-red-500 hover:bg-red-600"
          >
            <span>チャット終了</span>
          </Button>
        </div>
      </div>
      
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Chat Messages Area - Made wider for better visibility of images */}
        <div className="flex-1 flex flex-col h-full overflow-hidden md:w-3/4 bg-white">
          {/* Chat Messages */}
          <div id="chatMessages" className="flex-1 overflow-y-auto p-4 md:px-8 space-y-4">
            {messagesLoading || isLoading ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-blue-700">メッセージを読み込み中...</p>
              </div>
            ) : !displayMessages || displayMessages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-center">
                <div>
                  <p className="text-xl font-semibold mb-2 text-blue-800">会話を始めましょう</p>
                  <p className="text-sm text-blue-500">保守用車に関する質問を入力するか、マイクボタンをタップして話しかけてください。</p>
                </div>
              </div>
            ) : (
              <>
                {/* 通常のメッセージリスト */}
                {displayMessages.map((message: any, index: number) => (
                  <div key={index} className="w-full md:max-w-2xl mx-auto">
                    <MessageBubble message={message} />
                  </div>
                ))}
              </>
            )}
            
            {/* プレビュー用の一時メッセージ (撮影した画像のプレビュー) */}
            {draftMessage && (
              <div className="w-full md:max-w-2xl mx-auto">
                <MessageBubble
                  message={{
                    id: -1, // 一時的なID
                    content: draftMessage.content,
                    senderId: 1, // 現在のユーザーID
                    isAiResponse: false,
                    timestamp: new Date(),
                    media: draftMessage.media?.map((m, idx) => ({
                      id: idx,
                      messageId: -1,
                      ...m
                    }))
                  }}
                  isDraft={true}
                />
              </div>
            )}
          </div>

          {/* エクスポート状態表示 */}
          {hasUnexportedMessages && (
            <div className="bg-blue-50 p-2 text-sm text-blue-800 flex items-center justify-center border-t border-b border-blue-200">
              <AlertTriangle className="h-4 w-4 mr-2 text-blue-600" />
              <span>{lastExportTimestamp ? '前回の送信以降、新しいメッセージがあります。送信してください。' : 'まだチャット履歴が送信されていません。'}</span>
            </div>
          )}

          {/* Text Selection Controls - Only show when text is selected */}
          {selectedText && <TextSelectionControls text={selectedText} onSearch={searchBySelectedText} />}

          {/* Message Input */}
          <MessageInput />
        </div>

        {/* Information Panel - Hidden on mobile, shown on larger screens - Made narrower */}
        <div className="hidden md:block md:w-1/4 border-l border-blue-200 bg-blue-50 overflow-y-auto">
          <SearchResults results={searchResults} onClear={clearSearchResults} />
        </div>
      </div>

      {/* 未送信のチャット履歴がある場合の警告ダイアログ */}
      <Dialog open={isEndChatDialogOpen} onOpenChange={setIsEndChatDialogOpen}>
        <DialogContent className="bg-blue-50 border border-blue-200">
          <DialogHeader className="border-b border-blue-200 pb-3">
            <DialogTitle className="text-blue-800 text-lg font-bold">チャット履歴が未送信です</DialogTitle>
            <DialogDescription className="text-blue-700">
              まだ送信されていないチャット履歴があります。このまま終了すると、履歴が保存されません。
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-between mt-4">
            <Button 
              variant="outline" 
              onClick={() => setIsEndChatDialogOpen(false)}
              className="border-blue-300 text-blue-700 hover:bg-blue-100"
            >
              キャンセル
            </Button>
            <div className="flex gap-2">
              <Button 
                variant="destructive" 
                onClick={() => {
                  setIsEndChatDialogOpen(false);
                  window.location.href = "/";
                }}
                className="bg-red-500 hover:bg-red-600"
              >
                送信せずに終了
              </Button>
              <Button 
                variant="default" 
                onClick={handleSendAndEnd}
                disabled={isExporting}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    <span>送信中...</span>
                  </>
                ) : (
                  <span>送信して終了</span>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modals */}
      <CameraModal />
      <ImagePreviewModal />
    </div>
  );
}
