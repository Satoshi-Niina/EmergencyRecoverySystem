import OpenAI from "openai";

// Check if API key is available
const apiKey = process.env.OPENAI_API_KEY;
console.log(`[DEBUG] OpenAI API KEY exists: ${apiKey ? 'YES' : 'NO'}`);
console.log(`[DEBUG] Environment variables: ${Object.keys(process.env).join(', ')}`);

if (!apiKey) {
  console.error('ERROR: OPENAI_API_KEY is not set in the environment variables');
  console.error('OpenAI functionality will not work without a valid API key');
}

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: apiKey || "",
  dangerouslyAllowBrowser: true // Allow running in browser environment if needed
});

// Function to check if API key is present before making requests
function validateApiKey(): boolean {
  if (!apiKey) {
    console.error('ERROR: No OpenAI API key available');
    return false;
  }
  return true;
}

// Process a text request and get an AI response
export async function processOpenAIRequest(prompt: string): Promise<string> {
  try {
    // Check if API key is available
    if (!validateApiKey()) {
      return "OpenAI APIキーが設定されていません。システム管理者に連絡してください。";
    }
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an emergency vehicle maintenance and recovery assistant. 
          Your purpose is to help users troubleshoot and repair emergency vehicles like ambulances, fire trucks, and police cars.
          Provide clear, concise, and helpful information about vehicle maintenance, emergency procedures, and technical specifications.
          Always prioritize safety and refer to official guidelines when possible.
          If you're unsure about anything, admit it and suggest consulting the manufacturer or a certified technician.
          Keep your responses professional and focused on helping the user with their emergency vehicle issues.`
        },
        {
          role: "user",
          content: prompt
        }
      ]
    });
    
    const content = response.choices[0].message.content || "申し訳ありませんが、応答を生成できませんでした。";
    return content;
  } catch (error: any) {
    console.error("OpenAI API error:", error);
    
    // Check for authentication errors
    if (error?.status === 401) {
      return "OpenAI APIキーが無効または設定されていません。システム管理者に連絡してください。";
    }
    
    // Check for rate limit errors
    if (error?.status === 429) {
      return "OpenAI APIのリクエスト制限に達しました。しばらく待ってからもう一度お試しください。";
    }
    
    return "申し訳ありませんが、エラーが発生しました。後でもう一度お試しください。";
  }
}

// Process a selected text to generate a search query
export async function generateSearchQuery(selectedText: string): Promise<string> {
  try {
    // Check if API key is available
    if (!validateApiKey()) {
      return selectedText;
    }
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a search query optimizer for emergency vehicle maintenance documentation. 
          Your task is to convert the user's selected text into an optimal search query for finding relevant maintenance documents.
          Extract the most important technical terms and vehicle components. 
          Return ONLY the optimized search query terms without any explanations or additional text.`
        },
        {
          role: "user",
          content: `Generate an optimized search query from this text: "${selectedText}"`
        }
      ],
      max_tokens: 50
    });
    
    const content = response.choices[0].message.content || selectedText;
    return content;
  } catch (error: any) {
    console.error("OpenAI API error in search query generation:", error);
    
    // Still return the selected text even if there's an error
    return selectedText;
  }
}

// Analyze an image to identify vehicle parts or issues
export async function analyzeVehicleImage(base64Image: string): Promise<{
  analysis: string;
  suggestedActions: string[];
}> {
  try {
    // Check if API key is available
    if (!validateApiKey()) {
      return {
        analysis: "OpenAI APIキーが設定されていません。システム管理者に連絡してください。",
        suggestedActions: ["システム管理者に連絡してAPIキーを確認してください。"]
      };
    }
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert in emergency vehicle maintenance and diagnostics.
          Analyze the provided image of a vehicle part or system.
          Identify components, potential issues, and suggest troubleshooting steps.
          Focus on emergency vehicles such as ambulances, fire trucks, and police cars.
          Provide your analysis in JSON format with two fields:
          1. "analysis": A detailed description of what you see in the image, focusing on vehicle components and their condition
          2. "suggestedActions": An array of 3-5 recommended next steps for troubleshooting or repair`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Please analyze this emergency vehicle component image and provide diagnostic information:"
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ]
        }
      ],
      response_format: { type: "json_object" }
    });
    
    const content = response.choices[0].message.content || "{}";
    const result = JSON.parse(content);
    return {
      analysis: result.analysis || "画像分析を完了できませんでした。",
      suggestedActions: result.suggestedActions || ["技術者に相談してください。"]
    };
  } catch (error: any) {
    console.error("OpenAI image analysis error:", error);
    
    // Check for authentication errors
    if (error?.status === 401) {
      return {
        analysis: "OpenAI APIキーが無効または設定されていません。システム管理者に連絡してください。",
        suggestedActions: ["システム管理者に連絡してAPIキーを確認してください。"]
      };
    }
    
    // Check for rate limit errors
    if (error?.status === 429) {
      return {
        analysis: "OpenAI APIのリクエスト制限に達しました。",
        suggestedActions: ["しばらく待ってからもう一度お試しください。", "技術サポートにお問い合わせください。"]
      };
    }
    
    return {
      analysis: "画像分析中にエラーが発生しました。",
      suggestedActions: ["もう一度お試しください。", "別の画像をアップロードしてみてください。", "技術サポートにお問い合わせください。"]
    };
  }
}
