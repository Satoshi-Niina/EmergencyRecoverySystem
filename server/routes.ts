import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { loginSchema, insertUserSchema, insertChatSchema, insertMessageSchema, insertMediaSchema, insertDocumentSchema } from "@shared/schema";
import { z } from "zod";
import session from "express-session";
import { WebSocket, WebSocketServer } from "ws";
import { processOpenAIRequest, generateSearchQuery, analyzeVehicleImage } from "./lib/openai";
import fs from "fs";
import path from "path";
import MemoryStore from "memorystore";

// Extend the express-session types
declare module 'express-session' {
  interface SessionData {
    userId: number;
    userRole: string;
  }
}

// Create memory store for session
const MemoryStoreSession = MemoryStore(session);

export async function registerRoutes(app: Express): Promise<Server> {
  // Add a health check endpoint for testing
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      openaiKeyExists: !!process.env.OPENAI_API_KEY
    });
  });
  
  // Add a public OpenAI test endpoint (for testing only)
  app.post('/api/chatgpt-test', async (req, res) => {
    try {
      const { text } = req.body;
      
      if (!text) {
        return res.status(400).json({ message: "Text is required" });
      }
      
      const response = await processOpenAIRequest(text);
      return res.json({ response });
    } catch (error) {
      console.error("Error in /api/chatgpt-test:", error);
      return res.status(500).json({ message: "Error processing request", error: String(error) });
    }
  });

  // Setup session middleware
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "emergency-recovery-secret",
      resave: false,
      saveUninitialized: false,
      cookie: { 
        secure: false, // Set to false for development in Replit
        maxAge: 86400000 // 24 hours
      },
      store: new MemoryStoreSession({
        checkPeriod: 86400000, // 24 hours
      }),
    })
  );

  // Auth middleware
  const requireAuth = (req: Request, res: Response, next: Function) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    next();
  };

  // Admin middleware
  const requireAdmin = async (req: Request, res: Response, next: Function) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const user = await storage.getUser(req.session.userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: "Forbidden" });
    }
    
    next();
  };

  // Auth routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const credentials = loginSchema.parse(req.body);
      const user = await storage.getUserByUsername(credentials.username);
      
      if (!user || user.password !== credentials.password) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      req.session.userId = user.id;
      req.session.userRole = user.role;
      
      return res.json({ 
        id: user.id, 
        username: user.username, 
        displayName: user.displayName, 
        role: user.role 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Failed to logout" });
      }
      res.clearCookie("connect.sid");
      return res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    return res.json({ 
      id: user.id, 
      username: user.username, 
      displayName: user.displayName, 
      role: user.role 
    });
  });

  // Chat routes
  app.get("/api/chats", requireAuth, async (req, res) => {
    const chats = await storage.getChatsForUser(req.session.userId!);
    return res.json(chats);
  });

  app.post("/api/chats", requireAuth, async (req, res) => {
    try {
      const chatData = insertChatSchema.parse({
        ...req.body,
        userId: req.session.userId
      });
      
      const chat = await storage.createChat(chatData);
      return res.json(chat);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/chats/:id", requireAuth, async (req, res) => {
    const chat = await storage.getChat(parseInt(req.params.id));
    
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }
    
    if (chat.userId !== req.session.userId) {
      return res.status(403).json({ message: "Forbidden" });
    }
    
    return res.json(chat);
  });

  app.get("/api/chats/:id/messages", requireAuth, async (req, res) => {
    const chat = await storage.getChat(parseInt(req.params.id));
    
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }
    
    if (chat.userId !== req.session.userId) {
      return res.status(403).json({ message: "Forbidden" });
    }
    
    const messages = await storage.getMessagesForChat(chat.id);
    
    // Get media for each message
    const messagesWithMedia = await Promise.all(
      messages.map(async (message) => {
        const media = await storage.getMediaForMessage(message.id);
        return { ...message, media };
      })
    );
    
    return res.json(messagesWithMedia);
  });

  app.post("/api/chats/:id/messages", requireAuth, async (req, res) => {
    try {
      const chat = await storage.getChat(parseInt(req.params.id));
      
      if (!chat) {
        return res.status(404).json({ message: "Chat not found" });
      }
      
      if (chat.userId !== req.session.userId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      const messageData = insertMessageSchema.parse({
        ...req.body,
        chatId: chat.id,
        senderId: req.session.userId,
        isAiResponse: false
      });
      
      const message = await storage.createMessage(messageData);
      
      // Process with OpenAI to get AI response
      const aiResponse = await processOpenAIRequest(message.content);
      
      // Create AI response message
      const aiMessage = await storage.createMessage({
        content: aiResponse,
        chatId: chat.id,
        isAiResponse: true,
        senderId: null
      });
      
      return res.json({
        userMessage: message,
        aiMessage
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Media routes
  app.post("/api/media", requireAuth, async (req, res) => {
    try {
      const mediaData = insertMediaSchema.parse(req.body);
      const media = await storage.createMedia(mediaData);
      return res.json(media);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Document routes (admin only)
  app.get("/api/documents", requireAuth, async (req, res) => {
    const documents = await storage.getDocumentsForUser(req.session.userId!);
    return res.json(documents);
  });

  app.post("/api/documents", requireAuth, async (req, res) => {
    try {
      const documentData = insertDocumentSchema.parse({
        ...req.body,
        userId: req.session.userId
      });
      
      const document = await storage.createDocument(documentData);
      return res.json(document);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/documents/:id", requireAuth, async (req, res) => {
    try {
      const document = await storage.getDocument(parseInt(req.params.id));
      
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      if (document.userId !== req.session.userId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      const updatedDocument = await storage.updateDocument(document.id, req.body);
      return res.json(updatedDocument);
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Search routes
  app.get("/api/search", requireAuth, async (req, res) => {
    try {
      const keyword = req.query.q as string;
      
      if (!keyword) {
        return res.status(400).json({ message: "Search query is required" });
      }
      
      const documents = await storage.searchDocumentsByKeyword(keyword);
      return res.json(documents);
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // OpenAI API routes
  app.post("/api/chatgpt", requireAuth, async (req, res) => {
    try {
      const { text } = req.body;
      
      if (!text) {
        return res.status(400).json({ message: "Text is required" });
      }
      
      const response = await processOpenAIRequest(text);
      
      // Check for specific error messages returned from OpenAI
      if (response.includes("OpenAI APIキーが無効")) {
        return res.status(401).json({ message: response });
      }
      
      if (response.includes("OpenAI APIのリクエスト制限")) {
        return res.status(429).json({ message: response });
      }
      
      return res.json({ response });
    } catch (error) {
      console.error("Error in /api/chatgpt:", error);
      return res.status(500).json({ message: "Error processing request" });
    }
  });

  app.post("/api/optimize-search-query", requireAuth, async (req, res) => {
    try {
      const { text } = req.body;
      
      if (!text) {
        return res.status(400).json({ message: "Text is required" });
      }
      
      const optimizedQuery = await generateSearchQuery(text);
      return res.json({ optimizedQuery });
    } catch (error) {
      console.error("Error in /api/optimize-search-query:", error);
      return res.status(500).json({ message: "Error optimizing search query" });
    }
  });

  app.post("/api/analyze-image", requireAuth, async (req, res) => {
    try {
      const { image } = req.body;
      
      if (!image) {
        return res.status(400).json({ message: "Image data is required" });
      }
      
      const result = await analyzeVehicleImage(image);
      
      // Check for specific error messages returned from OpenAI
      if (result.analysis.includes("OpenAI APIキーが無効")) {
        return res.status(401).json({ message: result.analysis });
      }
      
      if (result.analysis.includes("OpenAI APIのリクエスト制限")) {
        return res.status(429).json({ message: result.analysis });
      }
      
      return res.json(result);
    } catch (error) {
      console.error("Error in /api/analyze-image:", error);
      return res.status(500).json({ message: "Error analyzing image" });
    }
  });

  // Create HTTP server
  const httpServer = createServer(app);
  
  // Set up WebSocket server for real-time chat on a specific path to avoid conflict with Vite
  const wss = new WebSocketServer({ 
    server: httpServer,
    path: '/ws'  // Use a specific path to avoid conflict with Vite's WebSocket
  });
  
  // Make sure to properly import WebSocket type
  wss.on('connection', (ws: WebSocket) => {
    console.log("WebSocket client connected");
    
    ws.on('message', (message: string) => {
      console.log("Received message:", message);
      // Broadcast message to all clients
      wss.clients.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    });
    
    ws.on('close', () => {
      console.log("WebSocket client disconnected");
    });
    
    ws.on('error', (error) => {
      console.error("WebSocket error:", error);
    });
    
    // Send a welcome message
    ws.send(JSON.stringify({
      type: 'system',
      content: 'Connected to Emergency Recovery Chat WebSocket server'
    }));
  });

  return httpServer;
}
