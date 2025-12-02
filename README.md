# 🚀 AI Pic2Code – Image → Code Generator  
### *(Frontend-Only | React + TypeScript | Multi-Model AI Support)*

**AI Pic2Code** is a **free, open-source**, 100% **frontend-only** AI tool that converts UI screenshots into clean, production-ready code.

No backend. No server. No storage.  
All AI requests are made **directly from the browser** using:

- **Google Gemini 3 Pro** (recommended)  
- **OpenRouter multi-provider** (Claude / GPT-4o / DeepSeek / Grok / Qwen / Free Gemini)

🔗 **Live Demo:** https://uniqueindsolutions.com/ai/pic-2-code/  
🔗 **GitHub Repository:** *(add link here)*  

---

## ✨ Features

### 🖼️ Convert Screenshot → Code
Generate production-ready:
- HTML + Tailwind CSS  
- React (JSX + Tailwind)  
- Flutter UI (Dart)  
- React Native Components  

### ⚙️ Multi-Provider AI Support  
Choose models from Settings:

#### **Google Gemini**
- Gemini 3.0 Pro  
- Gemini 3.0 Pro Preview  
- Gemini 2.5 Pro  
- Gemini 2.5 Flash  
- Gemini 2.5 Flash Thinking  
- Gemini 2.0 Flash Lite  

#### **OpenRouter**
- Gemini 2.0 Flash (Free)  
- Gemini 2.0 Pro (Free)  
- Claude 3.5 Sonnet  
- Claude 3 Opus  
- DeepSeek R1  
- GPT-4o  
- Grok 4.1 Fast (Free)  
- Qwen 2.5 VL 72B (Free)  

### 🎨 UI Tools Included
- Drag & Drop image upload  
- Image preview modal  
- Code viewer with tabs  
- Settings modal  
- Color palette extraction  
- Voice input  
- Toast notifications  
- Skeleton loader  
- Dark/Light mode  

---

## 🧱 Project Structure
AI-PIC2CODE
│
├── components/
│ ├── Button.tsx
│ ├── CodeViewer.tsx
│ ├── ColorPalette.tsx
│ ├── ExplainModal.tsx
│ ├── Header.tsx
│ ├── ImageModal.tsx
│ ├── SettingsModal.tsx
│ ├── SkeletonLoader.tsx
│ ├── UploadZone.tsx
│ └── VoiceInput.tsx
│
├── services/
│ ├── gemini.service.ts
│ └── openrouter.service.ts
│
├── utils/
│ ├── helpers.ts
│ ├── image.ts
│ └── format.ts
│
├── App.tsx
├── constants.ts
├── types.ts
├── index.tsx
├── index.html
├── metadata.json
├── package.json
├── tsconfig.json
├── .env.local
└── README.md


---

## 📥 Installation

### 1️⃣ Clone the Project
```bash
git clone https://github.com/your-username/ai-pic2code.git
cd ai-pic2code

2️⃣ Install Dependencies
npm install

3️⃣ Add API Keys

Create .env.local:

# Gemini API
GEMINI_API_KEY=PLACEHOLDER_API_KEY

Get API keys:
Gemini → https://aistudio.google.com
OpenRouter → https://openrouter.ai

🌐 Model Selection in Settings
Your app includes this model list:
export const AVAILABLE_MODELS = [
  { id: 'gemini-3-pro', name: 'Gemini 3.0 Pro', provider: 'gemini' },
  { id: 'gemini-3-pro-preview', name: 'Gemini 3.0 Pro Preview', provider: 'gemini' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'gemini' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'gemini' },
  { id: 'gemini-2.5-flash-thinking-exp-01-21', name: 'Gemini 2.5 Flash Thinking', provider: 'gemini' },
  { id: 'gemini-2.0-flash-lite-preview-02-05', name: 'Gemini 2.0 Flash Lite', provider: 'gemini' },

  { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash (Free)', provider: 'openrouter' },
  { id: 'google/gemini-2.0-pro-exp-02-05:free', name: 'Gemini 2.0 Pro (Free)', provider: 'openrouter' },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'openrouter' },
  { id: 'anthropic/claude-3-opus', name: 'Claude 3 Opus', provider: 'openrouter' },
  { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', provider: 'openrouter' },
  { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'openrouter' },
  { id: 'x-ai/grok-4.1-fast:free', name: 'Grok 4.1 Fast (Free)', provider: 'openrouter' },
  { id: 'qwen/qwen-2.5-vl-72b-instruct:free', name: 'Qwen 2.5 VL 72B (Free)', provider: 'openrouter' },
];

🔌 AI Service Logic
  A single dispatcher decides which service to call:
  export async function generateAIResponse(modelId, base64, framework) {
    const isGemini = modelId.startsWith("gemini");
  
    if (isGemini)
      return await callGemini(modelId, base64, framework);
  
    return await callOpenRouter(modelId, base64, framework);
  }

🧪 Run the Project
  npm run dev

Open:
  👉 http://localhost:5173

📦 Build for Production
  npm run build
  npm run preview

🛣️ Roadmap
  ⬜ Vue.js output
  ⬜ Angular output
  ⬜ ZIP export (image + code)
  ⬜ Local history
  ⬜ Custom Tailwind theme generator
  ⬜ AI-based code cleanup

🤝 Contributing
  Fork the repo
  Create a branch
  Commit changes
  Open a pull request

📜 License
MIT License — free for personal and commercial use.

👨‍💻 Author
seeb4coding.in
📧 Email: support@seeb4coding.in
🌐 Website: https://seeb4coding.in

⭐ Support
If this project helped you, consider supporting with a GitHub Star ⭐
