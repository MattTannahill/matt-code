# Matt Code

An AI-powered, command-line coding assistant

## Requirements

1. [Node](https://nodejs.org/en/download)
1. [Ollama](https://ollama.com/)

## Setup

1. Start the local Ollama server so the CLI can reach it at http://localhost:11434:

   ```bash
   ollama serve
   ```

2. Pull [Qwen3-Coder](https://github.com/QwenLM/Qwen3-Coder):

   ```bash
   ollama pull qwen3-coder:30b
   ```

3. Run the model:

   ```bash
   ollama run qwen3-coder:30b
   ```

## Build

```bash
npm run build
```

## Usage
```bash
npm start
```