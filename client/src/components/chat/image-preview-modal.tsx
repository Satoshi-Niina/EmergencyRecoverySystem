import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export default function ImagePreviewModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState("");

  useEffect(() => {
    // Listen for preview-image event
    const handlePreviewImage = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && customEvent.detail.url) {
        setImageUrl(customEvent.detail.url);
        setIsOpen(true);
      }
    };
    
    window.addEventListener('preview-image', handlePreviewImage);
    
    return () => {
      window.removeEventListener('preview-image', handlePreviewImage);
    };
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-5xl bg-black bg-opacity-90 border border-blue-400 flex items-center justify-center p-0 rounded-xl">
        <Button 
          className="absolute top-4 right-4 text-white bg-blue-600 hover:bg-blue-700 rounded-full" 
          variant="ghost" 
          size="icon" 
          onClick={() => setIsOpen(false)}
        >
          <X className="h-6 w-6" />
        </Button>
        
        <div className="max-w-full max-h-[80vh] p-2">
          <img 
            src={imageUrl} 
            alt="拡大画像" 
            className="max-w-full max-h-[80vh] object-contain rounded-lg border border-blue-500" 
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
