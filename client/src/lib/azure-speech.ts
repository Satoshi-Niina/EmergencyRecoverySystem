// Speech recognition service using Azure Cognitive Services

let recognition: any = null;

// Check if browser supports speech recognition
const browserSupportsSpeechRecognition = () => {
  return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
};

// Initialize speech recognition
const initSpeechRecognition = () => {
  if (browserSupportsSpeechRecognition()) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'ja-JP';
    return true;
  }
  return false;
};

// Start speech recognition
export const startSpeechRecognition = (
  onResult: (text: string) => void, 
  onError: (error: string) => void
) => {
  if (!initSpeechRecognition()) {
    onError('お使いのブラウザは音声認識をサポートしていません。');
    return;
  }

  recognition.onresult = (event: any) => {
    const transcript = Array.from(event.results)
      .map((result: any) => result[0])
      .map((result) => result.transcript)
      .join('');
    
    onResult(transcript);
  };

  recognition.onerror = (event: any) => {
    onError(`音声認識エラー: ${event.error}`);
  };

  recognition.start();
};

// Stop speech recognition
export const stopSpeechRecognition = () => {
  if (recognition) {
    recognition.stop();
    recognition = null;
  }
};

// In a real implementation, this would connect to Azure's Speech Service
// For now, we're using the browser's built-in SpeechRecognition API
// When integrating with Azure, you would use the Azure Speech SDK:
/*
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';

const speechConfig = sdk.SpeechConfig.fromSubscription(
  process.env.AZURE_SPEECH_KEY || '',
  process.env.AZURE_SPEECH_REGION || ''
);
speechConfig.speechRecognitionLanguage = 'ja-JP';

const startAzureSpeechRecognition = async (onResult, onError) => {
  const audioConfig = sdk.AudioConfig.fromDefaultMicrophoneInput();
  const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);
  
  recognizer.recognized = (s, e) => {
    if (e.result.reason === sdk.ResultReason.RecognizedSpeech) {
      onResult(e.result.text);
    }
  };
  
  recognizer.canceled = (s, e) => {
    if (e.reason === sdk.CancellationReason.Error) {
      onError(`音声認識エラー: ${e.errorDetails}`);
    }
  };
  
  recognizer.startContinuousRecognitionAsync();
  return recognizer;
};

const stopAzureSpeechRecognition = (recognizer) => {
  if (recognizer) {
    recognizer.stopContinuousRecognitionAsync();
  }
};
*/
