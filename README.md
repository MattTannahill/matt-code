> ⚠️ This project is an early prototype.  All APIs are subject to change.

# Matt Code

An extensible, AI-powered, command-line coding assistant.

## Design

### Plugins
Matt Code is built on [oclif](https://oclif.io/).  This allows it to use oclif's 
[plugin system](https://oclif.io/docs/plugins/) to add functionality to the application.

Matt Code extends the concept of an oclif plugin by allowing them to define providers.  Plugins may implement these providers to add functionality to Matt Code.  

For example, the [ToolProvider](./packages/api/src/tool-provider.ts) allows a plugin to define tools that that AI may call.  One such example can be found in the [just-bash plugin](./packages/plugins/just-bash/) which exposes [Vercel's just-bash](https://github.com/vercel-labs/just-bash) to provide
the Matt Code agent access to the filesystem.

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

```bash
npm start -- ui --api=anthropic
```