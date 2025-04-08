import Fuse from 'fuse.js';
import { apiRequest } from './queryClient';

// 画像検索用の専用インターフェース定義
interface ImageSearchItem {
  id: string | number;
  file: string;
  pngFallback?: string;
  title: string;
  category: string;
  keywords: string[];
  description: string;
  metadata?: any;
  all_slides?: string[];
  details?: string;
}

// 画像検索用データ
let imageSearchData: ImageSearchItem[] = [];

// 画像検索専用JSONデータを読み込む
async function loadImageSearchData() {
  try {
    // キャッシュを回避するためにタイムスタンプを追加
    const timestamp = new Date().getTime();
    const response = await fetch(`/uploads/data/image_search_data.json?t=${timestamp}`);
    if (!response.ok) {
      throw new Error('Failed to load image search data');
    }
    const data = await response.json();
    
    if (Array.isArray(data)) {
      console.log(`画像検索データを読み込みました: ${data.length}件`);
      imageSearchData = data;
    } else {
      throw new Error('Invalid image search data format');
    }
  } catch (error) {
    console.error("画像検索データの読み込みに失敗しました:", error);
    
    // エラーを報告し、サーバーに画像検索データの再生成をリクエスト
    try {
      const initResponse = await fetch('/api/tech-support/init-image-search-data', {
        method: 'POST'
      });
      
      if (initResponse.ok) {
        const initData = await initResponse.json();
        console.log("画像検索データを初期化しました:", initData);
        
        // 再度データを読み込み
        const reloadResponse = await fetch(`/uploads/data/image_search_data.json?t=${Date.now()}`);
        if (reloadResponse.ok) {
          const reloadedData = await reloadResponse.json();
          if (Array.isArray(reloadedData)) {
            console.log(`再読み込みした画像検索データ: ${reloadedData.length}件`);
            imageSearchData = reloadedData;
            return;
          }
        }
      }
    } catch (initError) {
      console.error("画像検索データの初期化に失敗:", initError);
    }
    
    // それでも失敗した場合は直接JSONファイルを読み込む（エラーハンドリング用）
    console.log("直接JSONからの読み込みを試みます");
    try {
      const directFetch = await fetch('/uploads/data/image_search_data.json', { 
        cache: 'no-store',  // キャッシュを無視
        headers: { 'pragma': 'no-cache', 'cache-control': 'no-cache' }
      });
      if (directFetch.ok) {
        const directData = await directFetch.json();
        if (Array.isArray(directData) && directData.length > 0) {
          console.log(`直接JSONから画像検索データを読み込みました: ${directData.length}件`);
          imageSearchData = directData;
          return;
        }
      }
    } catch (directError) {
      console.error("直接JSONからの読み込みに失敗:", directError);
    }
    
    // それでも失敗した場合はフォールバックデータ
    console.log("フォールバック画像検索データを使用します");
    // データ構造は実際のJSONファイルと同じ構造を保持
    imageSearchData = [
      {
        id: "engine_001",
        file: "/uploads/images/engine_001.svg",
        pngFallback: "/uploads/images/engine_001.png",
        title: "エンジン基本構造図",
        category: "エンジン",
        keywords: ["エンジン", "モーター", "動力系", "駆動部"],
        description: "保守用車のディーゼルエンジン基本構造図。主要部品とその配置を示す。"
      },
      {
        id: "cooling_001",
        file: "/uploads/images/cooling_001.svg",
        pngFallback: "/uploads/images/cooling_001.png",
        title: "冷却システム概略図",
        category: "冷却系統",
        keywords: ["冷却", "ラジエーター", "水漏れ", "オーバーヒート"],
        description: "保守用車の冷却システム概略図。冷却水の流れと主要コンポーネントを表示。"
      },
      {
        id: "frame_001",
        file: "/uploads/images/frame_001.svg",
        pngFallback: "/uploads/images/frame_001.png",
        title: "車体フレーム構造",
        category: "車体",
        keywords: ["フレーム", "シャーシ", "車体", "構造", "強度部材"],
        description: "保守用車の車体フレーム構造図。サイドメンバーとクロスメンバーの配置を表示。"
      },
      {
        id: "cabin_001",
        file: "/uploads/images/cabin_001.svg",
        pngFallback: "/uploads/images/cabin_001.png",
        title: "運転キャビン配置図",
        category: "運転室",
        keywords: ["キャビン", "運転室", "操作パネル", "計器盤"],
        description: "保守用車の運転キャビン内部配置図。操作機器と計器類の位置を表示。"
      }
    ];
  }
}

// アプリケーション起動時にデータをロード
loadImageSearchData();

// データを強制的に再読み込む関数を提供
export const reloadImageSearchData = () => {
  console.log('画像検索データを強制的に再読み込みします');
  loadImageSearchData();
};

// 画像検索データが更新されたときにリロードするイベントリスナー
window.addEventListener('image-search-data-updated', () => {
  console.log('画像検索データの更新を検知しました。再読み込みします。');
  loadImageSearchData();
});

// Fuse.js 画像検索用の設定
const fuseOptions = {
  includeScore: true,
  keys: [
    { name: 'title', weight: 0.4 },
    { name: 'category', weight: 0.3 },
    { name: 'description', weight: 0.3 },
    { name: 'keywords', weight: 0.7 }, // キーワードの重みをさらに強化
    { name: 'metadata', weight: 0.2 }, // メタデータも検索対象に
    { name: 'details', weight: 0.4 }
  ],
  threshold: 0.5, // 閾値を上げることで、より広く検索結果を取得
  ignoreLocation: true, // 単語の位置を無視して検索
  useExtendedSearch: true, // 拡張検索モード
  minMatchCharLength: 2, // 最低2文字一致から検索対象に
  distance: 300, // 単語間の距離制限を緩める（より広く検索）
};

// 画像検索用のFuseインスタンスを作成するヘルパー関数
function getFuseInstance() {
  return new Fuse(imageSearchData, fuseOptions);
}

/**
 * テキストクエリに基づいて画像データを検索
 * @param text 検索クエリテキスト
 * @returns 検索結果の配列
 */
export const searchByText = async (text: string): Promise<any[]> => {
  try {
    console.log('画像検索開始:', text);
    
    // 最初にデータが存在することを確認
    if (imageSearchData.length === 0) {
      console.log('画像検索データが読み込まれていないため再ロード');
      await loadImageSearchData();
    }
    
    // クエリの最適化を試みる
    try {
      const response = await apiRequest('POST', '/api/optimize-search-query', { text });
      const data = await response.json();
      const optimizedQuery = data.optimizedQuery || text;
      console.log('検索クエリを最適化:', text, '->', optimizedQuery);
      text = optimizedQuery;
    } catch (error) {
      console.error('検索クエリ最適化エラー:', error);
      // 最適化に失敗した場合は元のテキストを使用
    }
    
    // Fuseインスタンスを取得して検索を実行
    const fuse = getFuseInstance();
    
    // キーワードを分割して検索
    const keywords = text.split(/\s+/).filter(k => k.length > 0);
    let searchResults: any[] = [];
    
    if (keywords.length > 1) {
      console.log(`複数キーワード検索: ${keywords.join(', ')}`);
      // 複数のキーワードがある場合、各キーワードで検索
      for (const keyword of keywords) {
        const results = fuse.search(keyword);
        searchResults.push(...results);
      }
      
      // 重複を除去（IDをキーとして使用）
      const uniqueResults = new Map<string | number, any>();
      searchResults.forEach(result => {
        const existingResult = uniqueResults.get(result.item.id);
        if (!existingResult || (existingResult.score && result.score && result.score < existingResult.score)) {
          uniqueResults.set(result.item.id, result);
        }
      });
      
      searchResults = Array.from(uniqueResults.values());
    } else {
      console.log(`単一キーワード検索: ${text}`);
      searchResults = fuse.search(text);
    }
    
    console.log(`検索結果: ${searchResults.length}件見つかりました`);
    
    // 検索結果を必要な形式にマッピング
    return searchResults.map(result => {
      const item = result.item;
      
      // SVG/PNG画像パスの処理
      let imageUrl = item.file || '';
      let pngFallbackUrl = item.pngFallback || '';
      
      // スラッシュの処理 (パスの正規化)
      if (imageUrl && !imageUrl.startsWith('/') && !imageUrl.startsWith('http')) {
        imageUrl = '/' + imageUrl;
      }
      
      if (pngFallbackUrl && !pngFallbackUrl.startsWith('/') && !pngFallbackUrl.startsWith('http')) {
        pngFallbackUrl = '/' + pngFallbackUrl;
      }
      
      // 画像の種類を決定
      const imageType = imageUrl.toLowerCase().endsWith('.svg') ? 'svg-image' : 'image';
      
      // メタデータをJSON文字列に変換
      const metadataStr = item.metadata ? JSON.stringify(item.metadata) : undefined;
      
      // 処理されたスライドパス
      const processedSlides = (item.all_slides || []).map((slide: string) => {
        if (slide && !slide.startsWith('/') && !slide.startsWith('http')) {
          return '/' + slide;
        }
        return slide;
      });
      
      // 検索結果のフォーマット
      return {
        id: item.id,
        title: item.title,
        type: imageType,
        url: imageUrl,
        pngFallbackUrl: pngFallbackUrl || undefined,
        content: item.description,
        relevance: (1 - (result.score || 0)) * 100, // スコアをパーセンテージの関連度に変換
        metadata_json: metadataStr, // JSONとして処理できるようにメタデータを文字列化
        all_slides: processedSlides.length > 0 ? processedSlides : undefined,
        details: item.details
      };
    });
  } catch (error) {
    console.error('画像検索エラー:', error);
    throw new Error('画像検索に失敗しました');
  }
};