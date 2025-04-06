import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
  processDocument, 
  ProcessedDocument, 
  DocumentChunk 
} from './document-processor';
import { storage } from '../storage';

// ESM環境で__dirnameを再現
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 知識ベースのルートディレクトリ
const KNOWLEDGE_BASE_DIR = path.join(__dirname, '../../knowledge-base');

// 知識ベースのインデックスファイル
const KNOWLEDGE_INDEX_FILE = path.join(KNOWLEDGE_BASE_DIR, 'index.json');

// 知識ベースのインデックス構造
interface KnowledgeBaseIndex {
  documents: {
    id: string;
    title: string;
    path: string;
    type: string;
    chunkCount: number;
    addedAt: string;
  }[];
}

/**
 * 知識ベースディレクトリを初期化する
 */
export function initializeKnowledgeBase(): void {
  // ディレクトリが存在しない場合は作成
  if (!fs.existsSync(KNOWLEDGE_BASE_DIR)) {
    fs.mkdirSync(KNOWLEDGE_BASE_DIR, { recursive: true });
    console.log(`Created knowledge base directory at ${KNOWLEDGE_BASE_DIR}`);
  }

  // インデックスファイルが存在しない場合は作成
  if (!fs.existsSync(KNOWLEDGE_INDEX_FILE)) {
    const emptyIndex: KnowledgeBaseIndex = { documents: [] };
    fs.writeFileSync(KNOWLEDGE_INDEX_FILE, JSON.stringify(emptyIndex, null, 2));
    console.log(`Created knowledge base index at ${KNOWLEDGE_INDEX_FILE}`);
  }
}

/**
 * 知識ベースインデックスを読み込む
 */
export function loadKnowledgeBaseIndex(): KnowledgeBaseIndex {
  try {
    if (fs.existsSync(KNOWLEDGE_INDEX_FILE)) {
      const indexData = fs.readFileSync(KNOWLEDGE_INDEX_FILE, 'utf8');
      return JSON.parse(indexData);
    }
    return { documents: [] };
  } catch (err) {
    console.error('Error loading knowledge base index:', err);
    return { documents: [] };
  }
}

/**
 * 知識ベースインデックスを保存する
 */
export function saveKnowledgeBaseIndex(index: KnowledgeBaseIndex): void {
  try {
    fs.writeFileSync(KNOWLEDGE_INDEX_FILE, JSON.stringify(index, null, 2));
  } catch (err) {
    console.error('Error saving knowledge base index:', err);
  }
}

/**
 * ドキュメントを知識ベースに追加する
 * @param filePath 追加するファイルのパス
 */
export async function addDocumentToKnowledgeBase(filePath: string): Promise<string> {
  try {
    // 知識ベースを初期化
    initializeKnowledgeBase();
    
    // ドキュメントを処理
    const processedDoc = await processDocument(filePath);
    
    // ユニークなIDを生成
    const docId = `doc_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    
    // ドキュメントをDBに保存（あるいはローカルファイルシステムに）
    await storeProcessedDocument(docId, processedDoc);
    
    // インデックスを更新
    const index = loadKnowledgeBaseIndex();
    index.documents.push({
      id: docId,
      title: processedDoc.metadata.title,
      path: processedDoc.metadata.source,
      type: processedDoc.metadata.type,
      chunkCount: processedDoc.chunks.length,
      addedAt: new Date().toISOString()
    });
    saveKnowledgeBaseIndex(index);
    
    return docId;
  } catch (err: any) {
    console.error('Error adding document to knowledge base:', err);
    throw new Error(`Failed to add document: ${err.message}`);
  }
}

/**
 * 処理済みドキュメントを保存する
 * @param docId ドキュメントID
 * @param doc 処理済みドキュメント
 */
async function storeProcessedDocument(docId: string, doc: ProcessedDocument): Promise<void> {
  // ドキュメントメタデータを保存
  const docDir = path.join(KNOWLEDGE_BASE_DIR, docId);
  if (!fs.existsSync(docDir)) {
    fs.mkdirSync(docDir, { recursive: true });
  }
  
  // メタデータファイルを保存
  fs.writeFileSync(
    path.join(docDir, 'metadata.json'), 
    JSON.stringify(doc.metadata, null, 2)
  );
  
  // チャンクをJSONファイルとして保存
  fs.writeFileSync(
    path.join(docDir, 'chunks.json'),
    JSON.stringify(doc.chunks, null, 2)
  );
  
  // 各チャンクをDBに保存（オプション）
  // この部分はDBスキーマに応じて実装
  for (const chunk of doc.chunks) {
    try {
      await storage.createKeyword({
        documentId: parseInt(docId.split('_')[1]), // DBの外部キー制約に合わせる必要がある
        word: chunk.text.substring(0, 255), // キーワードフィールドの長さ制限に注意
      });
    } catch (err) {
      console.error('Error creating keyword:', err);
    }
  }
}

/**
 * クエリに関連する知識ベースのチャンクを検索
 * @param query 検索クエリ
 * @returns 関連するチャンク
 */
export async function searchKnowledgeBase(query: string): Promise<DocumentChunk[]> {
  try {
    console.log(`検索クエリ: "${query}"`);
    
    // 知識ベースを初期化
    initializeKnowledgeBase();
    
    // インデックスを読み込み
    const index = loadKnowledgeBaseIndex();
    console.log(`インデックス内のドキュメント数: ${index.documents.length}`);
    
    // 検索結果を格納する配列
    const relevantChunks: DocumentChunk[] = [];
    
    // すべてのドキュメントを検索
    for (const docInfo of index.documents) {
      console.log(`ドキュメント検索: ${docInfo.title} (ID: ${docInfo.id})`);
      const docDir = path.join(KNOWLEDGE_BASE_DIR, docInfo.id);
      
      // チャンクファイルが存在する場合は読み込む
      const chunksFile = path.join(docDir, 'chunks.json');
      
      if (fs.existsSync(chunksFile)) {
        console.log(`チャンクファイル発見: ${chunksFile}`);
        const chunks: DocumentChunk[] = JSON.parse(fs.readFileSync(chunksFile, 'utf8'));
        
        // 単純なキーワードマッチング（本来はベクトル検索やより高度な方法を使用）
        const matchingChunks = chunks.filter(chunk => 
          chunk.text.toLowerCase().includes(query.toLowerCase())
        );
        
        console.log(`マッチしたチャンク数: ${matchingChunks.length}`);
        relevantChunks.push(...matchingChunks);
      } else {
        // チャンクファイルが存在しない場合は、オリジナルのファイルを直接検索
        console.log(`チャンクファイルが見つからないため、オリジナルファイルを検索: ${docInfo.path}`);
        if (fs.existsSync(docInfo.path)) {
          try {
            const fileContent = fs.readFileSync(docInfo.path, 'utf8');
            
            // テキストをチャンクに分割
            const textChunks = chunkText(fileContent, { source: docInfo.title });
            console.log(`作成されたチャンク数: ${textChunks.length}`);
            
            // クエリでフィルタリング
            const matchingChunks = textChunks.filter(chunk => 
              chunk.text.toLowerCase().includes(query.toLowerCase())
            );
            
            console.log(`マッチしたチャンク数: ${matchingChunks.length}`);
            relevantChunks.push(...matchingChunks);
            
            // チャンクをファイルに保存するためのディレクトリを作成
            if (!fs.existsSync(docDir)) {
              fs.mkdirSync(docDir, { recursive: true });
            }
            
            // チャンクをファイルに保存
            fs.writeFileSync(chunksFile, JSON.stringify(textChunks, null, 2));
            console.log(`チャンクを保存しました: ${chunksFile}`);
          } catch (fileErr) {
            console.error(`ファイル読み込みエラー (${docInfo.path}):`, fileErr);
          }
        } else {
          console.log(`オリジナルファイルも見つかりません: ${docInfo.path}`);
        }
      }
    }
    
    // 上位15件に制限（結果を増やす）
    return relevantChunks.slice(0, 15);
  } catch (err) {
    console.error('Error searching knowledge base:', err);
    return [];
  }
}

/**
 * ナレッジベースからシステムプロンプトを生成
 * @param query ユーザーの質問
 */
export async function generateSystemPromptWithKnowledge(query: string): Promise<string> {
  // 関連するチャンクを検索
  const relevantChunks = await searchKnowledgeBase(query);
  
  // 基本的なシステムプロンプト
  let basePrompt = `あなたは保守用車の知識ベースを持つ緊急復旧サポートアシスタントです。
あなたの目的は、ユーザーが保守用車（軌道モータカー、重機、道路保守車両、線路保守車両など）のトラブルシューティングと修理を支援することです。

## 回答方針（最重要）
- すべての回答は具体的な行動指示を中心とした内容にする
- 冗長な説明や前置きは完全に省略する
- 「〜です」「〜ます」などの丁寧表現は省略し「〜する」など簡潔な表現を使用する
- 必ず【応急処置】を最初に提示し、具体的な操作・部品・工具名を明記する
- 手順は番号付きリストで表示し、各ステップは具体的行動を指示する
- 点検箇所は具体的部品名・位置を明記する

## 質問分類と応答内容（必ず守る）
- 1. 【応急処置】：実際の作業手順を示す（例：「1. エンジンキーをOFF」「2. 燃料バルブを閉める」）
- 2. 【点検項目】：具体的な部品名・位置を箇条書きで示す（例：「・燃料フィルターの目詰まり」）
- 3. 【原因】：故障原因を簡潔に列挙（主要なもののみ）

## 安全注意事項
- 危険性がある場合のみ、先頭に【危険】と記載する
- 電気系統：感電危険
- 油圧系統：高圧油危険
- エンジン：火災・熱傷危険
- 専門家呼出が必要な場合は最後に一言だけ記載`;

  // 関連するチャンクがある場合は追加
  if (relevantChunks.length > 0) {
    basePrompt += `\n\n以下は、あなたの回答に役立つ可能性のある関連情報です：\n\n`;
    
    for (const chunk of relevantChunks) {
      basePrompt += `---\n出典: ${chunk.metadata.source}\n\n${chunk.text}\n---\n\n`;
    }
    
    basePrompt += `\n上記の情報のみを参考にしながら、回答します。情報にない場合は「ナレッジベースに情報なし」と短く伝えてください。指定された回答方針を厳守し、具体的な作業手順を箇条書きで示してください。`;
  } else {
    // 関連情報が見つからない場合
    basePrompt += `\n\n質問に関する情報がナレッジベースにありません。「ナレッジベースに該当情報なし」と短く回答してください。一般知識での回答は避け、具体的な内容が提供できない場合は明確にその旨を伝えてください。`;
  }
  
  return basePrompt;
}

/**
 * 知識ベース内のすべてのドキュメントを一覧表示
 * ディレクトリをスキャンして実際に存在するファイルからインデックスを更新
 */
export function listKnowledgeBaseDocuments(): { id: string, title: string, type: string, addedAt: string }[] {
  try {
    // まず知識ベースを初期化
    initializeKnowledgeBase();
    
    console.log('ナレッジベースディレクトリ確認:', KNOWLEDGE_BASE_DIR);
    console.log('ファイル存在確認:', fs.existsSync(path.join(KNOWLEDGE_BASE_DIR, '保守用車ナレッジ.txt')));
    
    // インデックスを読み込み
    const index = loadKnowledgeBaseIndex();
    console.log('既存インデックス:', index);
    
    // 実際にファイルシステムをスキャンして、ファイルが存在するかチェック
    // ルートディレクトリにある保守用車ナレッジ.txtなどのファイルも検出
    const rootFiles = fs.readdirSync(KNOWLEDGE_BASE_DIR)
      .filter(item => !item.startsWith('.') && item !== 'index.json')
      .filter(item => {
        const itemPath = path.join(KNOWLEDGE_BASE_DIR, item);
        // ファイルかどうかをチェック
        const isFile = fs.statSync(itemPath).isFile();
        const isValidExt = item.endsWith('.txt') || 
             item.endsWith('.pdf') || 
             item.endsWith('.docx') || 
             item.endsWith('.xlsx') || 
             item.endsWith('.pptx');
        console.log(`ファイル検出: ${item}, isFile: ${isFile}, isValidExt: ${isValidExt}`);
        return isFile && isValidExt;
      });
    
    console.log('ルートディレクトリファイル検出結果:', rootFiles);
    
    // インデックスに未追加のファイルを追加
    for (const file of rootFiles) {
      const filePath = path.join(KNOWLEDGE_BASE_DIR, file);
      
      // インデックスにファイルが存在するかチェック
      const existingDoc = index.documents.find(doc => doc.path === filePath);
      
      if (!existingDoc) {
        // ファイル拡張子を基にタイプを判定
        let type = 'text';
        if (file.endsWith('.pdf')) type = 'pdf';
        else if (file.endsWith('.docx')) type = 'word';
        else if (file.endsWith('.xlsx')) type = 'excel';
        else if (file.endsWith('.pptx')) type = 'powerpoint';
        
        // 新しいID生成（重複を避けるために現在時刻とランダム値を組み合わせる）
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 1000);
        const newId = `doc_${timestamp}_${random}`;
        
        console.log(`新規ファイル追加: ${file}, ID: ${newId}`);
        
        // インデックスに追加
        index.documents.push({
          id: newId,
          title: file,
          path: filePath,
          type,
          chunkCount: 1, // 仮の値
          addedAt: new Date().toISOString()
        });
      }
    }
    
    // サブディレクトリも検索してファイルを処理
    const directories = fs.readdirSync(KNOWLEDGE_BASE_DIR, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory() && !dirent.name.startsWith('.'))
      .map(dirent => dirent.name);
      
    // サブディレクトリ内のファイルも検索して追加
    for (const dir of directories) {
      const dirPath = path.join(KNOWLEDGE_BASE_DIR, dir);
      const subFiles = fs.readdirSync(dirPath)
        .filter(item => !item.startsWith('.') && 
          (item.endsWith('.txt') || 
           item.endsWith('.pdf') || 
           item.endsWith('.docx') || 
           item.endsWith('.xlsx') || 
           item.endsWith('.pptx')));
      
      for (const file of subFiles) {
        const filePath = path.join(dirPath, file);
        // インデックスにファイルが存在するかチェック
        const existingDoc = index.documents.find(doc => doc.path === filePath);
        
        if (!existingDoc) {
          // ファイル拡張子を基にタイプを判定
          let type = 'text';
          if (file.endsWith('.pdf')) type = 'pdf';
          else if (file.endsWith('.docx')) type = 'word';
          else if (file.endsWith('.xlsx')) type = 'excel';
          else if (file.endsWith('.pptx')) type = 'powerpoint';
          
          // 新しいID生成
          const newId = `doc_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
          
          // インデックスに追加
          index.documents.push({
            id: newId,
            title: `${dir}/${file}`, // サブディレクトリのパスを含める
            path: filePath,
            type,
            chunkCount: 1, // 仮の値
            addedAt: new Date().toISOString()
          });
        }
      }
    }
    
    // インデックスを更新
    saveKnowledgeBaseIndex(index);
    
    // ドキュメント情報を返す
    return index.documents.map(doc => ({
      id: doc.id,
      title: doc.title,
      type: doc.type,
      addedAt: doc.addedAt
    }));
  } catch (error) {
    console.error('ナレッジベース一覧取得エラー:', error);
    return [];
  }
}

/**
 * 知識ベースからドキュメントを削除
 * @param docId 削除するドキュメントID
 */
export function removeDocumentFromKnowledgeBase(docId: string): boolean {
  try {
    console.log(`ドキュメント削除リクエスト: ${docId}`);
    
    // インデックスを読み込み
    const index = loadKnowledgeBaseIndex();
    
    // ドキュメントが存在するか確認
    const docIndex = index.documents.findIndex(doc => doc.id === docId);
    if (docIndex === -1) {
      console.log(`該当ドキュメントがインデックスに見つかりません: ${docId}`);
      return false;
    }
    
    // 削除対象ドキュメントのパスを保存
    const docPath = index.documents[docIndex].path;
    console.log(`削除対象ドキュメント: ${docPath}`);
    
    // インデックスから削除
    index.documents.splice(docIndex, 1);
    saveKnowledgeBaseIndex(index);
    console.log(`インデックスから削除しました: ${docId}`);
    
    // ドキュメントファイルまたはディレクトリを削除
    if (fs.existsSync(docPath) && !docPath.includes('..')) {
      // 通常のファイルの場合
      try {
        const stats = fs.statSync(docPath);
        if (stats.isFile()) {
          fs.unlinkSync(docPath);
          console.log(`ファイルを削除しました: ${docPath}`);
        }
      } catch (err: any) {
        console.error(`ファイル削除エラー: ${err.message}`);
      }
    }
    
    // ドキュメントディレクトリがある場合は削除（処理済みデータ用）
    const docDir = path.join(KNOWLEDGE_BASE_DIR, docId);
    if (fs.existsSync(docDir) && !docDir.includes('..')) {
      try {
        fs.rmSync(docDir, { recursive: true, force: true });
        console.log(`ディレクトリを削除しました: ${docDir}`);
      } catch (err: any) {
        console.error(`ディレクトリ削除エラー: ${err.message}`);
      }
    }
    
    return true;
  } catch (err: any) {
    console.error(`ドキュメント削除中のエラー ${docId}:`, err);
    return false;
  }
}