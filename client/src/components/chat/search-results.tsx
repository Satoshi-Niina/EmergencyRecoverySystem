import { Button } from "@/components/ui/button";
import { X, ExternalLink, FileText, MessageCircle } from "lucide-react";
import { useOrientation } from "@/hooks/use-orientation";
import { useIsMobile } from "@/hooks/use-mobile";

interface SearchResult {
  id: number | string;
  title: string;
  type: string; // 'image' | 'svg-image' | 'text' | 'ai-response' | string
  url?: string;
  pngFallbackUrl?: string; // SVG画像の代替PNG URL
  content?: string;
  relevance?: number;
  timestamp?: Date;
  metadata_json?: string;
  all_slides?: string[];
  details?: string;
}

interface SearchResultsProps {
  results: SearchResult[];
  onClear: () => void;
}

export default function SearchResults({ results, onClear }: SearchResultsProps) {
  const orientation = useOrientation();
  const { isMobile } = useIsMobile();
  
  // 検索結果がない場合は何も表示しない
  if (results.length === 0) {
    return null;
  }

  // デバイスに応じたレイアウトクラス
  // iPhoneの場合は特別なスタイルを適用
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  
  // 画面方向に応じたスタイルの設定
  const isLandscape = orientation === 'landscape';
  
  // モバイル&横向きの場合は全画面表示、それ以外は通常表示
  const containerClass = isMobile && isLandscape
    ? "fixed inset-0 z-50 bg-white p-4 overflow-auto chat-controls-container"
    : "p-4";

  return (
    <div className={containerClass}>
      <div className="sticky top-0 bg-white p-1 shadow-sm z-10">
        <div className="flex justify-between items-center mb-1">
          <h2 className="font-semibold text-lg text-blue-700">検索画像表示</h2>
          <Button variant="ghost" size="icon" onClick={onClear} className="text-blue-600 hover:bg-blue-100 rounded-full">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <p className="text-xs text-blue-500 mb-2">プレビューをタップすると拡大画像と説明が表示されます！</p>
      </div>
      
      {/* 縦画面時はスクロール可能なコンテナ、横画面時はフレックスレイアウト */}
      <div className={`fuse-result-container ${isLandscape ? 'fuse-landscape-wrapper' : ''}`}>
        {results.map((result) => (
          <div 
            key={result.id} 
            className={`fuse-result-item rounded-lg border border-blue-200 overflow-hidden bg-white shadow-sm mb-4 ${isLandscape ? '' : 'mr-4'}`}
          >
            <div className={`fuse-wrapper ${isLandscape ? 'fuse-landscape' : ''}`}>
              <div className={`fuse-image-container ${isLandscape ? 'fuse-image-landscape' : ''}`}>
                {result.url ? (
                  // 画像結果 (SVG画像もサポート)
                  <img 
                    src={result.url} 
                    alt={result.title || "保守用車情報"} 
                    className={`w-full ${isLandscape ? 'h-52' : 'h-40'} object-cover border-b border-blue-100`}
                    // SVG画像が読み込めない場合はPNG代替を使用
                    onError={(e) => {
                      const imgElement = e.currentTarget;
                      if (result.pngFallbackUrl && result.url !== result.pngFallbackUrl) {
                        console.log('SVG読み込みエラー、PNG代替に切り替え:', result.url, '->', result.pngFallbackUrl);
                        imgElement.src = result.pngFallbackUrl;
                      }
                    }}
                    onClick={() => {
                      // Open image preview modal
                      window.dispatchEvent(new CustomEvent('preview-image', { 
                        detail: { 
                          url: result.url,
                          pngFallbackUrl: result.pngFallbackUrl, // PNG代替URLも渡す
                          metadata_json: result.metadata_json,
                          all_slides: result.all_slides
                        } 
                      }));
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
              </div>
              
              {/* 画像やAI応答以外のコンテンツの場合のみ表示 */}
              {result.type !== 'ai-response' && (
                <div className={`p-3 fuse-content-container ${isLandscape ? 'fuse-content-landscape' : ''}`}>
                  <h3 className="font-medium text-md text-blue-800">{result.title || "保守用車情報"}</h3>
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
          </div>
        ))}
      </div>
    </div>
  );
}
