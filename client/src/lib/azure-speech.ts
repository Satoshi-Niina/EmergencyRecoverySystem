// Speech recognition service using Azure Cognitive Services
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';

let recognizer: sdk.SpeechRecognizer | null = null;

// Azure Speech設定を初期化
const initAzureSpeechConfig = () => {
  try {
    const speechKey = import.meta.env.VITE_AZURE_SPEECH_KEY;
    const speechRegion = import.meta.env.VITE_AZURE_SPEECH_REGION;
    
    if (!speechKey || !speechRegion) {
      console.error('Azure Speech credentials are not set');
      return null;
    }
    
    const speechConfig = sdk.SpeechConfig.fromSubscription(speechKey, speechRegion);
    speechConfig.speechRecognitionLanguage = 'ja-JP';
    return speechConfig;
  } catch (error) {
    console.error('Failed to initialize Azure Speech config:', error);
    return null;
  }
};

// Start speech recognition
export const startSpeechRecognition = (
  onResult: (text: string) => void, 
  onError: (error: string) => void
) => {
  try {
    const speechConfig = initAzureSpeechConfig();
    
    if (!speechConfig) {
      onError('Azure Speech認証情報が設定されていません。');
      return;
    }
    
    // マイクからの音声入力を設定
    const audioConfig = sdk.AudioConfig.fromDefaultMicrophoneInput();
    recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);
    
    // 音声認識結果のイベントハンドラ
    recognizer.recognized = (s, e) => {
      if (e.result.reason === sdk.ResultReason.RecognizedSpeech) {
        onResult(e.result.text);
      }
    };
    
    // 音声認識キャンセル時のイベントハンドラ
    recognizer.canceled = (s, e) => {
      if (e.reason === sdk.CancellationReason.Error) {
        onError(`音声認識エラー: ${e.errorDetails}`);
      }
    };
    
    // 音声認識エラー時のイベントハンドラ
    recognizer.recognizing = (s, e) => {
      console.log(`認識中: ${e.result.text}`);
    };
    
    // 途中結果も表示
    recognizer.recognizing = (s, e) => {
      if (e.result.text) {
        onResult(e.result.text + '...');
      }
    };
    
    // 連続認識を開始
    recognizer.startContinuousRecognitionAsync(
      () => console.log('Azure Speech認識を開始しました'), 
      (error) => {
        console.error('認識開始エラー:', error);
        onError(`認識開始エラー: ${error}`);
      }
    );
  } catch (error) {
    console.error('Azure Speech初期化エラー:', error);
    onError(`Azure Speech初期化エラー: ${error}`);
  }
};

// Stop speech recognition
export const stopSpeechRecognition = () => {
  if (recognizer) {
    recognizer.stopContinuousRecognitionAsync(
      () => {
        console.log('Azure Speech認識を停止しました');
        recognizer = null;
      },
      (error) => console.error('認識停止エラー:', error)
    );
  }
};

// ブラウザによるフォールバック実装（Azureが使えない場合用）
let browserRecognition: any = null;

// ブラウザのSpeechRecognitionインターフェースの型定義
interface BrowserSpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: (event: any) => void;
  onerror: (event: any) => void;
}

// windowオブジェクトを拡張
interface Window {
  webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
  SpeechRecognition?: new () => BrowserSpeechRecognition;
}

// Check if browser supports speech recognition
const browserSupportsSpeechRecognition = () => {
  return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
};

// Start browser speech recognition (fallback)
export const startBrowserSpeechRecognition = (
  onResult: (text: string) => void, 
  onError: (error: string) => void
) => {
  if (!browserSupportsSpeechRecognition()) {
    onError('お使いのブラウザは音声認識をサポートしていません。');
    return;
  }

  // TypeScriptに型を教えるためのキャスト
  const SpeechRecognitionAPI = (window as any).SpeechRecognition || 
                          (window as any).webkitSpeechRecognition;
  browserRecognition = new SpeechRecognitionAPI();
  browserRecognition.continuous = true;
  browserRecognition.interimResults = true;
  browserRecognition.lang = 'ja-JP';

  browserRecognition.onresult = (event: any) => {
    const transcript = Array.from(event.results)
      .map((result: any) => result[0])
      .map((result) => result.transcript)
      .join('');
    
    onResult(transcript);
  };

  browserRecognition.onerror = (event: any) => {
    onError(`音声認識エラー: ${event.error}`);
  };

  browserRecognition.start();
};

// Stop browser speech recognition
export const stopBrowserSpeechRecognition = () => {
  if (browserRecognition) {
    browserRecognition.stop();
    browserRecognition = null;
  }
};
