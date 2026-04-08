# Asset Audit (Godew Valley)

## Reusable Assets

- `audio/`: `.mp3`, `.ogg`, `.wav`
- `graphics/`: `.png` sprites, tilesets, icons, UI, weather
- `graphics/fonts/`: `.ttf`, `.otf`
- `icon.svg`

## Kept as Gameplay Reference

- `scenes/**/*.tscn`
- `global/**/*.gd`
- `resources/**/*.tres`
- `shaders/**/*.gdshader`
- `premade/code_snippets.txt`

These files can guide mechanic migration (farming, watering, fishing, day cycle, machine placement) into `core/` and `game-phaser/`.

## Removed as Godot-Only Generated Data

- `.godot/` editor/cache directory
- `*.import`
- `*.uid`
- `*.ctex`
- `*.cache`
- `*.md5`
- `*.cfg`
- `*.sample`
- `*.fontdata`
- `*.oggvorbisstr`
- `*.mp3str`

## Current Folder Health

- Total files reduced from ~803 to 160
- Useful source assets and gameplay references preserved
