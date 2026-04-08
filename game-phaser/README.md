# game-phaser

Cliente do jogo para mapa, movimento, colisao, HUD e interacoes in-world.

## Estado atual

Base inicial criada com Phaser + Vite:

- cena `BootScene` para preload
- cena `WorldScene` com mapa placeholder, fisica arcade, colisao e camera
- placeholders de NPC para iniciar interacoes
- `CoreAdapter` conectado ao `core/` para intents e estado
- Dialogo in-world integrado via bridge LLM headless (`core/llmBridge.js`)
- Assets iniciais importados de `godew-valley` em `assets/godew-valley/`

## Rodar localmente

No diretorio `game-phaser/`:

1. `npm install`
2. `npm run dev`
3. abra a URL mostrada pelo Vite

## Estrutura

- `src/scenes/` - cenas Phaser
- `src/entities/` - atores do mundo (NPC/player visual)
- `src/adapters/` - ponte para o `core/`
- `src/ui/` - HUD e overlays
- `assets/` - sprites, tilesets, tilemaps, audio

## Como importar seus assets

1. Coloque os packs em subpastas dentro de `assets/godew-valley/`.
2. O preload e automatico via `src/assets/godewAssetManifest.js` + `import.meta.glob`.
3. `src/scenes/BootScene.js` carrega automaticamente `png/mp3/ogg/wav/svg` do diretório.
4. Fontes (`ttf/otf`) entram no build, mas nao sao carregadas pelo Phaser Loader por padrao.
5. Troque placeholders da `WorldScene` por tilemap/sprites reais.

## Integracao com o core

Use `src/adapters/coreAdapter.js` como porta unica:

- `processIntent(intent)` para regras e consequencias
- `getSnapshot()` para HUD/debug
- `tickAutonomous()` para rotina de NPC
- `moveTo(locationId)` para mudanca de local/tempo

`sendDialogue(text, options)` agora usa bridge de LLM por padrao e retorna:

- `chat.assistantText`: texto final do NPC
- `chat.decisions`: requests avaliadas pelo motor
- `snapshot`: estado atualizado para HUD/log

## Alias de compatibilidade

`BootScene` mantem aliases para chaves usadas na cena atual:

- `gv-grass`, `gv-path`, `gv-walls-floor`
- `gv-player-main`, `gv-npc-woman`
- `gv-step`, `gv-music`

`sendDialogue(text)` exige `chatBridge` injetado, para manter o cliente Phaser desacoplado da UI de debug HTML.
