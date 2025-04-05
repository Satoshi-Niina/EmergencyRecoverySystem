import { useState, useRef, useEffect } from "react";
import { useChat } from "@/context/chat-context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Camera, VideoIcon, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function CameraModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [isVideoMode, setIsVideoMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  
  const { captureImage } = useChat();
  const { toast } = useToast();

  useEffect(() => {
    // Listen for open-camera event
    const handleOpenCamera = () => setIsOpen(true);
    window.addEventListener('open-camera', handleOpenCamera);
    
    return () => {
      window.removeEventListener('open-camera', handleOpenCamera);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      // Start camera when modal opens
      startCamera();
    } else {
      // Stop camera when modal closes
      stopCamera();
    }
  }, [isOpen]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: true,
        audio: isVideoMode 
      });
      
      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast({
        title: "カメラエラー",
        description: "カメラにアクセスできませんでした。",
        variant: "destructive",
      });
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    
    if (isRecording) {
      stopRecording();
    }
    
    setCapturedImage(null);
  };

  const handleCapture = () => {
    if (!videoRef.current) return;
    
    if (isVideoMode) {
      // Toggle video recording
      if (isRecording) {
        stopRecording();
      } else {
        startRecording();
      }
    } else {
      // Capture image
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (ctx && videoRef.current) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const imageData = canvas.toDataURL('image/jpeg');
        setCapturedImage(imageData);
      }
    }
  };

  const startRecording = () => {
    recordedChunksRef.current = [];
    
    if (stream) {
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/mp4' });
        const videoUrl = URL.createObjectURL(blob);
        setCapturedImage(videoUrl);
        setIsRecording(false);
      };
      
      mediaRecorder.start();
      setIsRecording(true);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  };

  const handleSend = async () => {
    if (capturedImage) {
      await captureImage(capturedImage, isVideoMode ? 'video' : 'image');
      setIsOpen(false);
    }
  };

  const toggleCameraMode = () => {
    if (isRecording) {
      stopRecording();
    }
    
    setIsVideoMode(!isVideoMode);
    setCapturedImage(null);
    
    // Restart camera with new settings
    stopCamera();
    setTimeout(() => startCamera(), 300);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="p-4 border-b border-neutral-200 flex flex-row justify-between items-center">
          <DialogTitle>カメラ</DialogTitle>
          <div className="flex items-center">
            <Button 
              variant="ghost" 
              size="icon" 
              className="p-2 rounded-full hover:bg-neutral-100 mr-2"
              onClick={toggleCameraMode}
            >
              {isVideoMode ? <Camera /> : <VideoIcon />}
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="p-2 rounded-full hover:bg-neutral-100"
              onClick={() => setIsOpen(false)}
            >
              <X />
            </Button>
          </div>
        </DialogHeader>
        
        <div className="relative bg-black">
          {!capturedImage ? (
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className="w-full h-64 bg-neutral-800 object-cover"
            />
          ) : (
            isVideoMode ? (
              <video 
                src={capturedImage} 
                controls 
                className="w-full h-64 bg-neutral-800 object-contain"
              />
            ) : (
              <img 
                src={capturedImage} 
                alt="Captured" 
                className="w-full h-64 bg-neutral-800 object-contain"
              />
            )
          )}
          
          {/* Camera Controls */}
          <div className="absolute bottom-4 left-0 right-0 flex justify-center">
            <Button 
              className="bg-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg"
              variant="outline"
              size="icon"
              onClick={handleCapture}
            >
              {isVideoMode ? (
                isRecording ? (
                  <span className="h-5 w-5 bg-red-500 rounded-sm" />
                ) : (
                  <VideoIcon className="h-6 w-6 text-neutral-800" />
                )
              ) : (
                <Camera className="h-6 w-6 text-neutral-800" />
              )}
            </Button>
          </div>
        </div>
        
        <div className="p-4">
          <Button 
            className="w-full bg-primary text-white py-2 rounded-lg font-medium"
            onClick={handleSend}
            disabled={!capturedImage}
          >
            送信する
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
