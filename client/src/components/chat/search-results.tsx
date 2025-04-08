import { Button } from "@/components/ui/button";
import { X, ExternalLink, FileText, MessageCircle } from "lucide-react";
import { useOrientation } from "@/hooks/use-orientation";
import { useIsMobile } from "@/hooks/use-mobile";

interface SearchResult {
  id: number;
  title: string;
  type: string;
  url?: string;
  content?: string;
  relevance?: number;
  timestamp?: Date;
}

interface SearchResultsProps {
  results: SearchResult[];
  onClear: () => void;
}

export default function SearchResults({ results, onClear }: SearchResultsProps) {
  const orientation = useOrientation();
  const { isMobile } = useIsMobile();
  
  // シンプルなアニメーションクラスを追加
  const animationClass = "search-results-animation";
  
  if (results.length === 0) {
    return (
      <div className="p-4">
        <h2 className="font-semibold text-lg mb-3 text-blue-700">検索結果</h2>
        <p className="text-center text-blue-400 py-4">検索結果はありません</p>
        <p className="text-sm text-center text-blue-400">
          テキストを選択して検索するか、画像検索機能を使用してください。
        </p>
      </div>
    );
  }

  // デバイスに応じたレイアウトクラス
  // iPhoneの場合は特別なスタイルを適用
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  
  // モバイル&横向きの場合は全画面表示、iOS縦向きは特殊スタイル、それ以外は通常表示
  const containerClass = isMobile && orientation === 'landscape'
    ? "fixed inset-0 z-50 bg-white p-4 overflow-auto chat-controls-container"
    : isIOS && orientation === 'portrait'
      ? "p-4 overflow-x-auto ios-portrait-search-results"
      : "p-4 overflow-x-auto";

  return (
    <div className={containerClass}>
      <div className="flex justify-between items-center mb-3">
        <h2 className="font-semibold text-lg text-blue-700">検索結果</h2>
        <Button variant="ghost" size="icon" onClick={onClear} className="text-blue-600 hover:bg-blue-100 rounded-full">
          <X className="h-5 w-5" />
        </Button>
      </div>
      
      <div className={`space-y-4 ${isMobile ? 'w-full max-w-md mx-auto' : ''} search-results-container`}>
        {results.map((result) => (
          <div key={result.id} className="rounded-lg border border-blue-200 overflow-hidden bg-white shadow-sm">
            {result.url ? (
              // 画像結果
              <img 
                src={result.url} 
                alt={result.title} 
                className="w-full h-40 object-cover border-b border-blue-100" 
                onClick={() => {
                  // Open image preview modal
                  window.dispatchEvent(new CustomEvent('preview-image', { detail: { url: result.url } }));
                }}
              />
            ) : result.type === 'ai-response' ? (
              // AI応答
              <div className="p-4 bg-blue-50 border-b border-blue-100">
                <div className="flex items-center mb-2">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center mr-2">
                    <span className="material-icons text-white text-sm">smart_toy</span>
                  </div>
                  <div>
                    <h3 className="font-medium text-blue-700">{result.title}</h3>
                    <p className="text-xs text-blue-500">
                      {result.timestamp && new Date(result.timestamp).toLocaleTimeString('ja-JP', {hour: '2-digit', minute:'2-digit'})}
                    </p>
                  </div>
                </div>
                <div className="bg-white p-3 rounded-lg border border-blue-200 shadow-sm mt-2">
                  <p className="text-blue-700 whitespace-pre-wrap">{result.content}</p>
                </div>
              </div>
            ) : (
              // その他のドキュメント
              <div className="h-40 bg-blue-50 flex items-center justify-center border-b border-blue-100">
                {result.type === 'text' ? (
                  <MessageCircle className="h-12 w-12 text-blue-300" />
                ) : (
                  <FileText className="h-12 w-12 text-blue-300" />
                )}
              </div>
            )}
            
            {/* 画像やAI応答以外のコンテンツの場合のみ表示 */}
            {result.type !== 'ai-response' && (
              <div className="p-3">
                <h3 className="font-medium text-sm text-blue-800">{result.title}</h3>
                <p className="text-xs text-blue-400 mt-1">
                  {result.type?.toUpperCase()}
                  {result.relevance && ` • 関連度 ${result.relevance.toFixed(0)}%`}
                </p>
                
                {/* コンテンツがある場合は表示 */}
                {result.content && (
                  <p className="text-xs text-blue-700 mt-2 mb-2 bg-blue-50 p-2 rounded">{result.content}</p>
                )}
                
                <div className="mt-2 flex">
                  <Button className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-full mr-2" size="sm">
                    詳細を見る
                  </Button>
                  <Button className="text-xs border border-blue-500 text-blue-600 hover:bg-blue-50 px-3 py-1 rounded-full" size="sm" variant="outline">
                    共有
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
