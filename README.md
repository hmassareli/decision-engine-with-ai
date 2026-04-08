# The Broken Lamp

RPG sandbox narrativo medieval com NPCs autonomos e dialogo via LLM local.

## Estrutura
- `core/`: simulacao, regras e consequencias (fonte de verdade).
- `game-phaser/`: cliente de jogo (render, input, mapa e HUD).
- `index.html`: modo chat debug para testar NPCs e fluxo two-pass.

## Filosofia tecnica
- O LLM interpreta personagem e fala em roleplay.
- O `core` decide regras e efeitos (`ALLOWED`, `DENIED`, `CONDITIONAL`).
- UI/cliente nunca aplica regra direto sem passar pelo `core`.

## Fluxo de execucao
### 1. Debug de NPC/chat
Use para iterar prompts, parser e tool-calling narrativo.
1. Inicie LM Studio local com endpoint compativel OpenAI.
2. Abra `index.html` (com um servidor local simples) e converse.
3. O app usa `core/main.js` + modulos de `core/`.

### 2. Cliente Phaser
Use para gameplay in-world (movimento/interacao no mapa).
1. Desenvolva cenas e UI em `game-phaser/src`.
2. Consuma o motor via `game-phaser/src/adapters/coreAdapter.js`.
3. Toda intent de jogo deve passar por `CoreAdapter.processIntent(...)`.

## Contrato inicial do adapter
- `processIntent(intent)`: avalia e aplica efeitos no `core`.
- `sendDialogue(text)`: encaminha fala para o fluxo de chat/LLM via `chatBridge` injetado.
- `getSnapshot()`: estado consolidado para HUD e debug panel.
- `tickAutonomous()`: processa comportamento autonomo de NPCs.
- `moveTo(locationId)`: muda local no `world` e avanca tempo.
