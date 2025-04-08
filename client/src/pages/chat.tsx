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
import { useIsMobile } from "@/hooks/use-mobile";
import { useOrientation } from "@/hooks/use-orientation";

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
  // クリア処理中は空配列を表示し、それ以外の場合はmessagesまたはデータを表示
  const displayMessages = isClearing 
    ? [] 
    : (messages?.length > 0 ? messages : (data as any[] || []));
  
  // メッセージクリア時にデータも更新
  useEffect(() => {
    // メッセージが空になった場合（クリアされた場合）のハンドリング
    if (messages !== undefined && messages.length === 0) {
      const chatClearedTimestamp = localStorage.getItem('chat_cleared_timestamp');
      if (chatClearedTimestamp) {
        console.log('チャット履歴クリア後の状態を維持します');
        
        // ローカルストレージのクエリキャッシュをクリア
        for (const key of Object.keys(localStorage)) {
          if (key.startsWith('rq-/api/chats/')) {
            localStorage.removeItem(key);
          }
        }
        
        // クエリキャッシュを完全に削除
        queryClient.removeQueries({ queryKey: ['/api/chats/1/messages'] });
        
        // 空の配列を強制的にセット
        queryClient.setQueryData(['/api/chats/1/messages'], []);
        
        // 特殊パラメータを付けて明示的にサーバーにクリア要求を送信
        const fetchClearedData = async () => {
          try {
            const clearUrl = `/api/chats/1/messages?clear=true&_t=${Date.now()}`;
            await fetch(clearUrl, {
              credentials: 'include',
              cache: 'no-cache',
              headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
              }
            });
          } catch (error) {
            console.error('クリア要求送信エラー:', error);
          }
        };
        
        fetchClearedData();
        
        // 少し間をおいて再確認
        const intervalId = setInterval(() => {
          queryClient.setQueryData(['/api/chats/1/messages'], []);
        }, 500);
        
        // 10秒後にクリア監視を終了
        setTimeout(() => {
          clearInterval(intervalId);
        }, 10000);
      }
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

  const isMobile = useIsMobile();
  const orientation = useOrientation();
  
  // スクロール挙動の最適化 (モバイル対応)
  useEffect(() => {
    // 基本スクロール設定を適用
    document.body.style.overflow = 'auto';
    document.documentElement.style.overflow = 'auto';
    
    // モバイル端末の場合、横向きの時に検索ボタンの位置を調整する
    const handleOrientationChange = () => {
      // 検索結果を表示するスライダーがあれば位置調整
      const searchSlider = document.getElementById('mobile-search-slider');
      const chatMessages = document.querySelector('.chat-messages-container') as HTMLElement;
      
      if (searchSlider) {
        // チャットエリアのスタイルを初期化
        if (chatMessages) {
          chatMessages.style.width = '';
          chatMessages.style.flex = '';
          chatMessages.style.maxWidth = '';
        }
        
        // 初期状態では検索パネルは非表示にする
        if (!searchResults || searchResults.length === 0) {
          searchSlider.style.display = 'none';
          return;
        } else {
          searchSlider.style.display = 'block';
        }
        
        // 横向きの場合は画面右側に固定表示
        if (orientation === 'landscape') {
          // 検索パネルを右側に固定
          searchSlider.style.position = 'fixed';
          searchSlider.style.maxHeight = '100vh';
          searchSlider.style.height = '100vh';
          searchSlider.style.top = '0';
          searchSlider.style.bottom = '0';
          searchSlider.style.width = '40%';
          searchSlider.style.right = '0';
          searchSlider.style.left = 'auto';
          searchSlider.style.transform = 'translateX(100%)'; // 初期状態では非表示
          searchSlider.style.transition = 'transform 300ms ease-in-out';
          searchSlider.style.borderLeft = '1px solid #bfdbfe';
          searchSlider.style.zIndex = '10';
          searchSlider.style.backgroundColor = '#eff6ff';
          searchSlider.style.paddingTop = '0';
          searchSlider.style.overflowY = 'auto';
          
          // 丸ボタン位置調整
          const searchButton = document.querySelector('.mobile-search-button') as HTMLElement;
          if (searchButton) {
            searchButton.style.bottom = '20px';
            searchButton.style.right = '16px';
            searchButton.style.zIndex = '20';
          }
        } else {
          // 縦向きは従来通り下から表示
          searchSlider.style.maxHeight = '70vh';
          searchSlider.style.width = '100%';
          searchSlider.style.right = 'auto';
          searchSlider.style.left = '0';
          searchSlider.style.top = 'auto';
          searchSlider.style.position = 'fixed';
          searchSlider.style.bottom = '0';
          searchSlider.style.transform = 'translateY(100%)';
          searchSlider.style.transition = 'transform 300ms ease-in-out';
          searchSlider.style.borderLeft = 'none';
          searchSlider.style.borderTop = '1px solid #bfdbfe';
          
          // 丸ボタン位置を元に戻す
          const searchButton = document.querySelector('.mobile-search-button') as HTMLElement;
          if (searchButton) {
            searchButton.style.bottom = '20px';
            searchButton.style.right = '16px';
          }
        }
      }
    };
    
    // 初期実行
    handleOrientationChange();
    
    // イベントリスナー登録
    window.addEventListener('resize', handleOrientationChange);
    window.addEventListener('orientationchange', handleOrientationChange);
    
    // クリーンアップ
    return () => {
      window.removeEventListener('resize', handleOrientationChange);
      window.removeEventListener('orientationchange', handleOrientationChange);
      
      // 検索結果エリアを元に戻す
      const chatMessages = document.querySelector('.chat-messages-container') as HTMLElement;
      if (chatMessages) {
        chatMessages.style.width = '';
        chatMessages.style.flex = '';
        chatMessages.style.maxWidth = '';
      }
    };
  }, [orientation, searchResults]);
  
  return (
    <div className="flex flex-col w-full h-full overflow-auto bg-blue-50 chat-layout-container overflow-scroll-container" style={{ minWidth: orientation === 'landscape' && window.innerHeight < 600 ? '740px' : '100%' }}>
      <div className="border-b border-blue-200 p-2 md:p-3 flex justify-between items-center bg-blue-100 mobile-landscape-header">
        <div className="flex items-center">
          {/* タイトルはヘッダーに移動 */}
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          {/* チャット履歴送信ボタン */}
          <Button 
            variant="outline"
            size="sm"
            onClick={exportChatHistory}
            disabled={isExporting || !hasUnexportedMessages}
            className="flex items-center gap-1 md:gap-2 border-green-400 bg-green-50 hover:bg-green-100 text-green-700 text-xs md:text-sm"
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-green-600" />
                <span>送信中...</span>
              </>
            ) : (
              <>
                <Send className="h-4 w-4 text-green-600" />
                <span>履歴送信</span>
              </>
            )}
          </Button>
          
          {/* チャット履歴クリアボタンはヘッダーに移動 */}
          
          {/* チャット終了ボタン */}
          <Button 
            variant="destructive"
            size="sm"
            onClick={handleEndChat}
            className="flex items-center gap-1 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white border-0"
          >
            <span>チャット終了</span>
          </Button>
        </div>
      </div>
      
      <div className="flex-1 flex flex-col md:flex-row overflow-auto chat-layout-container">
        {/* Chat Messages Area - Made wider for better visibility of images */}
        <div className="flex-1 flex flex-col h-full overflow-auto md:w-3/4 bg-white chat-messages-container">
          {/* Chat Messages */}
          <div id="chatMessages" className="flex-1 overflow-y-auto p-2 sm:p-3 md:p-4 md:px-8 space-y-4 min-w-[300px]">
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

        {/* Information Panel - モバイルとデスクトップで別々の表示方法 */}
        <div className="hidden md:block md:w-1/4 border-l border-blue-200 bg-blue-50 overflow-y-auto search-results-panel">
          <SearchResults results={searchResults} onClear={clearSearchResults} />
        </div>
        
        {/* モバイル用検索結果スライダー - すべてのモバイル向け表示 (向きに関係なく表示) */}
        {searchResults && searchResults.length > 0 && isMobile && (
          <div className={`fixed ${orientation === 'landscape' ? 'top-4 right-4' : 'bottom-20 right-4'} md:hidden mobile-search-button`}>
            <Button
              onClick={() => {
                const slider = document.getElementById('mobile-search-slider');
                if (slider) {
                  if (orientation === 'landscape') {
                    // 横向きの場合、右側に表示
                    if (slider.classList.contains('search-panel-visible')) {
                      slider.classList.remove('search-panel-visible');
                      slider.style.transform = 'translateX(100%)';
                    } else {
                      slider.classList.add('search-panel-visible');
                      slider.style.transform = 'none';
                    }
                  } else {
                    // 縦向きの場合、下から表示
                    if (slider.classList.contains('search-panel-visible')) {
                      slider.classList.remove('search-panel-visible');
                      slider.style.transform = 'translateY(100%)';
                    } else {
                      slider.classList.add('search-panel-visible');
                      slider.style.transform = 'none';
                    }
                  }
                }
              }}
              className="rounded-full w-12 h-12 bg-blue-500 hover:bg-blue-600 shadow-lg flex items-center justify-center"
            >
              <span className="text-white font-bold">{searchResults.length}</span>
            </Button>
          </div>
        )}
        
        <div 
          id="mobile-search-slider" 
          className={`fixed transition-transform duration-300 ease-in-out md:hidden z-50 ${
            orientation === 'landscape' 
              ? 'landscape-search-panel inset-y-0 right-0 w-2/5' 
              : 'portrait-search-panel inset-x-0 bottom-0'
          }`}
          style={{ display: searchResults && searchResults.length > 0 ? 'block' : 'none' }}
        >
          <div className={`bg-blue-50 overflow-y-auto ${
            orientation === 'landscape' 
              ? 'h-full border-l border-blue-200' 
              : 'border-t border-blue-200 rounded-t-xl'
          }`} style={{ maxHeight: orientation === 'landscape' ? '100vh' : '70vh' }}>
            <div className="p-3 border-b border-blue-200 flex justify-between items-center bg-blue-100 sticky top-0">
              <h3 className="font-semibold text-blue-800">検索結果</h3>
              <Button
                size="sm" 
                variant="ghost"
                onClick={() => {
                const slider = document.getElementById('mobile-search-slider');
                if (slider) {
                  slider.classList.remove('search-panel-visible');
                  if (orientation === 'landscape') {
                    // 横向きの場合、右側から外す
                    slider.style.transform = 'translateX(100%)';
                  } else {
                    // 縦向きの場合、下から外す
                    slider.style.transform = 'translateY(100%)';
                  }
                }
              }}
                className="text-blue-700"
              >
                閉じる
              </Button>
            </div>
            <div className="p-2">
              <SearchResults results={searchResults} onClear={clearSearchResults} />
            </div>
          </div>
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
