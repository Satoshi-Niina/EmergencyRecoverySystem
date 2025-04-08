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
      <div className="sticky top-0 bg-blue-600 p-3 shadow-sm z-10 border-b border-blue-700 mb-3">
        <div className="flex justify-center items-center">
          <h2 className="font-bold text-lg text-white">検索画像表示</h2>
        </div>
      </div>
      
      {/* サムネイルグリッド表示 */}
      <div className="grid grid-cols-2 gap-4 p-2">
        {results.map((result) => (
          <div 
            key={result.id} 
            className="thumbnail-item rounded-lg overflow-hidden bg-white shadow-sm"
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
              // 画像サムネイル (SVG画像もサポート)
              <div className="relative aspect-square">
                <img 
                  src={result.url} 
                  alt={result.title || "保守用車情報"} 
                  className="w-full h-full object-cover"
                  // SVG画像が読み込めない場合はPNG代替を使用
                  onError={(e) => {
                    const imgElement = e.currentTarget;
                    if (result.pngFallbackUrl && result.url !== result.pngFallbackUrl) {
                      console.log('SVG読み込みエラー、PNG代替に切り替え:', result.url, '->', result.pngFallbackUrl);
                      imgElement.src = result.pngFallbackUrl;
                    }
                  }}
                />
                <div className="absolute bottom-0 left-0 right-0 bg-blue-700 bg-opacity-80 p-1 text-center">
                  <p className="text-xs font-medium text-white truncate">{result.title || "保守用車情報"}</p>
                </div>
              </div>
            ) : result.type === 'ai-response' ? (
              // AI応答サムネイル
              <div className="h-full bg-blue-50 flex items-center justify-center p-2 aspect-square">
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center mb-2">
                    <span className="material-icons text-white text-sm">smart_toy</span>
                  </div>
                  <p className="text-xs text-blue-700 truncate text-center">{result.title || "AI応答"}</p>
                </div>
              </div>
            ) : (
              // その他のドキュメントサムネイル
              <div className="h-full bg-blue-50 flex items-center justify-center p-2 aspect-square">
                <div className="flex flex-col items-center">
                  {result.type === 'text' ? (
                    <MessageCircle className="h-10 w-10 text-blue-400 mb-2" />
                  ) : (
                    <FileText className="h-10 w-10 text-blue-400 mb-2" />
                  )}
                  <p className="text-xs text-blue-700 truncate text-center">{result.title || "ドキュメント"}</p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
