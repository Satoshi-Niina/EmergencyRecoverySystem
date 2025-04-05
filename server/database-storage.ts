import { 
  users, type User, type InsertUser,
  messages, type Message, type InsertMessage,
  media, type Media, type InsertMedia,
  chats, type Chat, type InsertChat,
  documents, type Document, type InsertDocument,
  keywords, type Keyword, type InsertKeyword
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, like } from "drizzle-orm";
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
    return db.select()
      .from(messages)
      .where(eq(messages.chatId, chatId))
      .orderBy(messages.timestamp);
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
    return db.select()
      .from(documents)
      .where(eq(documents.userId, userId))
      .orderBy(desc(documents.processedAt));
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
}