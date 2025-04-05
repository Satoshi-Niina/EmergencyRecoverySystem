import fs from 'fs';
import path from 'path';
import { 
  processDocument, 
  ProcessedDocument, 
  DocumentChunk 
} from './document-processor';
import { storage } from '../storage';

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
export async function initializeKnowledgeBase(): Promise<void> {
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
    await initializeKnowledgeBase();
    
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
    await initializeKnowledgeBase();
    
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
あなたの目的は、ユーザーが保守用車（重機、道路保守車両、線路保守車両など）のトラブルシューティングと修理を支援することです。
保守用車の整備、緊急時の対応手順、技術仕様に関する明確で簡潔で役立つ情報を提供してください。

原則と優先事項:
1. 常に安全を優先し、作業前の安全確認や適切な保護具の使用を強調してください
2. 可能な限り公式マニュアルやガイドラインを参照するよう促してください
3. 緊急時には、まず人命の安全確保、次に二次災害の防止、そして復旧作業の順で対応するよう指示してください
4. 不確かな情報を提供するよりも、「わかりません」と正直に答え、専門家への相談を推奨してください

回答の形式:
1. 簡潔な問題の要約から始めてください
2. 考えられる原因を列挙してください
3. 段階的なトラブルシューティング手順を提供してください
4. 必要な工具や部品を具体的に示してください
5. 安全上の注意事項で締めくくってください

状況に応じて、「緊急」「要注意」「参考情報」などのラベルを使用して情報の重要度を示してください。技術的な用語を使用する場合は、簡単な説明を加えてください。`;

  // 関連するチャンクがある場合は追加
  if (relevantChunks.length > 0) {
    basePrompt += `\n\n以下は、あなたの回答に役立つ可能性のある関連情報です：\n\n`;
    
    for (const chunk of relevantChunks) {
      basePrompt += `---\n出典: ${chunk.metadata.source}\n\n${chunk.text}\n---\n\n`;
    }
    
    basePrompt += `\n上記の情報を参考にしながら、ユーザーの質問に答えてください。ただし、上記の情報に含まれていない場合は、あなたの一般的な知識を使って答えてください。`;
  }
  
  return basePrompt;
}

/**
 * 知識ベース内のすべてのドキュメントを一覧表示
 */
export function listKnowledgeBaseDocuments(): { id: string, title: string, type: string, addedAt: string }[] {
  const index = loadKnowledgeBaseIndex();
  return index.documents.map(doc => ({
    id: doc.id,
    title: doc.title,
    type: doc.type,
    addedAt: doc.addedAt
  }));
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