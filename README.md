Access the site at : https://argumint.vercel.app/

# 🧠 Argumint – AI-Powered Mock Debate Platform

Welcome to **Argumint** – a platform built to simulate real-world debate experiences using AI and live interactions. Whether you're debating a smart AI opponent or challenging a real human, Argumint brings structure, evaluation, and insight to the world of argumentation.

---

## 🧩 Features

### 🔐 Authentication & Profiles
- **Supabase Auth** for secure user login/signup.
- Profiles store **name**, **interests**, **debate stats**, and **transcripts**.

### 🎯 Topic Generation
- Topic is generated dynamically based on user’s **interest**.
- Uses Gemini-based backend with fallback to generic themes.

### 🧑‍💻 Debate Flow
- Choose between:
  - 🤖 **AI Opponent** (Beginner, Intermediate, Advanced)
  - 👤 **Human Opponent** (via link)
- Structured debate:
  - 3 to 5 rounds
  - Turn-based message control
  - **Live transcription** using **AssemblyAI**

### 🧑‍⚖️ Judging System
- On debate completion:
  - Transcripts sent to **Gemini 2.5 Flash** ==
  - Evaluates based on:
    - Logic
    - Rebuttal Strength
    - Clarity
  - Returns:
    - Winner
    - Score (100 scale)
    - Feedback

### 🏆 Leaderboard & Stats
- Tracks number of **debates participated**, **won**, and **average scores**
- All results saved to **Supabase PostgreSQL**

### 💬 Human vs Human Debates
- Debaters share a URL to join the same room.
- Realtime syncing via **Supabase channel**.
- Structured flow, just like AI mode.

---

## 🛠 Tech Stack

| Layer        | Technology                     |
|--------------|-------------------------------|
| Frontend     | React + Vite + TailwindCSS     |
| Backend      | Node.js + Express              |
| Auth & DB    | Supabase (Postgres + Auth)     |
| AI Judging   | Gemini API                     |
| Transcription| AssemblyAI Streaming API       |
| Hosting      | Vercel (Frontend) + Render (Backend) |

---

## 📚 Learnings

- Building **real-time SSE** for debates with fine control on turns.
- Handling **live transcription pipelines** using Web Streams.
- Constructing **judging prompts** that mimic real-world adjudication rubrics.
- Managing cross-origin deployments between **Vercel ↔ Render**.
- SPA routing issues and fixing via fallback configurations.
- Building UI using React, Framer motion, Tailwind

---

## 🧪 Try It Out

- 🔗 [Frontend (Vercel)](https://argumint.vercel.app)

# 🎯 Submission for Track B – Live Mock Debates  
### 💡 IDL x Agentix Hackathon


## ✅ Track Requirement Match

| Feature Required                   | Status   | Implementation                                 |
|-----------------------------------|----------|------------------------------------------------|
| Live Turn-Based Debate            | ✅        | Alternating turns enforced by role & state     |
| AI Evaluation and Feedback        | ✅        | Gemini model rates score & gives feedback |
| Adjustable AI Difficulty          | ✅        | Beginner / Intermediate / Advanced AI modes    |
| Audio Transcription               | ✅        | AssemblyAI live stream transcription           |
| Rebuttal-Based Format             | ✅        | Each user responds in rounds (min 3)           |
| Human ↔ Human Debate Option       | ✅        | Shareable room link with role assignment       |
| Topic Relevance                   | ✅        | Topics based on user interests (from profile)  |

---
## 🎥 Demo Video

> 🔗 [Watch the full demo]-> To be uploaded

---

## 👨‍💻 Developer

- **Shivansh** – [GitHub @ShivanshCoding36](https://github.com/ShivanshCoding36)

---
