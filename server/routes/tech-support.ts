import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { processDocument, extractPdfText, extractWordText, extractExcelText, extractPptxText } from '../lib/document-processor';
import { addDocumentToKnowledgeBase } from '../lib/knowledge-base';

// ディレクトリ作成用ヘルパー関数
function ensureDirectoryExists(directory: string) {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
}

// アップロード先ディレクトリを設定（public/uploads に統一）
const publicUploadsDir = path.join(process.cwd(), 'public', 'uploads');
const publicImagesDir = path.join(publicUploadsDir, 'images');
const publicDataDir = path.join(publicUploadsDir, 'data');

// ディレクトリが存在することを確認
ensureDirectoryExists(publicUploadsDir);
ensureDirectoryExists(publicImagesDir);
ensureDirectoryExists(publicDataDir);

// Multerストレージ設定
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // 処理タイプによって保存先を変更
    const processingType = req.body.processingType || 'document';
    
    if (processingType === 'image_search' && 
        (file.mimetype.includes('svg') || file.mimetype.includes('image'))) {
      // 画像検索用の画像ファイルは公開imagesディレクトリに直接保存
      cb(null, publicImagesDir);
    } else {
      // 文書ファイルも公開uploads直下に保存
      cb(null, publicUploadsDir);
    }
  },
  filename: function (req, file, cb) {
    // 一意のファイル名を生成
    const uniqueId = Date.now().toString();
    const extname = path.extname(file.originalname);
    cb(null, `${file.originalname.split('.')[0].replace(/\s+/g, '_')}_${uniqueId}${extname}`);
  }
});

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    // 許可する拡張子
    const allowedExtensions = ['.pdf', '.docx', '.xlsx', '.pptx', '.svg', '.png', '.jpg', '.jpeg', '.gif'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`サポートされていないファイル形式です。サポート形式: ${allowedExtensions.join(', ')}`));
    }
  }
});

const router = express.Router();

/**
 * 技術サポート文書のアップロードと処理を行うエンドポイント
 */
// 画像検索データの初期化用エンドポイント
router.post('/init-image-search-data', async (req, res) => {
  try {
    console.log('画像検索データの初期化を実行します');
    
    // 画像検索データJSONファイルのパス
    const imageSearchDataPath = path.join(process.cwd(), 'public', 'uploads', 'data', 'image_search_data.json');
    const imagesDir = path.join(process.cwd(), 'public', 'uploads', 'images');
    
    // ディレクトリが存在するか確認し、なければ作成
    ensureDirectoryExists(path.join(process.cwd(), 'public', 'uploads', 'data'));
    ensureDirectoryExists(imagesDir);
    
    // 初期データを作成
    const initialData = [
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
    
    // 既存のimagesディレクトリから検出されたSVGファイルを追加
    try {
      // imagesディレクトリ内のすべてのSVGファイルを取得
      const svgFiles = fs.readdirSync(imagesDir)
        .filter(file => file.toLowerCase().endsWith('.svg'));
      
      for (const svgFile of svgFiles) {
        const svgId = svgFile.replace('.svg', '');
        // 既に初期データとして含まれていない場合のみ追加
        const exists = initialData.some(item => item.id === svgId);
        
        if (!exists) {
          // PNGファイルの存在を確認
          const pngFile = svgFile.replace('.svg', '.png');
          const hasPng = fs.existsSync(path.join(imagesDir, pngFile));
          
          // 新しいアイテム作成
          initialData.push({
            id: svgId,
            file: `/uploads/images/${svgFile}`,
            pngFallback: hasPng ? `/uploads/images/${pngFile}` : undefined,
            title: `${svgId.replace(/_/g, ' ')}`,
            category: 'アップロード済みSVG',
            keywords: [`${svgId}`, 'SVG', '図面'],
            description: `ファイル ${svgFile}`,
          });
        }
      }
    } catch (dirErr) {
      console.error('SVGファイル検出中にエラー:', dirErr);
    }
    
    // JSONファイルに保存
    fs.writeFileSync(imageSearchDataPath, JSON.stringify(initialData, null, 2));
    console.log(`画像検索データを初期化しました: ${initialData.length}件`);
    
    return res.json({
      success: true,
      count: initialData.length,
      message: '画像検索データを初期化しました'
    });
  } catch (error) {
    console.error('画像検索データ初期化エラー:', error);
    return res.status(500).json({
      error: '画像検索データの初期化に失敗しました',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// 技術文書アップロードエンドポイント
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "ファイルがアップロードされていません" });

    console.log(`ファイルアップロード処理開始: ${file.originalname}`);
    
    const filePath = file.path;
    const fileExt = path.extname(file.originalname).toLowerCase();
    const fileBaseName = path.basename(file.path);
    const filesDir = path.dirname(file.path);
    const processingType = req.body.processingType || 'document';
    
    console.log(`処理タイプ: ${processingType}`);
    console.log(`ファイルパス: ${filePath}`);
    console.log(`ファイル拡張子: ${fileExt}`);
    
    // 画像検索用データ処理の場合
    if (processingType === 'image_search' && ['.svg', '.png', '.jpg', '.jpeg', '.gif'].includes(fileExt)) {
      try {
        console.log("画像検索用データ処理を開始します");
        
        // ファイル名から一意のIDを生成
        const fileId = path.basename(filePath, fileExt).toLowerCase().replace(/\s+/g, '_');
        
        // SVGファイルの場合はPNGフォールバックを生成
        let pngFallbackPath = '';
        if (fileExt === '.svg') {
          try {
            // 公開ディレクトリ内のSVGファイルからPNGを生成
            const publicSvgPath = path.join(publicImagesDir, path.basename(filePath));
            pngFallbackPath = path.join(publicImagesDir, `${path.basename(filePath, '.svg')}.png`);
            console.log(`SVGからPNGフォールバックを生成: ${pngFallbackPath}`);
            
            // SVGをPNGに変換
            const svgContent = fs.readFileSync(publicSvgPath, 'utf8');
            const svgBuffer = Buffer.from(svgContent);
            
            await sharp(svgBuffer)
              .png()
              .toFile(pngFallbackPath);
            
            console.log(`PNGフォールバックを生成しました: ${pngFallbackPath}`);
          } catch (convErr) {
            console.error("SVGからPNGへの変換エラー:", convErr);
            // 変換に失敗してもそのまま続行
          }
        }
        
        // 画像検索データJSONを読み込むか新規作成
        const imageSearchDataPath = path.join(publicDataDir, 'image_search_data.json');
        let imageSearchData = [];
        
        if (fs.existsSync(imageSearchDataPath)) {
          try {
            const jsonContent = fs.readFileSync(imageSearchDataPath, 'utf8');
            imageSearchData = JSON.parse(jsonContent);
            console.log(`既存の画像検索データを読み込みました: ${imageSearchData.length}件`);
          } catch (jsonErr) {
            console.error("JSON読み込みエラー:", jsonErr);
            // 読み込みエラーの場合は新規作成
            imageSearchData = [];
          }
        }
        
        // タイトルと説明を生成（ファイル名から推測）
        const fileName = path.basename(file.originalname, fileExt);
        const title = fileName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        
        // カテゴリの推測
        let category = '';
        let keywords = [];
        
        if (fileName.includes('engine') || fileName.includes('motor')) {
          category = 'エンジン';
          keywords = ["エンジン", "モーター", "動力系"];
        } else if (fileName.includes('cooling') || fileName.includes('radiator')) {
          category = '冷却系統';
          keywords = ["冷却", "ラジエーター", "水漏れ"];
        } else if (fileName.includes('frame') || fileName.includes('chassis')) {
          category = '車体';
          keywords = ["フレーム", "シャーシ", "車体"];
        } else if (fileName.includes('cabin') || fileName.includes('cockpit')) {
          category = '運転室';
          keywords = ["キャビン", "運転室", "操作パネル"];
        } else {
          category = '保守用車パーツ';
          keywords = ["保守", "部品", "修理"];
        }
        
        // 新しい画像検索アイテムを作成
        const newImageItem = {
          id: fileId,
          file: `/uploads/images/${path.basename(filePath)}`,
          pngFallback: fileExt === '.svg' ? `/uploads/images/${path.basename(pngFallbackPath)}` : undefined,
          title: title,
          category: category,
          keywords: keywords,
          description: `保守用車の${category}に関する図面または写真です。`,
          metadata: {
            uploadDate: new Date().toISOString(),
            fileSize: file.size,
            fileType: fileExt.substring(1).toUpperCase()
          }
        };
        
        // 既存のデータに新しいアイテムを追加または更新
        const existingIndex = imageSearchData.findIndex((item: any) => item.id === fileId);
        if (existingIndex >= 0) {
          imageSearchData[existingIndex] = newImageItem;
        } else {
          imageSearchData.push(newImageItem);
        }
        
        // 更新したデータを書き込み
        fs.writeFileSync(imageSearchDataPath, JSON.stringify(imageSearchData, null, 2));
        console.log(`画像検索データを更新しました: ${imageSearchData.length}件`);
        
        // 結果を返す
        return res.json({
          success: true,
          message: "画像検索用データが正常に処理されました",
          file: {
            id: fileId,
            name: file.originalname,
            path: `/uploads/images/${path.basename(filePath)}`,
            pngFallbackPath: fileExt === '.svg' ? `/uploads/images/${path.basename(pngFallbackPath)}` : undefined,
            size: file.size,
          },
          imageSearchData: {
            totalItems: imageSearchData.length,
            newItem: newImageItem
          }
        });
      } catch (imgError) {
        console.error("画像検索データ処理エラー:", imgError);
        return res.status(500).json({
          error: "画像検索データの処理中にエラーが発生しました",
          details: imgError instanceof Error ? imgError.message : String(imgError)
        });
      }
    }
    
    // 通常の文書処理（従来のコード）
    let extractedText = "";
    let pageCount = 0;
    let metadata: any = {};
    
    try {
      switch (fileExt) {
        case '.pdf':
          const pdfResult = await extractPdfText(filePath);
          extractedText = pdfResult.text;
          pageCount = pdfResult.pageCount;
          metadata = { pageCount, type: 'pdf' };
          break;
        
        case '.docx':
          extractedText = await extractWordText(filePath);
          metadata = { type: 'docx' };
          break;
          
        case '.xlsx':
          extractedText = await extractExcelText(filePath);
          metadata = { type: 'xlsx' };
          break;
          
        case '.pptx':
          extractedText = await extractPptxText(filePath);
          // PPTXの場合は画像も抽出済み
          metadata = { 
            type: 'pptx',
            // スライド画像へのパスをメタデータに追加
            slideImages: Array.from({length: 4}, (_, i) => 
              `/uploads/images/${path.basename(filePath, path.extname(filePath))}_${(i+1).toString().padStart(3, '0')}.png`
            )
          };
          break;
      }
      
      // extracted_data.jsonへのデータ追加
      const extractedDataPath = path.join(process.cwd(), 'extracted_data.json');
      
      // ファイルが存在するか確認し、存在しない場合は空のJSONを作成
      if (!fs.existsSync(extractedDataPath)) {
        fs.writeFileSync(extractedDataPath, JSON.stringify({ vehicleData: [] }, null, 2));
      }
      
      // 既存データの読み込み
      const extractedData = JSON.parse(fs.readFileSync(extractedDataPath, 'utf-8'));
      
      // 車両データキーが存在するか確認
      const vehicleDataKey = 'vehicleData';
      if (!extractedData[vehicleDataKey]) {
        extractedData[vehicleDataKey] = [];
      }
      
      const vehicleData = extractedData[vehicleDataKey];
      
      // 新規データの追加
      const newData = {
        id: path.basename(filePath, path.extname(filePath)),
        category: fileExt.substring(1).toUpperCase(),
        title: file.originalname,
        description: `技術サポート文書: ${file.originalname}`,
        details: extractedText.substring(0, 200) + "...", // 概要のみ格納
        image_path: metadata.type === 'pptx' ? metadata.slideImages[0] : null,
        all_slides: metadata.type === 'pptx' ? metadata.slideImages : null,
        metadata_json: `${filesDir}/${fileBaseName}_metadata.json`,
        keywords: [fileExt.substring(1).toUpperCase(), "技術文書", "サポート", file.originalname]
      };
      
      // JSONメタデータファイルの保存
      const metadataContent = {
        filename: file.originalname,
        filePath: filePath,
        uploadDate: new Date().toISOString(),
        fileSize: file.size,
        mimeType: file.mimetype,
        extractedText: extractedText,
        ...metadata
      };
      
      fs.writeFileSync(`${filePath}_metadata.json`, JSON.stringify(metadataContent, null, 2));
      
      // 車両データに追加
      const existingIndex = vehicleData.findIndex((item: any) => item.id === newData.id);
      if (existingIndex >= 0) {
        vehicleData[existingIndex] = newData;
      } else {
        vehicleData.push(newData);
      }
      
      // 更新したデータを書き込み
      fs.writeFileSync(extractedDataPath, JSON.stringify(extractedData, null, 2));
      
      // ナレッジベースへの追加を試みる
      try {
        await addDocumentToKnowledgeBase(filePath);
      } catch (kbError) {
        console.error("ナレッジベースへの追加エラー:", kbError);
        // ナレッジベースへの追加に失敗しても処理は続行
      }
      
      return res.json({
        success: true,
        file: {
          id: newData.id,
          name: file.originalname,
          path: filePath,
          size: file.size,
        },
        extractedTextPreview: extractedText.substring(0, 200) + "...",
        metadata: metadata
      });
      
    } catch (processingError) {
      console.error("ファイル処理エラー:", processingError);
      return res.status(500).json({ 
        error: "ファイル処理中にエラーが発生しました", 
        details: processingError instanceof Error ? processingError.message : String(processingError)
      });
    }
    
  } catch (error) {
    console.error("アップロードエラー:", error);
    return res.status(500).json({ 
      error: "ファイルのアップロードに失敗しました", 
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;