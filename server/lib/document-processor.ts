import * as pdfjs from 'pdfjs-dist/legacy/build/pdf';
import * as mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { parse } from 'node-html-parser';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { promisify } from 'util';

// We'll handle PDF worker in the extractPdfText function instead of at the module level

// Constants
const CHUNK_SIZE = 1000; // Characters per chunk
const CHUNK_OVERLAP = 200; // Overlap between chunks

// Interface for processed document
export interface ProcessedDocument {
  chunks: DocumentChunk[];
  metadata: {
    title: string;
    source: string;
    type: string;
    pageCount?: number;
    wordCount?: number;
    createdAt: Date;
  };
}

// Interface for document chunks
export interface DocumentChunk {
  text: string;
  metadata: {
    source: string;
    pageNumber?: number;
    chunkNumber: number;
  };
}

/**
 * Extract text content from a PDF file
 * @param filePath Path to PDF file
 * @returns Extracted text and metadata
 */
export async function extractPdfText(filePath: string): Promise<{ text: string, pageCount: number }> {
  try {
    const data = new Uint8Array(fs.readFileSync(filePath));
    const loadingTask = pdfjs.getDocument({ data });
    const pdf = await loadingTask.promise;
    
    const pageCount = pdf.numPages;
    let text = '';
    
    for (let i = 1; i <= pageCount; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .filter((item: any) => 'str' in item)
        .map((item: any) => item.str)
        .join(' ');
      
      text += pageText + '\n\n';
    }
    
    return { text, pageCount };
  } catch (error) {
    console.error('Error extracting PDF text:', error);
    throw new Error('PDF text extraction failed');
  }
}

/**
 * Extract text content from a Word document
 * @param filePath Path to Word document
 * @returns Extracted text
 */
export async function extractWordText(filePath: string): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  } catch (error) {
    console.error('Error extracting Word text:', error);
    throw new Error('Word text extraction failed');
  }
}

/**
 * Extract text content from an Excel file
 * @param filePath Path to Excel file
 * @returns Extracted text
 */
export async function extractExcelText(filePath: string): Promise<string> {
  try {
    const workbook = XLSX.readFile(filePath);
    let result = '';
    
    workbook.SheetNames.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      const sheetText = XLSX.utils.sheet_to_txt(worksheet);
      result += `Sheet: ${sheetName}\n${sheetText}\n\n`;
    });
    
    return result;
  } catch (error) {
    console.error('Error extracting Excel text:', error);
    throw new Error('Excel text extraction failed');
  }
}

/**
 * Extract text content from a PowerPoint file
 * Note: This is a stub. Actual PPTX processing is more complex.
 * Consider using a service like libreoffice to convert PPTX to PDF first,
 * then extract text from the PDF.
 */
export async function extractPptxText(filePath: string): Promise<string> {
  // This is a simplified implementation
  // In production, you might want to use a conversion service
  try {
    // Placeholder for PowerPoint processing
    // This would require either third-party APIs or running LibreOffice as a service
    return `[PowerPoint content from ${filePath}]`;
  } catch (error) {
    console.error('Error extracting PowerPoint text:', error);
    throw new Error('PowerPoint text extraction failed');
  }
}

/**
 * Extract text content from a text file
 */
export async function extractTxtText(filePath: string): Promise<string> {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    console.error('Error reading text file:', error);
    throw new Error('Text file reading failed');
  }
}

/**
 * Chunk text into smaller pieces
 * @param text Full text to chunk
 * @param metadata Metadata to include with each chunk
 * @returns Array of document chunks
 */
export function chunkText(text: string, metadata: { source: string, pageNumber?: number }): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];
  let chunkNumber = 0;
  
  // Simple chunking by character count with overlap
  for (let i = 0; i < text.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
    const chunk = text.substring(i, i + CHUNK_SIZE);
    if (chunk.trim().length > 0) {
      chunks.push({
        text: chunk,
        metadata: {
          ...metadata,
          chunkNumber: chunkNumber++
        }
      });
    }
  }
  
  return chunks;
}

/**
 * Process a document file and return chunked text with metadata
 * @param filePath Path to document file
 * @returns Processed document with chunks and metadata
 */
export async function processDocument(filePath: string): Promise<ProcessedDocument> {
  const fileExt = path.extname(filePath).toLowerCase();
  const fileName = path.basename(filePath);
  
  let text = '';
  let pageCount = 0;
  let documentType = '';
  
  switch (fileExt) {
    case '.pdf':
      const pdfResult = await extractPdfText(filePath);
      text = pdfResult.text;
      pageCount = pdfResult.pageCount;
      documentType = 'pdf';
      break;
    case '.docx':
    case '.doc':
      text = await extractWordText(filePath);
      documentType = 'word';
      break;
    case '.xlsx':
    case '.xls':
      text = await extractExcelText(filePath);
      documentType = 'excel';
      break;
    case '.pptx':
    case '.ppt':
      text = await extractPptxText(filePath);
      documentType = 'powerpoint';
      break;
    case '.txt':
      text = await extractTxtText(filePath);
      documentType = 'text';
      break;
    default:
      throw new Error(`Unsupported file type: ${fileExt}`);
  }
  
  // Calculate word count
  const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
  
  // Create chunks
  const chunks = chunkText(text, { source: fileName });
  
  return {
    chunks,
    metadata: {
      title: fileName,
      source: filePath,
      type: documentType,
      pageCount: pageCount || undefined,
      wordCount,
      createdAt: new Date()
    }
  };
}

/**
 * Store processed document chunks in database
 * This function would connect to your database and store the chunks
 * Implementation depends on your database schema
 */
export async function storeDocumentChunks(document: ProcessedDocument): Promise<void> {
  // This is where you would store the document chunks in your database
  // Example implementation using your existing storage interface
  console.log(`Stored document: ${document.metadata.title} with ${document.chunks.length} chunks`);
}

/**
 * Find relevant document chunks based on a query
 * @param query The search query
 * @returns Array of relevant chunks
 */
export async function findRelevantChunks(query: string): Promise<DocumentChunk[]> {
  // This would be implemented using a vector database or search engine
  // For now, we'll return a placeholder
  console.log(`Searching for: ${query}`);
  return [];
}