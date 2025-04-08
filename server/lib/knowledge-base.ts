import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
  processDocument, 
  ProcessedDocument, 
  DocumentChunk,
  chunkText
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
    console.log(`知識ベースにドキュメント追加開始: ${filePath}`);
    
    // 知識ベースを初期化
    initializeKnowledgeBase();
    
    // ファイル名を取得して表示
    const fileName = path.basename(filePath);
    console.log(`処理対象ファイル名: ${fileName}`);
    
    // ユニークなIDを生成
    const docId = `doc_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    console.log(`生成したドキュメントID: ${docId}`);
    
    // ドキュメント用ディレクトリ作成
    const docDir = path.join(KNOWLEDGE_BASE_DIR, docId);
    if (!fs.existsSync(docDir)) {
      fs.mkdirSync(docDir, { recursive: true });
    }
    console.log(`ドキュメントディレクトリ作成: ${docDir}`);
    
    // 元ファイルをドキュメントディレクトリにコピー
    const destPath = path.join(docDir, fileName);
    fs.copyFileSync(filePath, destPath);
    console.log(`ファイルコピー完了: ${destPath}`);
    
    // ドキュメントを処理
    console.log(`ドキュメント処理を開始: ${filePath}`);
    let processedDoc: ProcessedDocument;
    
    try {
      processedDoc = await processDocument(filePath);
      console.log(`ドキュメント処理完了: ${processedDoc.chunks.length}個のチャンクを生成`);
    } catch (procError) {
      console.error('ドキュメント処理中にエラー発生:', procError);
      
      // エラーが発生した場合でも処理を続行するための最小限のデータ構造
      processedDoc = {
        chunks: [{
          text: `${fileName}の内容`,
          metadata: {
            source: fileName,
            chunkNumber: 0
          }
        }],
        metadata: {
          title: fileName,
          source: filePath,
          type: path.extname(filePath).toLowerCase().substring(1),
          wordCount: 0,
          createdAt: new Date()
        }
      };
      console.log('エラー後の最小限のドキュメント構造を作成しました');
    }
    
    // ドキュメントをDBに保存（あるいはローカルファイルシステムに）
    try {
      await storeProcessedDocument(docId, processedDoc);
      console.log(`処理済みドキュメントを保存完了: ${docId}`);
    } catch (storeError) {
      console.error('ドキュメント保存中にエラー発生:', storeError);
    }
    
    // インデックスを更新
    const index = loadKnowledgeBaseIndex();
    index.documents.push({
      id: docId,
      title: processedDoc.metadata.title,
      path: destPath, // 更新：コピー先のパスを使用
      type: processedDoc.metadata.type,
      chunkCount: processedDoc.chunks.length,
      addedAt: new Date().toISOString()
    });
    saveKnowledgeBaseIndex(index);
    console.log('知識ベースインデックスを更新しました');
    
    // PowerPointファイルの場合は特別なメッセージを表示
    const fileExt = path.extname(filePath).toLowerCase();
    if (fileExt === '.pptx' || fileExt === '.ppt') {
      console.log(`PowerPointファイルが正常に処理されました。画像データも生成されています。`);
    }
    
    console.log(`ドキュメント "${fileName}" が知識ベースに追加されました。ID: ${docId}`);
    
    return docId;
  } catch (err: any) {
    console.error('知識ベースへのドキュメント追加エラー:', err);
    throw new Error(`知識ベースへの追加に失敗しました: ${err.message}`);
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
            
            // クエリでフィルタリング（より高度な検索を実装）
            const queryTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 2);
            console.log(`検索キーワード分割: ${queryTerms.join(', ')}`);
            
            // 各チャンクのスコアを計算
            const scoredChunks = textChunks.map((chunk: DocumentChunk) => {
              const chunkText = chunk.text.toLowerCase();
              let score = 0;
              
              // 単一キーワード検索の強化対応
              if (queryTerms.length === 1 && query.length >= 2) {
                // 「エンジン」などの単一キーワード検索の場合は特別な処理
                const singleKeyword = query.toLowerCase();
                
                // 単語の完全一致（「エンジン」と「エンジン」）
                if (chunkText.includes(singleKeyword)) {
                  score += 10; // 単一キーワードの完全一致は最も重要
                  
                  // 重要キーワードの特別ボーナス
                  if (singleKeyword === 'エンジン' || 
                      singleKeyword === 'フレーム' || 
                      singleKeyword === 'キャビン' || 
                      singleKeyword === '運転室' || 
                      singleKeyword === 'ドア' ||
                      singleKeyword === '幅' ||
                      singleKeyword === '扉') {
                    score += 5; // 特に重要なキーワードならさらにボーナススコア
                    
                    // ドアや幅に関する検索をさらに強化
                    if (singleKeyword === 'ドア' || singleKeyword === '扉' || singleKeyword === '幅') {
                      // 特にドアの寸法に関連する数値を含むチャンクを優先
                      if (chunkText.includes('mm') || chunkText.includes('センチ') || 
                          /\d+(\.\d+)?(mm|cm|m)/.test(chunkText)) {
                        score += 8; // 寸法情報を含む場合は大幅ボーナス
                      }
                    }
                  }
                }
                
                // 単語の部分一致（「エンジン」と「メインエンジン」）
                const keywordMatches = (chunkText.match(new RegExp(singleKeyword, 'g')) || []).length;
                if (keywordMatches > 0) {
                  score += keywordMatches * 2;
                }
              } else {
                // 通常の複数キーワード検索の場合
                // 各検索語について、含まれている場合はスコアを加算
                for (const term of queryTerms) {
                  if (chunkText.includes(term)) {
                    // 完全一致の場合は高いスコア
                    score += 3;
                  }
                }
                
                // クエリ全体が含まれている場合は特に高いスコア
                if (chunkText.includes(query.toLowerCase())) {
                  score += 5;
                }
              }
              
              return { chunk, score };
            });
            
            // スコアでソートし、閾値以上のチャンクのみ選択
            const matchingChunks = scoredChunks
              .filter(item => item.score > 0)
              .sort((a, b) => b.score - a.score)
              .map(item => item.chunk);
              
            console.log(`スコアリング後のマッチチャンク数: ${matchingChunks.length}`);
            
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
    
    // より少数の高品質なチャンクを選択（上位7件に制限）
    // これにより、本当に関連性の高いチャンクのみを返す
    console.log(`選択前のチャンク数: ${relevantChunks.length}、検索クエリ: "${query}"`);
    const limitedChunks = relevantChunks.slice(0, 7);
    
    // デバッグ用にチャンクの内容を出力
    limitedChunks.forEach((chunk, idx) => {
      console.log(`選択されたチャンク ${idx+1}:`, chunk.text.substring(0, 50) + '...');
    });
    
    return limitedChunks;
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
あなたはユーザーから質問を受け取り、保守用車（軌道モータカー、重機、道路保守車両、線路保守車両など）のトラブルシューティングと修理を段階的に支援します。

## 厳守事項（最重要）
- 提供された知識ベースの情報のみを使用し、それ以外の一般知識での回答は禁止
- 会話は一連のトラブルシューティングのQA対話形式として進行
- ユーザーの質問に対して各ステップごとに1つだけ返答し、先の手順を一度に提示しない
- ユーザーの返答に基づいて次のステップを案内する対話型のトラブルシューティングを実現

## 重要な検索語句のヒント
- 「エンジン」の場合：軌道モータカーのディーゼルエンジン構造、分類（600型、400型、300型、200型）、製造メーカー別の型式（堀川工機、松山重車両など）、機械式と電子噴射式、高トルク、油圧ポンプ、エアーコンプレッサーの情報を含める
- 「フレーム」の場合：軌道モータカーのフレーム構造、H鋼、メーンフレーム、サイドメンバー、クロスメンバー、強度、はしご状構造に関する情報を含める
- 「キャビン」「運転室」の場合：防振ゴム、ガラス、モール、ひねり対策、ワイパー、冷暖房、乗務、労働安全衛生規則に関する情報を含める
- 「ドア」「扉」「幅」の場合：運転室のドア幅（600mm～800mm）、ドアの構造、開閉方式、ドアの寸法、安全基準に関する情報を含める

## 回答方針（厳守）
- 【緊急復旧】のタイトルで回答開始
- 「〜です」「〜ます」などの丁寧表現は省略し「〜する」など簡潔な表現を使用
- 命令形で指示を明確に伝える
- 具体的な操作・部品・工具名を明記
- 各ステップは必ず番号付き（1. 2. 3.）で、1行に1つの操作のみを記述
- 一度に1つの手順のみを提示し、次の手順はユーザーからの返答を受けてから案内する

## 会話の流れ（厳守）
1. 最初の質問に対して、最初の手順だけを回答（例：「1. 車両を安全な場所に停止させる」のみ）
2. ユーザーがその手順を実行した後の返答に基づいて、次の1手順だけを案内
3. この一問一答の流れを、問題が解決するか専門的対応が必要と判断されるまで継続する
4. 手順の提示順序は、安全確保→原因特定→修理対応→テストの順に従う
5. ユーザーが「解決した」と答えるか、対応不能と判断されるまで対話を続ける

## 回答フォーマット（厳守）
初回回答：
【緊急復旧】
1. [最初の手順のみを簡潔に記述]

以降の回答（ユーザーの返答に基づく）：
2. [次の手順のみを簡潔に記述]

最終回答（解決時）：
作業完了。次の点検に進んでください。

最終回答（解決不能時）：
この問題は専門的な対応が必要です。保守担当者に電話連絡してください。

## 安全注意事項
- 危険性がある場合のみ、先頭に【危険】と記載
- 電気系統：感電危険
- 油圧系統：高圧油危険
- エンジン：火災・熱傷危険`;

  // 関連するチャンクがある場合は追加
  if (relevantChunks.length > 0) {
    basePrompt += `\n\n以下は、あなたの回答に役立つ可能性のある関連情報です：\n\n`;
    
    for (const chunk of relevantChunks) {
      basePrompt += `---\n出典: ${chunk.metadata.source}\n\n${chunk.text}\n---\n\n`;
    }
    
    basePrompt += `\n上記の知識ベースの情報のみを使用して回答してください。以下の例に従って厳密に回答を構成してください：

# 対話例（厳守）：

ユーザー: 鉄トロをけん引して走行中に、ブレーキが利かなくなった。どこを確認したらいい？

アシスタント: 【緊急復旧】
1. 車両を安全な場所に停止させる

ユーザー: 停止したが次は

アシスタント: 
2. ブレーキ管からエアー漏れがないか確認する

ユーザー: どこを見ればいい？

アシスタント:
3. エンジン横の入換ブレーキ弁を運転位置にして10～20秒で双針圧力計の黒針が下がるか確認する

ユーザー: 下がらない

アシスタント:
4. ブレーキシリンダーのストロークを確認する

このようにユーザーとの対話を一問一答形式で進め、一度に複数の手順を提示せず、ユーザーの返答に合わせて次のステップを案内してください。`;
  } else {
    // 関連情報が見つからない場合
    basePrompt += `\n\n質問に関する情報がナレッジベースにありません。以下のように回答してください：

【緊急復旧】

ナレッジベースに該当情報がありません。

この問題は専門的な対応が必要です。保守担当者に電話連絡してください。`;
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