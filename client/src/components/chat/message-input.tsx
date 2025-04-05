import { useState, useRef } from "react";
import { useChat } from "@/context/chat-context";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mic, Send, Camera, LogOut } from "lucide-react";

export default function MessageInput() {
  const [message, setMessage] = useState("");
  const { sendMessage, isLoading, startRecording, stopRecording, isRecording, recordedText } = useChat();
  const { logout } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const textToSend = recordedText.trim() || message.trim();
    if (!textToSend || isLoading) return;
    
    await sendMessage(textToSend);
    setMessage("");
    
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleMicClick = () => {
    if (isRecording) {
      stopRecording();
      // Apply the recorded text to the message
      setMessage(prev => (prev + " " + recordedText).trim());
    } else {
      startRecording();
    }
  };

  const handleCameraClick = () => {
    // Open the camera modal
    window.dispatchEvent(new CustomEvent('open-camera'));
  };

  const handleLogout = async () => {
    if (isRecording) {
      stopRecording();
    }
    await logout();
  };

  return (
    <div className="bg-white border-t border-neutral-200 p-3">
      <form onSubmit={handleSubmit} className="flex items-center">
        {/* 終了ボタン */}
        <Button 
          type="button" 
          onClick={handleLogout}
          size="icon"
          variant="ghost"
          className="p-2 rounded-full hover:bg-red-100 mr-2"
        >
          <LogOut className="h-5 w-5 text-red-600" />
        </Button>
        
        {/* カメラボタン */}
        <Button 
          type="button" 
          onClick={handleCameraClick}
          size="icon"
          variant="ghost"
          className="p-2 rounded-full hover:bg-neutral-100 mr-2"
        >
          <Camera className="h-5 w-5 text-neutral-800" />
        </Button>
        
        {/* マイクボタン */}
        <Button 
          type="button" 
          onClick={handleMicClick}
          size="icon"
          variant={isRecording ? "default" : "ghost"}
          className={`p-2 rounded-full ${isRecording ? "bg-primary" : "hover:bg-neutral-100"} mr-2`}
        >
          <Mic className={`h-5 w-5 ${isRecording ? "text-white" : "text-neutral-800"}`} />
        </Button>
        
        <div className="flex-1 bg-neutral-100 rounded-full px-4 py-2 flex items-center">
          <Input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0"
            placeholder={isRecording ? "話しかけてください..." : "メッセージを入力..."}
            value={message}
            onChange={handleInputChange}
            disabled={isLoading}
          />
          <Button 
            type="submit" 
            disabled={isLoading || (!message.trim() && !recordedText.trim())}
            size="icon"
            variant="ghost"
            className="ml-2"
          >
            <Send className="h-5 w-5 text-primary" />
          </Button>
        </div>
      </form>
    </div>
  );
}
