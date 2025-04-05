import { useEffect, useState } from "react";
import { useChat } from "@/context/chat-context";
import MessageBubble from "@/components/chat/message-bubble";
import MessageInput from "@/components/chat/message-input";
import TextSelectionControls from "@/components/chat/text-selection-controls";
import SearchResults from "@/components/chat/search-results";
import CameraModal from "@/components/chat/camera-modal";
import ImagePreviewModal from "@/components/chat/image-preview-modal";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Send, AlertTriangle, Loader2 } from "lucide-react";
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
    hasUnexportedMessages
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
    <div className="flex flex-col w-full h-full">
      <div className="border-b border-neutral-200 p-2 flex justify-between items-center">
        <h1 className="text-lg font-semibold">緊急復旧サポート</h1>
        <div className="flex items-center gap-2">
          {/* チャット履歴送信ボタン */}
          <Button 
            variant="outline"
            size="sm"
            onClick={exportChatHistory}
            disabled={isExporting || !hasUnexportedMessages}
            className="flex items-center gap-1"
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
            className="flex items-center gap-1"
          >
            <span>チャット終了</span>
          </Button>
        </div>
      </div>
      
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Chat Messages Area - Made wider for better visibility of images */}
        <div className="flex-1 flex flex-col h-full overflow-hidden md:w-3/4">
          {/* Chat Messages */}
          <div id="chatMessages" className="flex-1 overflow-y-auto p-4 md:px-8 space-y-4">
            {messagesLoading || isLoading ? (
              <div className="flex items-center justify-center h-full">
                <p>メッセージを読み込み中...</p>
              </div>
            ) : !displayMessages || displayMessages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-center">
                <div>
                  <p className="text-lg font-semibold mb-2">会話を始めましょう</p>
                  <p className="text-sm text-neutral-300">緊急車両に関する質問を入力するか、マイクボタンをタップして話しかけてください。</p>
                </div>
              </div>
            ) : (
              displayMessages.map((message: any, index: number) => (
                <div key={index} className="w-full md:max-w-2xl mx-auto">
                  <MessageBubble message={message} />
                </div>
              ))
            )}
          </div>

          {/* エクスポート状態表示 */}
          {hasUnexportedMessages && (
            <div className="bg-yellow-50 p-2 text-sm text-yellow-800 flex items-center justify-center">
              <AlertTriangle className="h-4 w-4 mr-2" />
              <span>{lastExportTimestamp ? '前回の送信以降、新しいメッセージがあります。送信してください。' : 'まだチャット履歴が送信されていません。'}</span>
            </div>
          )}

          {/* Text Selection Controls - Only show when text is selected */}
          {selectedText && <TextSelectionControls text={selectedText} onSearch={searchBySelectedText} />}

          {/* Message Input */}
          <MessageInput />
        </div>

        {/* Information Panel - Hidden on mobile, shown on larger screens - Made narrower */}
        <div className="hidden md:block md:w-1/4 border-l border-neutral-200 bg-white overflow-y-auto">
          <SearchResults results={searchResults} onClear={clearSearchResults} />
        </div>
      </div>

      {/* 未送信のチャット履歴がある場合の警告ダイアログ */}
      <Dialog open={isEndChatDialogOpen} onOpenChange={setIsEndChatDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>チャット履歴が未送信です</DialogTitle>
            <DialogDescription>
              まだ送信されていないチャット履歴があります。このまま終了すると、履歴が保存されません。
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-between mt-4">
            <Button variant="outline" onClick={() => setIsEndChatDialogOpen(false)}>
              キャンセル
            </Button>
            <div className="flex gap-2">
              <Button variant="destructive" onClick={() => {
                setIsEndChatDialogOpen(false);
                window.location.href = "/";
              }}>
                送信せずに終了
              </Button>
              <Button 
                variant="default" 
                onClick={handleSendAndEnd}
                disabled={isExporting}
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
