
# 🚀 AI Pic 2 Code – Image → Code Generator  
### *(Frontend-Only | React + TypeScript | Multi-Model AI Support)*

**AI Pic2Code** is a **free, open-source**, 100% **frontend-only** AI tool that converts UI screenshots into clean, production-ready code.

No backend. No server. No storage.  
All AI requests are made **directly from the browser** using:

- **Google Gemini 3 Pro** (recommended)  
- **OpenRouter multi-provider** (Claude / GPT-4o / DeepSeek / Grok / Qwen / Free Gemini)

🔗 **Live Demo:** https://seeb4coding.in/ai/pic-2-code/  
🔗 **GitHub Repository:** https://github.com/seeb4coding/pic-2-code

---

## ✨ Features

### 🖼️ Screenshot → Code

Generate production-ready UI code for:

- **HTML + Tailwind CSS**  
- **React** (JSX + Tailwind)  
- **Flutter UI** (Dart)  
- **React Native Components**  

---

### ⚙️ Multi-Provider AI Support  

Select your preferred model in **Settings**.

#### 🔹 Google Gemini

- Gemini 3.0 Pro  
- Gemini 3.0 Pro Preview  
- Gemini 2.5 Pro  
- Gemini 2.5 Flash  
- Gemini 2.5 Flash Thinking  
- Gemini 2.0 Flash Lite  

#### 🔹 OpenRouter

- Gemini 2.0 Flash (Free)  
- Gemini 2.0 Pro (Free)  
- Claude 3.5 Sonnet  
- Claude 3 Opus  
- DeepSeek R1  
- GPT-4o  
- Grok 4.1 Fast (Free)  
- Qwen 2.5 VL 72B (Free)  

---

## 🎨 Built-in UI Tools

- Drag & drop image upload  
- Image preview modal  
- Multi-tab code viewer  
- Settings modal  
- Color palette extraction  
- Voice input  
- Toast notifications  
- Skeleton loader  
- Dark / Light mode  

---

## 🧱 Project Structure

```
AI-PIC2CODE
│
├── components/
│   ├── Button.tsx
│   ├── CodeViewer.tsx
│   ├── ColorPalette.tsx
│   ├── ExplainModal.tsx
│   ├── Header.tsx
│   ├── ImageModal.tsx
│   ├── SettingsModal.tsx
│   ├── SkeletonLoader.tsx
│   ├── UploadZone.tsx
│   └── VoiceInput.tsx
│
├── services/
│   ├── gemini.service.ts
│   └── openrouter.service.ts
│
├── utils/
│   ├── helpers.ts
│   ├── image.ts
│   └── format.ts
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
```

---

## 📥 Installation

### 1️⃣ Clone the Project

```bash
git clone https://github.com/seeb4coding/pic-2-code
cd ai-pic2code
```

### 2️⃣ Install Dependencies

```bash
npm install
```

### 3️⃣ Add API Keys

Create a `.env.local` file:

```env
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
OPENROUTER_API_KEY=YOUR_OPENROUTER_API_KEY
```

---

## 🌐 Model List

```ts
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
```

---

## 🧪 Run Locally

```bash
npm run dev
```

Visit: http://localhost:5173

---

## 📦 Build

```bash
npm run build
npm run preview
```

---

## 🛣️ Roadmap

- Vue.js output  
- Angular output  
- ZIP export  
- Local history  
- Custom Tailwind theme generator  
- AI auto-cleanup  

---

## ✅ Google AI Studio

This project was developed using Google AI Studio, which provides direct access to Gemini models through a browser-based API.
All Gemini-powered features (HTML/Tailwind conversion, React generation, Flutter widgets, and React Native layout generation) are executed using Gemini models from AI Studio, without requiring any backend server.

## 👨‍💻 Author

seeb4coding.in  
📧 support@seeb4coding.in  
🌐 https://seeb4coding.in  

---

## ⭐ Support  
Give a ⭐ on GitHub if you like this project!
