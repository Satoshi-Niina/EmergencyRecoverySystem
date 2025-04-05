import { useState } from "react";
import { useAuth } from "@/context/auth-context";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

interface MessageBubbleProps {
  message: {
    id: number;
    content: string;
    senderId: number | null;
    isAiResponse: boolean;
    timestamp: Date;
    media?: {
      id: number;
      type: string;
      url: string;
      thumbnail?: string;
    }[];
  };
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const { user } = useAuth();
  const [selectedText, setSelectedText] = useState("");
  
  const isUserMessage = !message.isAiResponse;
  const formattedTime = format(
    new Date(message.timestamp), 
    "HH:mm", 
    { locale: ja }
  );

  // Handle text selection within this message
  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      setSelectedText(selection.toString().trim());
    } else {
      setSelectedText("");
    }
  };

  return (
    <div 
      className={`flex items-end mb-4 ${isUserMessage ? "" : "flex-row-reverse"}`}
      onMouseUp={handleMouseUp}
    >
      <div className={`mx-2 flex flex-col ${isUserMessage ? "items-start" : "items-end"} max-w-[70%]`}>
        <div 
          className={`px-4 py-3 mb-1 shadow-sm w-full ${
            isUserMessage 
              ? "chat-bubble-user bg-stone-100 rounded-[18px_18px_4px_18px] border border-stone-300" 
              : "chat-bubble-ai bg-white rounded-[18px_18px_18px_4px] border border-stone-300"
          }`}
        >
          <p className={`${!isUserMessage ? "text-stone-800" : "text-stone-900"}`}>{message.content}</p>
          
          {/* Display media attachments if any */}
          {message.media && message.media.length > 0 && (
            <div className="mt-3">
              {message.media.map((media, index) => (
                <div key={index} className="mt-2">
                  {media.type === 'image' && (
                    <div className="relative">
                      <img 
                        src={media.url} 
                        alt="添付画像" 
                        className="rounded-lg w-full max-w-xs cursor-pointer border border-stone-200 shadow-md" 
                        onClick={() => {
                          // Open image preview modal
                          window.dispatchEvent(new CustomEvent('preview-image', { detail: { url: media.url } }));
                        }}
                      />
                      <div 
                        className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent('preview-image', { detail: { url: media.url } }));
                        }}
                      >
                        <div className="bg-stone-700 bg-opacity-70 p-2 rounded-full">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  )}
                  {media.type === 'video' && (
                    <div className="relative">
                      <video 
                        src={media.url} 
                        controls 
                        className="rounded-lg w-full max-w-xs border border-stone-200 shadow-md"
                        onClick={(e) => {
                          // Stop propagation to prevent both video control and preview
                          e.stopPropagation();
                        }}
                      />
                      <div 
                        className="absolute top-2 right-2 flex items-center justify-center opacity-50 hover:opacity-100 transition-opacity"
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent('preview-image', { detail: { url: media.url } }));
                        }}
                      >
                        <div className="bg-stone-700 bg-opacity-70 p-2 rounded-full">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <span className="text-xs text-stone-400">{formattedTime}</span>
      </div>
      <div>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
          isUserMessage ? "bg-stone-500" : "bg-stone-700"
        }`}>
          <span className={`material-icons text-white text-sm ${
            isUserMessage ? "" : ""
          }`}>
            {isUserMessage ? "person" : "smart_toy"}
          </span>
        </div>
      </div>
    </div>
  );
}
