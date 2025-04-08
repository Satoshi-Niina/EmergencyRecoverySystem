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
  
  // 検索結果がない場合も空のパネルを表示する
  // 検索結果の有無に関わらず、常にヘッダーだけは表示する

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
      <div className="sticky top-0 bg-transparent p-3 shadow-sm z-10 border-b border-blue-200 mb-3">
        <div className="flex justify-center items-center">
          <h2 className="font-bold text-lg text-blue-700">検索画像表示</h2>
        </div>
      </div>
      
      {/* サムネイル縦一列表示 */}
      <div className="flex flex-col gap-4 p-2">
        {results.map((result) => (
          <div 
            key={result.id} 
            className="thumbnail-item rounded-lg overflow-hidden bg-white shadow-sm w-full"
            onClick={() => {
              // イメージプレビューモーダルを表示
              window.dispatchEvent(new CustomEvent('preview-image', { 
                detail: { 
                  url: result.url,
                  pngFallbackUrl: result.pngFallbackUrl,
                  title: result.title,
                  content: result.content,
                  metadata_json: result.metadata_json,
                  all_slides: result.all_slides
                } 
              }));
            }}
          >
            {result.url ? (
              // 画像サムネイル (横長スタイル)
              <div className="flex h-24 w-full bg-gray-50 border-b border-gray-200">
                <div className="relative w-32 h-24 flex-shrink-0">
                  <img 
                    src={result.url} 
                    alt={result.title || "保守用車情報"} 
                    className="w-full h-full object-contain bg-white p-1"
                    // SVG画像が読み込めない場合はPNG代替を使用
                    onError={(e) => {
                      const imgElement = e.currentTarget;
                      if (result.pngFallbackUrl && result.url !== result.pngFallbackUrl) {
                        console.log('SVG読み込みエラー、PNG代替に切り替え:', result.url, '->', result.pngFallbackUrl);
                        imgElement.src = result.pngFallbackUrl;
                      }
                    }}
                  />
                </div>
                <div className="flex-1 p-2 flex flex-col justify-center">
                  <h3 className="text-sm font-medium text-blue-800">{result.title || "保守用車情報"}</h3>
                  {result.content && (
                    <p className="text-xs text-gray-600 line-clamp-2 mt-1">{result.content}</p>
                  )}
                </div>
              </div>
            ) : (
              // テキストコンテンツとドキュメント (横長スタイル)
              <div className="flex h-24 w-full bg-gray-50 border-b border-gray-200">
                <div className="relative w-24 h-24 flex-shrink-0 flex items-center justify-center bg-blue-50">
                  {result.type === 'ai-response' ? (
                    <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center">
                      <span className="material-icons text-white">smart_toy</span>
                    </div>
                  ) : result.type === 'text' ? (
                    <MessageCircle className="h-12 w-12 text-blue-500" />
                  ) : (
                    <FileText className="h-12 w-12 text-blue-500" />
                  )}
                </div>
                <div className="flex-1 p-2 flex flex-col justify-center">
                  <h3 className="text-sm font-medium text-blue-800">{result.title || (result.type === 'ai-response' ? "AI応答" : "ドキュメント")}</h3>
                  {result.content && (
                    <p className="text-xs text-gray-600 line-clamp-2 mt-1">{result.content}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
