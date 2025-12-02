# Pic2Code – Frontend-Only Image to Code (Open Source)

Pic2Code is a free, frontend-only tool that converts UI screenshots into:
- HTML + Tailwind CSS
- React JSX
- Flutter (Dart)
- React Native components

No backend. No server. Only static frontend files + AI model.

---

## ✨ Features
- Upload or paste a screenshot
- AI generates code directly in the browser
- Supports:
  - HTML + Tailwind
  - React
  - Flutter UI
  - React Native
- Copy code with one click
- Dark/Light UI
- Mobile-friendly interface

---

## 🧠 How It Works (Frontend Only)
- The browser reads your image using FileReader
- The image is converted to Base64
- The Base64 image + instructions are sent to AI model (OpenAI, Gemini, Claude, Groq, etc.)
- The model returns clean frontend code
- The UI displays the final output

No backend. No server storage.

---

## 🔧 Tech Stack
- HTML5  
- Tailwind CSS  
- Vanilla JavaScript or React (your version)  
- AI API (ChatGPT / Gemini / Claude / Groq)

---

## 🚀 Getting Started

### 1. Clone the repo
```bash
git clone https://github.com/seeb4coding/pic-2-code.git
cd pic2code
