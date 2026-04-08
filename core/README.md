# Core

Camada de simulacao e narrativa desacoplada da renderizacao.

## Objetivo

- Manter regras, estado do mundo e NPCs independentes da UI.
- Permitir uso por `index.html` (chat debug) e pelo cliente Phaser.

## Modulos

- `engine.js`: regras, decisao `ALLOWED/DENIED/CONDITIONAL`, efeitos e consequencias.
- `world.js`: estado global, reputacao, eventos, tempo, rumores.
- `npc.js`: templates, memoria, necessidades e comportamento autonomo.
- `chat.js`: fluxo two-pass com LLM (fala em personagem + requests estruturadas).
- `llmBridge.js`: fluxo two-pass headless para clientes in-world (sem dependencia de DOM/UI).
- `parser.js`: parse da resposta estruturada do LLM.
- `config.js`: parametros de balanceamento, prompts e tabelas.
- `ui.js`: utilitarios de UI do modo chat debug.
- `main.js`: bootstrap do modo chat debug atual.

## Contrato minimo para cliente de jogo

Um cliente (ex: Phaser) deve conseguir:

1. Instanciar `WorldState`, `NPC` e `GameEngine`.
2. Enviar intents do jogador (acao + alvo + contexto) para `engine.evaluate`.
3. Aplicar efeitos com `engine.applyEffects`.
4. Atualizar HUD e log com base em `engine.stats`, `engine.flags`, `world.events`.

## Integracao LLM em cliente de jogo

- Para UI web de debug, use `chat.js` + `ui.js`.
- Para clientes de jogo (Phaser, Godot, etc), use `createInWorldChatBridge()` em `llmBridge.js`.
- A bridge headless preserva historico, aplica passivo (`applyPassiveEffects`) e executa requests do motor no fluxo two-pass.

## Observacao

`ui.js` e `main.js` sao do modo de debug. A logica de jogo fica nos demais modulos.
