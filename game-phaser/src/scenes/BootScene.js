import Phaser from "phaser";
import {
  getGodewAssetByRelativePath,
  godewAssetManifest,
} from "../assets/godewAssetManifest.js";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  preload() {
    for (const asset of godewAssetManifest) {
      switch (asset.type) {
        case "image":
          this.load.image(asset.key, asset.url);
          break;
        case "audio":
          this.load.audio(asset.key, asset.url);
          break;
        case "svg":
          this.load.svg(asset.key, asset.url);
          break;
        case "font":
          // Fonts are available in the build output but not loaded by Phaser Loader.
          break;
      }
    }

    // Backward-compatible aliases used by WorldScene.
    const imageAliases = [
      ["gv-grass", "graphics/tilesets/grass.png"],
      ["gv-path", "graphics/tilesets/path.png"],
      ["gv-walls-floor", "graphics/tilesets/walls_floor_tile.png"],
    ];
    for (const [alias, relativePath] of imageAliases) {
      const asset = getGodewAssetByRelativePath(relativePath);
      if (asset) this.load.image(alias, asset.url);
    }

    const audioAliases = [
      ["gv-step", "audio/step.mp3"],
      ["gv-music", "audio/music.mp3"],
    ];
    for (const [alias, relativePath] of audioAliases) {
      const asset = getGodewAssetByRelativePath(relativePath);
      if (asset) this.load.audio(alias, asset.url);
    }

    // Spritesheets — override the manifest's plain-image load with frame data.
    const spritesheets = [
      ["gv-player-main", "graphics/characters/main/main_basic.png", 48, 48],
      ["gv-npc-woman", "graphics/characters/woman.png", 48, 48],
      ["gv-npc-cat", "graphics/characters/cat.png", 48, 48],
      ["gv-npc-mouse", "graphics/characters/mouse.png", 48, 48],
      ["gv-grass-tiles", "graphics/tilesets/grass.png", 16, 16],
      ["gv-blob", "graphics/characters/blob.png", 48, 48],
    ];
    for (const [alias, relativePath, fw, fh] of spritesheets) {
      const asset = getGodewAssetByRelativePath(relativePath);
      if (asset) {
        this.load.spritesheet(alias, asset.url, {
          frameWidth: fw,
          frameHeight: fh,
        });
      }
    }
  }

  create() {
    this.scene.start("world");
  }
}
