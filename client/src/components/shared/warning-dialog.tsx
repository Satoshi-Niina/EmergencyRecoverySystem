import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface WarningDialogProps {
  open: boolean;
  title: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function WarningDialog({
  open,
  title,
  message,
  onCancel,
  onConfirm,
}: WarningDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onCancel}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="text-warning mb-2">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex justify-end sm:justify-end">
          <Button
            variant="outline"
            onClick={onCancel}
          >
            キャンセル
          </Button>
          <Button
            className="bg-warning text-white"
            onClick={onConfirm}
          >
            続行
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
