import { 
  users, type User, type InsertUser,
  messages, type Message, type InsertMessage,
  media, type Media, type InsertMedia,
  chats, type Chat, type InsertChat,
  documents, type Document, type InsertDocument,
  keywords, type Keyword, type InsertKeyword,
  chatExports, type ChatExport, type InsertChatExport
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, like, sql } from "drizzle-orm";
import session from "express-session";
import memorystore from "memorystore";
import { IStorage } from "./storage";

// Create a memory store for session that is compatible with express-session
const MemoryStore = memorystore(session);

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    // Initialize session store with memory store
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // prune expired entries every 24h
    });

    // Seed initial users if not present
    this.seedInitialUsers();
  }

  private async seedInitialUsers() {
    // Check if admin user exists
    const adminUser = await this.getUserByUsername("niina");
    if (!adminUser) {
      await this.createUser({
        username: "niina",
        password: "0077", // In a real app, this would be hashed
        displayName: "新名 管理者",
        role: "admin"
      });
    }

    // Check if employee user exists
    const employeeUser = await this.getUserByUsername("employee");
    if (!employeeUser) {
      await this.createUser({
        username: "employee",
        password: "employee123", // In a real app, this would be hashed
        displayName: "山田太郎",
        role: "employee"
      });
    }
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }
  
  async updateUser(id: number, userData: Partial<User>): Promise<User> {
    const [user] = await db
      .update(users)
      .set(userData)
      .where(eq(users.id, id))
      .returning();
    return user;
  }
  
  async deleteUser(id: number): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }
  
  // Chat methods
  async getChat(id: number): Promise<Chat | undefined> {
    const [chat] = await db.select().from(chats).where(eq(chats.id, id));
    return chat;
  }
  
  async getChatsForUser(userId: number): Promise<Chat[]> {
    return db.select().from(chats).where(eq(chats.userId, userId));
  }
  
  async createChat(chat: InsertChat): Promise<Chat> {
    const [newChat] = await db.insert(chats).values(chat).returning();
    return newChat;
  }
  
  // Message methods
  async getMessage(id: number): Promise<Message | undefined> {
    const [message] = await db.select().from(messages).where(eq(messages.id, id));
    return message;
  }
  
  async getMessagesForChat(chatId: number): Promise<Message[]> {
    const result = await db.select()
      .from(messages)
      .where(eq(messages.chatId, chatId));
    
    // resultをtimestampで昇順にソート
    return result.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }
  
  async createMessage(message: InsertMessage): Promise<Message> {
    const [newMessage] = await db.insert(messages).values(message).returning();
    return newMessage;
  }
  
  // Media methods
  async getMedia(id: number): Promise<Media | undefined> {
    const [mediaItem] = await db.select().from(media).where(eq(media.id, id));
    return mediaItem;
  }
  
  async getMediaForMessage(messageId: number): Promise<Media[]> {
    return db.select().from(media).where(eq(media.messageId, messageId));
  }
  
  async createMedia(mediaItem: InsertMedia): Promise<Media> {
    const [newMedia] = await db.insert(media).values(mediaItem).returning();
    return newMedia;
  }
  
  // Document methods
  async getDocument(id: number): Promise<Document | undefined> {
    const [document] = await db.select().from(documents).where(eq(documents.id, id));
    return document;
  }
  
  async getDocumentsForUser(userId: number): Promise<Document[]> {
    const result = await db.select()
      .from(documents)
      .where(eq(documents.userId, userId));
    
    // resultをprocessedAtで降順にソート
    return result.sort((a, b) => b.processedAt.getTime() - a.processedAt.getTime());
  }
  
  async createDocument(document: InsertDocument): Promise<Document> {
    const [newDocument] = await db.insert(documents).values(document).returning();
    return newDocument;
  }
  
  async updateDocument(id: number, updates: Partial<Document>): Promise<Document | undefined> {
    const [updatedDocument] = await db
      .update(documents)
      .set(updates)
      .where(eq(documents.id, id))
      .returning();
    return updatedDocument;
  }
  
  // Keyword methods
  async getKeywordsForDocument(documentId: number): Promise<Keyword[]> {
    return db.select().from(keywords).where(eq(keywords.documentId, documentId));
  }
  
  async createKeyword(keyword: InsertKeyword): Promise<Keyword> {
    const [newKeyword] = await db.insert(keywords).values(keyword).returning();
    return newKeyword;
  }
  
  async searchDocumentsByKeyword(keyword: string): Promise<Document[]> {
    // Find matching keywords
    const matchingKeywords = await db
      .select()
      .from(keywords)
      .where(like(keywords.word, `%${keyword}%`));
    
    if (matchingKeywords.length === 0) {
      return [];
    }
    
    // Get unique document IDs
    const documentIds = Array.from(new Set(matchingKeywords.map(k => k.documentId)));
    
    // Fetch documents by IDs
    const matchingDocuments: Document[] = [];
    for (const docId of documentIds) {
      if (docId === null) continue;
      const doc = await this.getDocument(docId);
      if (doc) {
        matchingDocuments.push(doc);
      }
    }
    
    return matchingDocuments;
  }

  // チャットエクスポート関連のメソッド
  async getMessagesForChatAfterTimestamp(chatId: number, timestamp: Date): Promise<Message[]> {
    // 基準日時より後のメッセージを取得
    const allMessages = await db.select()
      .from(messages)
      .where(eq(messages.chatId, chatId));
    
    // JSでフィルタリング
    return allMessages
      .filter(msg => msg.timestamp > timestamp)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  async saveChatExport(chatId: number, userId: number, timestamp: Date): Promise<void> {
    await db.insert(chatExports).values({
      chatId,
      userId,
      timestamp
    });
  }

  async getLastChatExport(chatId: number): Promise<ChatExport | null> {
    const exports = await db.select()
      .from(chatExports)
      .where(eq(chatExports.chatId, chatId));
    
    if (exports.length === 0) {
      return null;
    }
    
    // タイムスタンプの降順でソートし、最初の要素を返す
    return exports.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
  }
}