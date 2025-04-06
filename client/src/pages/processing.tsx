import { useState } from "react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { UploadIcon, FileIcon, ImageIcon, Download, Database } from "lucide-react";
import KnowledgeUploader from "@/components/knowledge/knowledge-uploader";

export default function Processing() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [convertToJson, setConvertToJson] = useState(true);
  const [extractImages, setExtractImages] = useState(true);
  const [createThumbnails, setCreateThumbnails] = useState(false);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch processed documents
  const { data: documents = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/documents'],
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFileToUpload(e.target.files[0]);
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFileToUpload(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const processFile = async () => {
    if (!fileToUpload) {
      toast({
        title: "処理エラー",
        description: "ファイルを選択してください。",
        variant: "destructive",
      });
      return;
    }

    // Check if file type is supported
    const fileType = fileToUpload.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'pptx', 'xlsx', 'docx'].includes(fileType || '')) {
      toast({
        title: "処理エラー",
        description: "対応していないファイル形式です。PowerPoint, Excel, PDFファイルをアップロードしてください。",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      // In a real application, we would upload and process the file here
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 2000));

      toast({
        title: "処理完了",
        description: `${fileToUpload.name}の処理が完了しました。`,
      });

      setFileToUpload(null);
    } catch (error) {
      toast({
        title: "処理エラー",
        description: "ファイルの処理中にエラーが発生しました。",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="p-4 border-b border-neutral-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <h2 className="font-semibold text-lg text-indigo-600">データ処理・ナレッジベース管理</h2>
        <p className="text-sm text-neutral-500">画像検索用データ処理とAI回答用ナレッジベースの管理を行います</p>
      </div>
      
      <div className="flex-1 overflow-hidden flex">
        {/* 左側：画像検索用データ処理 */}
        <div className="w-1/2 p-4 overflow-y-auto border-r border-neutral-200">
          <div className="mb-4 flex items-center">
            <ImageIcon className="text-indigo-500 h-5 w-5 mr-2" />
            <h3 className="font-semibold text-indigo-600">画像検索用データ処理</h3>
          </div>
          
          {/* File Upload Area */}
          <div 
            className="border-2 border-dashed border-indigo-200 rounded-lg p-8 flex flex-col items-center justify-center mb-6 bg-indigo-50"
            onDrop={handleFileDrop}
            onDragOver={handleDragOver}
          >
            <UploadIcon className="text-indigo-400 h-12 w-12 mb-3" />
            <p className="text-center mb-2 text-indigo-700">
              {fileToUpload 
                ? `選択されたファイル: ${fileToUpload.name}` 
                : "ファイルをドラッグ&ドロップするか、クリックして選択"}
            </p>
            <p className="text-xs text-indigo-400 text-center mb-4">対応形式: PowerPoint, Excel, PDF</p>
            <div className="flex gap-2">
              <input 
                type="file" 
                id="fileUpload" 
                className="hidden" 
                accept=".pdf,.pptx,.xlsx,.docx" 
                onChange={handleFileChange}
              />
              <Button 
                className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white hover:from-indigo-600 hover:to-indigo-700" 
                onClick={() => document.getElementById('fileUpload')?.click()}
                disabled={isProcessing}
              >
                ファイルを選択
              </Button>
              {fileToUpload && (
                <Button 
                  className="bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600" 
                  onClick={processFile}
                  disabled={isProcessing}
                >
                  {isProcessing ? "処理中..." : "処理開始"}
                </Button>
              )}
            </div>
          </div>
          
          {/* Processing Options */}
          <div className="bg-white rounded-lg border border-indigo-200 p-4 mb-6 shadow-sm">
            <h3 className="font-medium mb-3 text-indigo-700">処理オプション</h3>
            
            <div className="space-y-3">
              <div className="flex items-center">
                <Checkbox 
                  id="convertToJson" 
                  checked={convertToJson} 
                  onCheckedChange={(checked) => setConvertToJson(checked as boolean)} 
                  className="mr-2 text-indigo-600"
                />
                <label htmlFor="convertToJson" className="text-indigo-900">JSONに変換</label>
              </div>
              <div className="flex items-center">
                <Checkbox 
                  id="extractImages" 
                  checked={extractImages} 
                  onCheckedChange={(checked) => setExtractImages(checked as boolean)} 
                  className="mr-2 text-indigo-600"
                />
                <label htmlFor="extractImages" className="text-indigo-900">画像を抽出</label>
              </div>
              <div className="flex items-center">
                <Checkbox 
                  id="createThumbnails" 
                  checked={createThumbnails} 
                  onCheckedChange={(checked) => setCreateThumbnails(checked as boolean)} 
                  className="mr-2 text-indigo-600"
                />
                <label htmlFor="createThumbnails" className="text-indigo-900">サムネイルを作成</label>
              </div>
            </div>
          </div>
          
          {/* Processed Files Section */}
          <div className="bg-white rounded-lg border border-indigo-200 p-4 shadow-sm">
            <h3 className="font-medium mb-3 text-indigo-700">処理済みファイル</h3>
            
            {isLoading ? (
              <p className="text-center py-4 text-indigo-500">読み込み中...</p>
            ) : documents?.length === 0 ? (
              <p className="text-center py-4 text-indigo-300">処理済みファイルはありません</p>
            ) : (
              <div className="space-y-2">
                {/* Processed File Items */}
                {documents?.map((doc: any) => (
                  <div key={doc.id} className="flex justify-between items-center p-3 hover:bg-indigo-50 rounded-lg transition-colors">
                    <div className="flex items-center">
                      {doc.type === 'pdf' || doc.type === 'excel' ? (
                        <FileIcon className="text-indigo-500 h-5 w-5 mr-3" />
                      ) : (
                        <ImageIcon className="text-indigo-500 h-5 w-5 mr-3" />
                      )}
                      <div>
                        <p className="font-medium text-sm text-indigo-900">{doc.title}</p>
                        <p className="text-xs text-indigo-400">
                          {new Date(doc.processedAt).toLocaleDateString('ja-JP')}処理
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100">
                      <Download className="h-5 w-5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* 右側：ナレッジベース管理 */}
        <div className="w-1/2 p-4 overflow-y-auto bg-gradient-to-r from-blue-50 to-cyan-50">
          <div className="mb-4 flex items-center">
            <Database className="text-cyan-600 h-5 w-5 mr-2" />
            <h3 className="font-semibold text-cyan-700">ナレッジベース管理</h3>
          </div>
          
          <KnowledgeUploader />
        </div>
      </div>
    </div>
  );
}
