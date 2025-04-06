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
    // 知識ベースを初期化
    initializeKnowledgeBase();
    
    // インデックスを読み込み
    const index = loadKnowledgeBaseIndex();
    
    // 検索結果を格納する配列
    const relevantChunks: DocumentChunk[] = [];
    
    // すべてのドキュメントを検索
    for (const docInfo of index.documents) {
      const docDir = path.join(KNOWLEDGE_BASE_DIR, docInfo.id);
      
      // チャンクファイルが存在する場合は読み込む
      const chunksFile = path.join(docDir, 'chunks.json');
      if (fs.existsSync(chunksFile)) {
        const chunks: DocumentChunk[] = JSON.parse(fs.readFileSync(chunksFile, 'utf8'));
        
        // 単純なキーワードマッチング（本来はベクトル検索やより高度な方法を使用）
        const matchingChunks = chunks.filter(chunk => 
          chunk.text.toLowerCase().includes(query.toLowerCase())
        );
        
        relevantChunks.push(...matchingChunks);
      }
    }
    
    // 上位10件に制限
    return relevantChunks.slice(0, 10);
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

## 参照情報
保守用車の整備、緊急時の対応手順、技術仕様に関する明確で簡潔で役立つ情報を提供してください。
常に安全を優先し、可能な限り公式ガイドラインを参照してください。
確信が持てないことがあれば、それを認め、メーカーや認定技術者に相談することを提案してください。

## 回答方針
- 回答は簡潔・明確にし、必要な情報だけを含めてください
- 最優先事項は「機械故障に対する応急復旧方法」の提供です。これを最初に目立つように示してください
- 質問の内容を以下の3つに分類して回答を組み立てること（優先順位順）
  - 1. 【応急処置】：故障時に現地で行う対処。手順を1つずつ簡潔に説明
  - 2. 【点検基準】：点検・検査での確認項目、法令等の基準
  - 3. 【構造説明】：装置や構造の概要や仕組み
- 応急処置は、現場の作業者が理解しやすいように、手順を番号付きで段階的に示す
- 専門用語は、可能であれば簡単な表現で補足すること
- ユーザーが現場で緊急対応中である可能性が高いため、実用的で即時対応できる情報を最優先してください
- 現場の照明が暗い可能性があるため、重要な情報は太字や番号付きリストなど、視認性を高める形式で提供してください

## 安全注意事項
- 安全性に関わる情報は常に最優先して伝えてください
- 電気系統のトラブルでは感電の危険性について必ず注意喚起してください
- 油圧系統のトラブルでは高圧油の噴出危険について必ず注意喚起してください
- エンジン関連のトラブルでは火災や熱傷の危険について必ず注意喚起してください
- 応急処置が難しい場合は無理せず専門技術者を呼ぶよう促してください`;

  // 関連するチャンクがある場合は追加
  if (relevantChunks.length > 0) {
    basePrompt += `\n\n以下は、あなたの回答に役立つ可能性のある関連情報です：\n\n`;
    
    for (const chunk of relevantChunks) {
      basePrompt += `---\n出典: ${chunk.metadata.source}\n\n${chunk.text}\n---\n\n`;
    }
    
    basePrompt += `\n上記の情報のみを参考にしながら、ユーザーの質問に答えてください。上記の情報に含まれていない場合でも、一般的な知識は使わず、「その情報はナレッジベースに含まれていません」と伝えてください。回答は厳密に提供されたナレッジデータのみに基づいて行ってください。`;
  } else {
    // 関連情報が見つからない場合
    basePrompt += `\n\nユーザーの質問に関する情報がナレッジベースに見つかりませんでした。一般的な知識は使わず、「その情報はナレッジベースに含まれていません」と伝えてください。システムにない情報は推測せず、正直に「ナレッジベースにその情報はありません」と回答してください。`;
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
    
    // インデックスを読み込み
    const index = loadKnowledgeBaseIndex();
    
    // 実際にファイルシステムをスキャンして、ファイルが存在するかチェック
    // ルートディレクトリにある保守用車ナレッジ.txtなどのファイルも検出
    const rootFiles = fs.readdirSync(KNOWLEDGE_BASE_DIR)
      .filter(item => !item.startsWith('.') && item !== 'index.json')
      .filter(item => {
        const itemPath = path.join(KNOWLEDGE_BASE_DIR, item);
        // ファイルかどうかをチェック
        return fs.statSync(itemPath).isFile() && 
            (item.endsWith('.txt') || 
             item.endsWith('.pdf') || 
             item.endsWith('.docx') || 
             item.endsWith('.xlsx') || 
             item.endsWith('.pptx'));
      });
    
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
        
        // 新しいID生成
        const newId = `doc_${Date.now()}`;
        
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
    
    // サブディレクトリも検索
    const directories = fs.readdirSync(KNOWLEDGE_BASE_DIR, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory() && !dirent.name.startsWith('.'))
      .map(dirent => dirent.name);
    
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
    // インデックスを読み込み
    const index = loadKnowledgeBaseIndex();
    
    // ドキュメントが存在するか確認
    const docIndex = index.documents.findIndex(doc => doc.id === docId);
    if (docIndex === -1) {
      return false;
    }
    
    // インデックスから削除
    index.documents.splice(docIndex, 1);
    saveKnowledgeBaseIndex(index);
    
    // ドキュメントディレクトリを削除
    const docDir = path.join(KNOWLEDGE_BASE_DIR, docId);
    if (fs.existsSync(docDir)) {
      fs.rmSync(docDir, { recursive: true, force: true });
    }
    
    return true;
  } catch (err) {
    console.error(`Error removing document ${docId}:`, err);
    return false;
  }
}