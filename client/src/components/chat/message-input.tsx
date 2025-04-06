import { useState, useRef, useEffect } from "react";
import { useChat } from "@/context/chat-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mic, Send, Camera } from "lucide-react";

export default function MessageInput() {
  const [message, setMessage] = useState("");
  const { sendMessage, isLoading, startRecording, stopRecording, isRecording, recordedText, selectedText } = useChat();
  const inputRef = useRef<HTMLInputElement>(null);
  
  // 選択されたテキストが変更されたら入力欄に反映
  useEffect(() => {
    if (selectedText) {
      setMessage(selectedText);
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  }, [selectedText]);

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

  return (
    <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-t border-blue-200 p-3">
      <form onSubmit={handleSubmit} className="flex items-center">
        {/* カメラボタン - with label */}
        <div className="flex flex-col items-center mr-3">
          <span className="text-xs font-medium text-indigo-700 mb-1">カメラ起動</span>
          <Button 
            type="button" 
            onClick={handleCameraClick}
            size="icon"
            variant="ghost"
            className="p-4 rounded-full bg-gradient-to-r from-indigo-100 to-cyan-100 hover:from-indigo-200 hover:to-cyan-200 border border-indigo-300"
          >
            <Camera className="h-10 w-10 text-indigo-600" />
          </Button>
        </div>
        
        {/* マイクボタン */}
        <Button 
          type="button" 
          onClick={handleMicClick}
          size="icon"
          variant={isRecording ? "default" : "ghost"}
          className={`p-3 rounded-full ${isRecording 
            ? "bg-gradient-to-r from-red-500 to-pink-500" 
            : "bg-gradient-to-r from-amber-100 to-orange-100 hover:from-amber-200 hover:to-orange-200 border border-orange-300"} mr-3`}
        >
          <Mic className={`h-7 w-7 ${isRecording ? "text-white" : "text-orange-600"}`} />
        </Button>
        
        <div className="flex-1 bg-white border border-blue-200 rounded-full px-4 py-2 flex items-center shadow-inner">
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
            className="ml-2 p-2 bg-gradient-to-r from-sky-100 to-blue-100 hover:from-sky-200 hover:to-blue-200 rounded-full border border-blue-300"
          >
            <Send className="h-8 w-8 text-blue-600" />
          </Button>
        </div>
      </form>
    </div>
  );
}
