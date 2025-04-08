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
  keywords?: string[];
  details?: string;
  troubleshooting?: string[];
  emergency_procedure?: string;
}[] = [];

// 設定用データで初期化（アプリケーション起動時にロードされる）
async function loadMaintenanceVehicleData() {
  try {
    const response = await fetch('/extracted_data.json');
    if (!response.ok) {
      throw new Error('Failed to load maintenance vehicle data');
    }
    const data = await response.json();
    
    // データを正規化して保存
    if (data && data["保守用車データ"] && Array.isArray(data["保守用車データ"])) {
      maintenanceVehicleData = data["保守用車データ"].map((item: any, index: number) => ({
        id: item.id || `item_${index}`,
        title: item.title || '',
        category: item.category || '',
        description: item.description || '',
        image_path: item.image_path || '',
        keywords: item.keywords || [item.category, 'エンジン', '保守用車'],
        details: item.details || '',
        troubleshooting: item.troubleshooting || [],
        emergency_procedure: item.emergency_procedure || ''
      }));
    }
  } catch (error) {
    console.error("Failed to load maintenance vehicle data:", error);
    // ダミーデータで初期化
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
  keys: ['title', 'category', 'description', 'keywords', 'details'],
  threshold: 0.4
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
    // クエリの最適化を試みる
    try {
      const response = await apiRequest('POST', '/api/optimize-search-query', { text });
      const data = await response.json();
      text = data.optimizedQuery || text;
    } catch (error) {
      console.error('Error optimizing search query:', error);
      // 最適化に失敗した場合は元のテキストを使用
    }
    
    // Fuseインスタンスを取得して検索を実行
    const fuse = getFuseInstance();
    const searchResults = fuse.search(text);
    
    // 検索結果を必要な形式にマッピング
    return searchResults.map(result => {
      const item = result.item;
      // 画像パスの修正: 「uploads/」で始まる場合は先頭の「/」を追加
      const fixedImagePath = item.image_path?.startsWith('uploads/') 
        ? '/' + item.image_path 
        : item.image_path;
        
      console.log('画像パス変換:', item.image_path, '=>', fixedImagePath);
      
      return {
        id: item.id,
        title: item.title,
        type: 'image', // 画像検索結果
        url: fixedImagePath, // 修正された画像パス
        content: item.description, // 説明文を内容として表示
        relevance: (1 - (result.score || 0)) * 100 // スコアをパーセンテージの関連度に変換
      };
    });
  } catch (error) {
    console.error('Search error:', error);
    throw new Error('検索に失敗しました');
  }
};
