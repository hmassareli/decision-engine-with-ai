# Prompt: Monorepo limpo (Core + Phaser)

Voce e meu arquiteto de jogo para The Broken Lamp.
Objetivo: montar um monorepo com duas camadas desacopladas:

- `core/`: simulacao narrativa deterministica (engine, world, npc, gossip, economia, combate, parser, chat llm adapter)
- `game-phaser/`: cliente visual em Phaser (mapa, movimento, colisao, input, HUD e dialogo in-world)

## Regras de arquitetura

- O LLM NUNCA decide regra de jogo.
- O `core` decide tudo: `ALLOWED`, `DENIED`, `CONDITIONAL`, custo, dano, reputacao, deeds, flags, economia, consequencias.
- O LLM so interpreta personagem e gera fala/intent estruturada.
- O cliente Phaser nunca altera estado direto: ele envia intents e aplica apenas o retorno do `core`.

## Contratos de API (obrigatorio)

Defina e use contratos TS/JSDoc claros:

- `PlayerIntent`:
  - `action: string`
  - `target?: string`
  - `seriousness?: number`
  - `context?: string`
  - `source?: "player" | "npc" | "system"`
- `EngineDecision`:
  - `decision: "ALLOWED" | "DENIED" | "CONDITIONAL"`
  - `reason: string`
  - `effects: Record<string, number | string | boolean>`
  - `worldEvents?: WorldEvent[]`
- `DialogueTurn`:
  - `speakerId: string`
  - `text: string`
  - `request?: PlayerIntent`

## Entregas

1. Estrutura de pastas completa.
2. Arquivos base com TODOs reais (sem boilerplate vazio).
3. Adaptador `game-phaser/src/adapters/coreAdapter.*` consumindo `core`.
4. Cena inicial Phaser com player movendo em mapa simples e tecla de interacao com NPC.
5. Fluxo de dialogo in-world:
   - abre UI de fala
   - envia texto para adapter/chat
   - recebe resposta de personagem
   - aplica eventos no estado
6. Logger de eventos do mundo em painel debug.
7. Script de execucao para modo debug (`chat`) e modo jogo (`phaser`).

## Qualidade

- Codigo modular, legivel e testavel.
- Comentarios curtos somente onde agregar.
- Sem dependencia de backend remoto obrigatoria.
- Preparado para trocar imports locais por API local no futuro.

Agora gere a implementacao incremental em passos pequenos, com cada passo executavel.
