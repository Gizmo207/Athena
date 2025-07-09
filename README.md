# Athena Multi-Agent AI Platform

A modern, modular, multi-agent AI platform built with Next.js, TypeScript, and LangChain. Features plug-and-play agent switching, vector-backed memory, voice input/output, and a scalable architecture for public and private collaboration.

## 🚀 Features
- **Multi-Agent System**: Switch between specialized AI agents (Overseer, DevBot, BizBot, PromptBot, DesignBot)
- **Voice Support**: Web Speech API for voice-to-text and text-to-speech
- **RAG Memory**: Long-term vector store (Chroma/HNSWLib) and short-term conversation memory
- **Modern UI**: Neon-glow chat, agent switcher, responsive design, and professional branding
- **TypeScript & Airbnb+Prettier**: Strict, readable, maintainable codebase
- **Ready for Vercel or server deployment**

## 🧑‍💻 Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to use Athena.

## 🗂️ Project Structure
- `src/` — App code, UI, and components
- `lib/` — Memory, vectorstore, helpers
- `prompts/` — Modular agent prompts
- `pages/api/` — API endpoints (RAG, chat)
- `athena-vectorstore/` — Vector memory store

## 🧩 Extending
- Add new agents in `src/components/AgentSwitcher.tsx` and `prompts/`
- Modular prompt loading and agent registration
- Future-proofed for tools/plugins and test harness

## 📄 License
MIT
