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
      <div className={`mx-2 flex flex-col ${isUserMessage ? "items-start" : "items-end"}`}>
        <div 
          className={`px-4 py-2 mb-1 shadow-sm ${
            isUserMessage 
              ? "chat-bubble-user bg-[#E1F5FE] rounded-[18px_18px_4px_18px]" 
              : "chat-bubble-ai bg-white rounded-[18px_18px_18px_4px]"
          }`}
        >
          <p>{message.content}</p>
          
          {/* Display media attachments if any */}
          {message.media && message.media.length > 0 && (
            <div className="mt-2">
              {message.media.map((media, index) => (
                <div key={index} className="mt-2">
                  {media.type === 'image' && (
                    <img 
                      src={media.url} 
                      alt="添付画像" 
                      className="rounded-lg w-full max-w-xs cursor-pointer" 
                      onClick={() => {
                        // Open image preview modal
                        window.dispatchEvent(new CustomEvent('preview-image', { detail: { url: media.url } }));
                      }}
                    />
                  )}
                  {media.type === 'video' && (
                    <video 
                      src={media.url} 
                      controls 
                      className="rounded-lg w-full max-w-xs"
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <span className="text-xs text-neutral-300">{formattedTime}</span>
      </div>
      <div>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
          isUserMessage ? "bg-neutral-300" : "bg-primary"
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
