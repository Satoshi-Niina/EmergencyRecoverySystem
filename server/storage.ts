import { 
  users, type User, type InsertUser,
  messages, type Message, type InsertMessage,
  media, type Media, type InsertMedia,
  chats, type Chat, type InsertChat,
  documents, type Document, type InsertDocument,
  keywords, type Keyword, type InsertKeyword
} from "@shared/schema";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Chat methods
  getChat(id: number): Promise<Chat | undefined>;
  getChatsForUser(userId: number): Promise<Chat[]>;
  createChat(chat: InsertChat): Promise<Chat>;
  
  // Message methods
  getMessage(id: number): Promise<Message | undefined>;
  getMessagesForChat(chatId: number): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  
  // Media methods
  getMedia(id: number): Promise<Media | undefined>;
  getMediaForMessage(messageId: number): Promise<Media[]>;
  createMedia(media: InsertMedia): Promise<Media>;
  
  // Document methods
  getDocument(id: number): Promise<Document | undefined>;
  getDocumentsForUser(userId: number): Promise<Document[]>;
  createDocument(document: InsertDocument): Promise<Document>;
  updateDocument(id: number, updates: Partial<Document>): Promise<Document | undefined>;
  
  // Keyword methods
  getKeywordsForDocument(documentId: number): Promise<Keyword[]>;
  createKeyword(keyword: InsertKeyword): Promise<Keyword>;
  searchDocumentsByKeyword(keyword: string): Promise<Document[]>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private chats: Map<number, Chat>;
  private messages: Map<number, Message>;
  private medias: Map<number, Media>;
  private documents: Map<number, Document>;
  private keywords: Map<number, Keyword>;
  
  private currentUserId: number;
  private currentChatId: number;
  private currentMessageId: number;
  private currentMediaId: number;
  private currentDocumentId: number;
  private currentKeywordId: number;

  constructor() {
    this.users = new Map();
    this.chats = new Map();
    this.messages = new Map();
    this.medias = new Map();
    this.documents = new Map();
    this.keywords = new Map();
    
    this.currentUserId = 1;
    this.currentChatId = 1;
    this.currentMessageId = 1;
    this.currentMediaId = 1;
    this.currentDocumentId = 1;
    this.currentKeywordId = 1;
    
    // Create admin user by default
    this.createUser({
      username: "niina",
      password: "0077", // In a real app, this would be hashed
      displayName: "新名 管理者",
      role: "admin"
    });
    
    // Create regular employee user
    this.createUser({
      username: "employee",
      password: "employee123", // In a real app, this would be hashed
      displayName: "山田太郎",
      role: "employee"
    });
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }
  
  // Chat methods
  async getChat(id: number): Promise<Chat | undefined> {
    return this.chats.get(id);
  }
  
  async getChatsForUser(userId: number): Promise<Chat[]> {
    return Array.from(this.chats.values()).filter(
      (chat) => chat.userId === userId
    );
  }
  
  async createChat(chat: InsertChat): Promise<Chat> {
    const id = this.currentChatId++;
    const createdAt = new Date();
    const newChat: Chat = { ...chat, id, createdAt };
    this.chats.set(id, newChat);
    return newChat;
  }
  
  // Message methods
  async getMessage(id: number): Promise<Message | undefined> {
    return this.messages.get(id);
  }
  
  async getMessagesForChat(chatId: number): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter((message) => message.chatId === chatId)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }
  
  async createMessage(message: InsertMessage): Promise<Message> {
    const id = this.currentMessageId++;
    const timestamp = new Date();
    const newMessage: Message = { ...message, id, timestamp };
    this.messages.set(id, newMessage);
    return newMessage;
  }
  
  // Media methods
  async getMedia(id: number): Promise<Media | undefined> {
    return this.medias.get(id);
  }
  
  async getMediaForMessage(messageId: number): Promise<Media[]> {
    return Array.from(this.medias.values()).filter(
      (media) => media.messageId === messageId
    );
  }
  
  async createMedia(media: InsertMedia): Promise<Media> {
    const id = this.currentMediaId++;
    const newMedia: Media = { ...media, id };
    this.medias.set(id, newMedia);
    return newMedia;
  }
  
  // Document methods
  async getDocument(id: number): Promise<Document | undefined> {
    return this.documents.get(id);
  }
  
  async getDocumentsForUser(userId: number): Promise<Document[]> {
    return Array.from(this.documents.values())
      .filter((doc) => doc.userId === userId)
      .sort((a, b) => b.processedAt.getTime() - a.processedAt.getTime());
  }
  
  async createDocument(document: InsertDocument): Promise<Document> {
    const id = this.currentDocumentId++;
    const processedAt = new Date();
    const newDocument: Document = { ...document, id, processedAt };
    this.documents.set(id, newDocument);
    return newDocument;
  }
  
  async updateDocument(id: number, updates: Partial<Document>): Promise<Document | undefined> {
    const document = this.documents.get(id);
    if (!document) return undefined;
    
    const updatedDocument = { ...document, ...updates };
    this.documents.set(id, updatedDocument);
    return updatedDocument;
  }
  
  // Keyword methods
  async getKeywordsForDocument(documentId: number): Promise<Keyword[]> {
    return Array.from(this.keywords.values()).filter(
      (keyword) => keyword.documentId === documentId
    );
  }
  
  async createKeyword(keyword: InsertKeyword): Promise<Keyword> {
    const id = this.currentKeywordId++;
    const newKeyword: Keyword = { ...keyword, id };
    this.keywords.set(id, newKeyword);
    return newKeyword;
  }
  
  async searchDocumentsByKeyword(keyword: string): Promise<Document[]> {
    const matchingKeywords = Array.from(this.keywords.values()).filter(
      (k) => k.word.toLowerCase().includes(keyword.toLowerCase())
    );
    
    const documentIds = new Set(matchingKeywords.map((k) => k.documentId));
    
    return Array.from(documentIds).map((id) => this.documents.get(id)!).filter(Boolean);
  }
}

export const storage = new MemStorage();
