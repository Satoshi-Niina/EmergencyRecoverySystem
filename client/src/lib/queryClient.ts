import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  customHeaders?: Record<string, string>,
): Promise<Response> {
  const headers: Record<string, string> = {
    ...(data ? { "Content-Type": "application/json" } : {}),
    ...customHeaders
  };
  
  // ブラウザキャッシュ対策用のタイムスタンプパラメータを追加
  const urlWithCache = url.includes('?') 
    ? `${url}&_t=${Date.now()}` 
    : `${url}?_t=${Date.now()}`;
  
  const res = await fetch(urlWithCache, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
    // キャッシュ制御を追加
    cache: method === 'GET' ? 'no-cache' : 'default'
  });

  // キャッシュクリアヘッダーをチェック
  if (res.headers.get('X-Chat-Cleared') === 'true') {
    console.log('サーバーからキャッシュクリア指示を受信');
    // ローカルストレージの関連キーをクリア
    const keyPrefix = 'rq-' + url.split('?')[0];
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(keyPrefix)) {
        localStorage.removeItem(key);
      }
    }
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // チャットクリア後は強制的に空配列を返す
    if (
      (queryKey[0] as string).includes('/api/chats') && 
      (queryKey[0] as string).includes('/messages')
    ) {
      const chatClearedTimestamp = localStorage.getItem('chat_cleared_timestamp');
      if (chatClearedTimestamp) {
        const clearTime = parseInt(chatClearedTimestamp);
        const now = Date.now();
        // クリアしてから10秒以内なら強制的に空配列を返す
        if (now - clearTime < 10000) {
          console.log('クエリキャッシュクリア直後のためメッセージを空にします');
          return [];
        }
      }
    }
    
    // クエリキーにキャッシュバスティングパラメータを追加
    let url = queryKey[0] as string;
    const timestamp = Date.now();
    url = url.includes('?') ? `${url}&_t=${timestamp}` : `${url}?_t=${timestamp}`;
    
    const res = await fetch(url, {
      credentials: "include",
      cache: "no-cache", // ブラウザキャッシュを使用しない
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }
    
    // キャッシュクリアヘッダーをチェック
    if (res.headers.get('X-Chat-Cleared') === 'true') {
      console.log('クエリ実行中にキャッシュクリア指示を受信: 空配列を返します');
      // クリアフラグが付いている場合は空配列を返す
      return [];
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 60000, // 1分間はキャッシュを使用
      retry: false,
      refetchOnMount: true, // コンポーネントがマウントされるたびに再取得
    },
    mutations: {
      retry: false,
    },
  },
});
