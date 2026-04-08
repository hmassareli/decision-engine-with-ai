const rawModules = import.meta.glob(
  "../../assets/godew-valley/**/*.{png,mp3,ogg,wav,ttf,otf,svg}",
  {
    eager: true,
    query: "?url",
    import: "default",
  },
);

function getRelativePath(modulePath) {
  const marker = "/assets/godew-valley/";
  const idx = modulePath.lastIndexOf(marker);
  if (idx >= 0) return modulePath.slice(idx + marker.length);
  return modulePath;
}

function getTypeFromExtension(ext) {
  if (ext === "png") return "image";
  if (["mp3", "ogg", "wav"].includes(ext)) return "audio";
  if (ext === "svg") return "svg";
  if (["ttf", "otf"].includes(ext)) return "font";
  return "unknown";
}

function buildKey(relativePath) {
  const noExt = relativePath.replace(/\.[^/.]+$/, "");
  return `gv-${noExt}`
    .toLowerCase()
    .replace(/[^a-z0-9/\-]/g, "-")
    .replace(/[\/]/g, "-")
    .replace(/-+/g, "-");
}

export const godewAssetManifest = Object.entries(rawModules)
  .map(([modulePath, url]) => {
    const relativePath = getRelativePath(modulePath);
    const ext = relativePath.split(".").pop()?.toLowerCase() || "";

    return {
      key: buildKey(relativePath),
      relativePath,
      url,
      extension: ext,
      type: getTypeFromExtension(ext),
    };
  })
  .sort((a, b) => a.relativePath.localeCompare(b.relativePath));

export const godewAssetMapByPath = Object.fromEntries(
  godewAssetManifest.map((asset) => [asset.relativePath, asset]),
);

export function getGodewAssetByRelativePath(relativePath) {
  return godewAssetMapByPath[relativePath] || null;
}
