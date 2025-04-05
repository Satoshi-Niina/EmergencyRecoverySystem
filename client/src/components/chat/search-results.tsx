import { Button } from "@/components/ui/button";
import { X, ExternalLink, FileText } from "lucide-react";

interface SearchResult {
  id: number;
  title: string;
  type: string;
  url: string;
  relevance?: number;
}

interface SearchResultsProps {
  results: SearchResult[];
  onClear: () => void;
}

export default function SearchResults({ results, onClear }: SearchResultsProps) {
  if (results.length === 0) {
    return (
      <div className="p-4">
        <h2 className="font-semibold text-lg mb-3">検索結果</h2>
        <p className="text-center text-neutral-300 py-4">検索結果はありません</p>
        <p className="text-sm text-center text-neutral-300">
          テキストを選択して検索するか、画像検索機能を使用してください。
        </p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-3">
        <h2 className="font-semibold text-lg">検索結果</h2>
        <Button variant="ghost" size="icon" onClick={onClear}>
          <X className="h-5 w-5" />
        </Button>
      </div>
      
      <div className="space-y-4">
        {results.map((result) => (
          <div key={result.id} className="rounded-lg border border-neutral-200 overflow-hidden">
            {result.url ? (
              <img 
                src={result.url} 
                alt={result.title} 
                className="w-full h-40 object-cover" 
                onClick={() => {
                  // Open image preview modal
                  window.dispatchEvent(new CustomEvent('preview-image', { detail: { url: result.url } }));
                }}
              />
            ) : (
              <div className="h-40 bg-neutral-100 flex items-center justify-center">
                <FileText className="h-12 w-12 text-neutral-300" />
              </div>
            )}
            <div className="p-3">
              <h3 className="font-medium text-sm">{result.title}</h3>
              <p className="text-xs text-neutral-300 mt-1">
                {result.type?.toUpperCase()}
                {result.relevance && ` • 関連度 ${result.relevance.toFixed(0)}%`}
              </p>
              <div className="mt-2 flex">
                <Button className="text-xs bg-primary text-white px-3 py-1 rounded-full mr-2" size="sm">
                  詳細を見る
                </Button>
                <Button className="text-xs border border-primary text-primary px-3 py-1 rounded-full" size="sm" variant="outline">
                  共有
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
