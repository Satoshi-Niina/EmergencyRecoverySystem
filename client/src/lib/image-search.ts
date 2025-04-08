import Fuse from 'fuse.js';
import { apiRequest } from './queryClient';

// 実際のデータファイルから保守用車のデータを読み込む
// 実装では初期化時にデータをロードする
let maintenanceVehicleData: {
  id: string | number;
  title: string;
  category: string;
  description: string;
  image_path?: string;
  all_slides?: string[];  // スライド画像のパス配列
  metadata_json?: string; // メタデータJSONへのパス
  keywords?: string[];
  details?: string;
  troubleshooting?: string[];
  emergency_procedure?: string;
}[] = [];

// 設定用データで初期化（アプリケーション起動時にロードされる）
async function loadMaintenanceVehicleData() {
  try {
    // キャッシュを回避するためにタイムスタンプを追加
    const timestamp = new Date().getTime();
    const response = await fetch(`/extracted_data.json?t=${timestamp}`);
    if (!response.ok) {
      throw new Error('Failed to load maintenance vehicle data');
    }
    const data = await response.json();
    
    // データを正規化して保存
    if (data && data["保守用車データ"] && Array.isArray(data["保守用車データ"])) {
      console.log(`保守用車データを読み込みました: ${data["保守用車データ"].length}件`);
      
      maintenanceVehicleData = data["保守用車データ"].map((item: any, index: number) => {
        // 画像パスのプレフィックスチェック（最初の/を除去して相対パスに統一）
        let imagePath = item.image_path || '';
        if (imagePath.startsWith('/')) {
          imagePath = imagePath.substring(1);
        }

        // 複数のスライド画像がある場合はそれも処理
        let allSlides: string[] = [];
        if (item.all_slides && Array.isArray(item.all_slides)) {
          allSlides = item.all_slides.map((slide: string) => {
            return slide.startsWith('/') ? slide.substring(1) : slide;
          });
        }
        
        return {
          id: item.id || `item_${index}`,
          title: item.title || '',
          category: item.category || '',
          description: item.description || '',
          image_path: imagePath,
          all_slides: allSlides.length > 0 ? allSlides : undefined,
          metadata_json: item.metadata_json || '',
          keywords: item.keywords || [item.category, 'エンジン', '保守用車'],
          details: item.details || '',
          troubleshooting: item.troubleshooting || [],
          emergency_procedure: item.emergency_procedure || ''
        };
      });
    }
  } catch (error) {
    console.error("Failed to load maintenance vehicle data:", error);
    // 基本データで初期化
    maintenanceVehicleData = [
      {
        id: "engine_001",
        category: "エンジン",
        title: "保守用車のエンジン型式",
        description: "軌道モータカーのエンジンは高トルクが出せるディーゼルエンジンを使用",
        image_path: "/uploads/images/engine_001.png",
        keywords: ["エンジン", "ディーゼル", "故障", "停止"]
      },
      {
        id: "cooling_001",
        category: "冷却システム",
        title: "エンジン冷却システム",
        description: "エンジン冷却システムは適切な動作温度を維持する",
        image_path: "/uploads/images/cooling_001.png",
        keywords: ["冷却", "オーバーヒート", "温度", "水漏れ"]
      },
      {
        id: "frame_001",
        category: "フレーム",
        title: "保守用車フレーム構造",
        description: "走行振動や応力による捻じれに耐えるフレーム構造",
        image_path: "/uploads/images/frame_001.png",
        keywords: ["フレーム", "構造", "強度", "振動"]
      },
      {
        id: "cabin_001",
        category: "運転キャビン",
        title: "運転キャビン仕様",
        description: "操作性と視認性を考慮した運転キャビン",
        image_path: "/uploads/images/cabin_001.png",
        keywords: ["キャビン", "運転", "操作", "視認性"]
      }
    ];
  }
}

// アプリケーション起動時にデータをロード
loadMaintenanceVehicleData();

// Fuse.js 検索設定
const fuseOptions = {
  includeScore: true,
  keys: [
    { name: 'title', weight: 0.3 },
    { name: 'category', weight: 0.2 },
    { name: 'description', weight: 0.3 },
    { name: 'keywords', weight: 0.5 },
    { name: 'details', weight: 0.4 }
  ],
  threshold: 0.4, // 高いほど広く検索
  ignoreLocation: true, // 単語の位置を無視して検索
  useExtendedSearch: true, // 拡張検索モード
};

// データが読み込まれたらFuseインスタンスを作成するヘルパー関数
function getFuseInstance() {
  return new Fuse(maintenanceVehicleData, fuseOptions);
}

/**
 * テキストクエリに基づいて保守用車のデータを検索
 * @param text 検索クエリテキスト
 * @returns 検索結果の配列
 */
export const searchByText = async (text: string): Promise<any[]> => {
  try {
    console.log('画像検索開始:', text);
    
    // 最初にデータが存在することを確認
    if (maintenanceVehicleData.length === 0) {
      console.log('データが読み込まれていないため再ロード');
      await loadMaintenanceVehicleData();
    }
    
    // クエリの最適化を試みる
    try {
      const response = await apiRequest('POST', '/api/optimize-search-query', { text });
      const data = await response.json();
      const optimizedQuery = data.optimizedQuery || text;
      console.log('検索クエリを最適化:', text, '->', optimizedQuery);
      text = optimizedQuery;
    } catch (error) {
      console.error('Error optimizing search query:', error);
      // 最適化に失敗した場合は元のテキストを使用
    }
    
    // Fuseインスタンスを取得して検索を実行
    const fuse = getFuseInstance();
    
    // キーワードを分割して検索
    const keywords = text.split(/\s+/).filter(k => k.length > 0);
    let searchResults: Fuse.FuseResult<any>[] = [];
    
    if (keywords.length > 1) {
      console.log(`複数キーワード検索: ${keywords.join(', ')}`);
      // 複数のキーワードがある場合、各キーワードで検索
      for (const keyword of keywords) {
        const results = fuse.search(keyword);
        searchResults.push(...results);
      }
      
      // 重複を除去（IDをキーとして使用）
      const uniqueResults = new Map<string | number, Fuse.FuseResult<any>>();
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
      // 画像パスの修正: スラッシュの有無を適切に処理
      let fixedImagePath = item.image_path || '';
      
      // スラッシュがない場合は追加、ダブルスラッシュになる場合は修正
      if (fixedImagePath && !fixedImagePath.startsWith('/') && !fixedImagePath.startsWith('http')) {
        fixedImagePath = '/' + fixedImagePath;
      }
      
      // もし複数の画像（スライド）がある場合は、最初のものを使用
      const allSlides = item.all_slides || [];
      if (allSlides.length > 0) {
        // スライド画像がある場合は最初のスライドを使用
        let slideImagePath = allSlides[0];
        if (slideImagePath && !slideImagePath.startsWith('/') && !slideImagePath.startsWith('http')) {
          slideImagePath = '/' + slideImagePath;
        }
        fixedImagePath = slideImagePath;
      }
      
      console.log('画像パス変換:', item.image_path, '=>', fixedImagePath);
      
      // メタデータJSONのパスがある場合はそれも含める
      let metadataJsonPath = item.metadata_json || null;
      if (metadataJsonPath && !metadataJsonPath.startsWith('/') && !metadataJsonPath.startsWith('http')) {
        metadataJsonPath = '/' + metadataJsonPath;
      }
      
      // 全スライド情報を適切に処理
      const processedSlides = (item.all_slides || []).map((slide: string) => {
        if (slide && !slide.startsWith('/') && !slide.startsWith('http')) {
          return '/' + slide;
        }
        return slide;
      });
      
      return {
        id: item.id,
        title: item.title,
        type: 'image', // 画像検索結果
        url: fixedImagePath, // 修正された画像パス
        content: item.description, // 説明文を内容として表示
        relevance: (1 - (result.score || 0)) * 100, // スコアをパーセンテージの関連度に変換
        metadata_json: metadataJsonPath, // メタデータJSONへのパス
        all_slides: processedSlides.length > 0 ? processedSlides : undefined, // 全スライド情報
        details: item.details // 詳細情報
      };
    });
  } catch (error) {
    console.error('Search error:', error);
    throw new Error('検索に失敗しました');
  }
};
