import { useEffect } from "react";
import { useChat } from "@/context/chat-context";
import MessageBubble from "@/components/chat/message-bubble";
import MessageInput from "@/components/chat/message-input";
import TextSelectionControls from "@/components/chat/text-selection-controls";
import SearchResults from "@/components/chat/search-results";
import CameraModal from "@/components/chat/camera-modal";
import ImagePreviewModal from "@/components/chat/image-preview-modal";
import { useQuery } from "@tanstack/react-query";

export default function Chat() {
  const {
    messages,
    isLoading,
    selectedText,
    setSelectedText,
    searchBySelectedText,
    searchResults,
    clearSearchResults
  } = useChat();

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
  const displayMessages = messages.length > 0 ? messages : data || [];

  return (
    <div className="flex flex-col w-full h-full">
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Chat Messages Area - Made wider for better visibility of images */}
        <div className="flex-1 flex flex-col h-full overflow-hidden md:w-3/4">
          {/* Chat Messages */}
          <div id="chatMessages" className="flex-1 overflow-y-auto p-4 md:px-8 space-y-4">
            {messagesLoading || isLoading ? (
              <div className="flex items-center justify-center h-full">
                <p>メッセージを読み込み中...</p>
              </div>
            ) : displayMessages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-center">
                <div>
                  <p className="text-lg font-semibold mb-2">会話を始めましょう</p>
                  <p className="text-sm text-neutral-300">緊急車両に関する質問を入力するか、マイクボタンをタップして話しかけてください。</p>
                </div>
              </div>
            ) : (
              displayMessages.map((message, index) => (
                <div key={index} className="w-full md:max-w-2xl mx-auto">
                  <MessageBubble message={message} />
                </div>
              ))
            )}
          </div>

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

      {/* Modals */}
      <CameraModal />
      <ImagePreviewModal />
    </div>
  );
}
