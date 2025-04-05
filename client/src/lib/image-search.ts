import Fuse from 'fuse.js';
import { apiRequest } from './queryClient';

// Sample document data for demonstration
// In a real application, this would come from the server
const sampleDocuments = [
  {
    id: 1,
    title: '救急車用ジャンプスターター操作マニュアル',
    type: 'pdf',
    url: 'https://images.unsplash.com/photo-1630515672807-43487aa8e9e0?w=500&auto=format&fit=crop&q=60',
    keywords: ['ジャンプスターター', 'バッテリー', '救急車', '電圧', '始動', 'エンジン']
  },
  {
    id: 2,
    title: '救急車バッテリー交換手順書',
    type: 'pdf',
    url: 'https://images.unsplash.com/photo-1649159261875-5242dc38a3a4?w=500&auto=format&fit=crop&q=60',
    keywords: ['バッテリー', '交換', '救急車', '電圧', '手順', 'メンテナンス']
  },
  {
    id: 3,
    title: '緊急車両故障時対応フローチャート',
    type: 'excel',
    url: '',
    keywords: ['故障', '対応', '緊急車両', 'フローチャート', 'エンジン', '始動不良']
  },
  {
    id: 4,
    title: '消防車油圧システム診断ガイド',
    type: 'pdf',
    url: 'https://images.unsplash.com/photo-1599148401005-fe6d7497cb5e?w=500&auto=format&fit=crop&q=60',
    keywords: ['油圧', 'システム', '消防車', '診断', 'メンテナンス']
  },
  {
    id: 5,
    title: 'パトカーエンジン冷却システム解説',
    type: 'pdf',
    url: 'https://images.unsplash.com/photo-1606577924006-27d39b132ae2?w=500&auto=format&fit=crop&q=60',
    keywords: ['冷却', 'エンジン', 'パトカー', 'オーバーヒート', 'メンテナンス']
  }
];

// Configure Fuse.js for fuzzy searching
const fuseOptions = {
  includeScore: true,
  keys: ['title', 'keywords'],
  threshold: 0.4
};

// Create a new Fuse instance with our sample data
const fuse = new Fuse(sampleDocuments, fuseOptions);

/**
 * Search for documents based on a text query using Fuse.js
 * @param text The search query text
 * @returns Array of search results
 */
export const searchByText = async (text: string): Promise<any[]> => {
  try {
    // In a real application, we would make an API call to the server
    // to get search results based on the selected text.
    // For now, we'll use Fuse.js for client-side fuzzy searching.
    
    // First try to get an optimized search query from OpenAI
    try {
      const response = await apiRequest('POST', '/api/optimize-search-query', { text });
      const data = await response.json();
      text = data.optimizedQuery || text;
    } catch (error) {
      console.error('Error optimizing search query:', error);
      // Fall back to the original text if optimization fails
    }
    
    // Perform the search
    const searchResults = fuse.search(text);
    
    // Map the results to our desired format
    return searchResults.map(result => ({
      id: result.item.id,
      title: result.item.title,
      type: result.item.type,
      url: result.item.url,
      relevance: (1 - (result.score || 0)) * 100 // Convert score to percentage relevance
    }));
  } catch (error) {
    console.error('Search error:', error);
    throw new Error('検索に失敗しました');
  }
};
