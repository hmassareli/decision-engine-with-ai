export class HudOverlay {
  constructor(scene) {
    this.scene = scene;
    this.text = scene.add
      .text(12, 12, "", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#f3e7d3",
        backgroundColor: "rgba(0,0,0,0.45)",
        padding: { x: 8, y: 6 },
      })
      .setScrollFactor(0)
      .setDepth(1000);
  }

  render(snapshot, nearestNpcLabel) {
    const lines = [
      `Day ${snapshot.world.day} - ${snapshot.world.time}`,
      `Gold: ${snapshot.player.gold} | HP: ${snapshot.player.health}`,
      `Friendship: ${snapshot.player.friendship} | Trust: ${snapshot.player.trust}`,
      `Reputation: ${snapshot.world.reputation} (${snapshot.world.reputationLabel})`,
    ];

    if (nearestNpcLabel) {
      lines.push(`>> [E] Talk to ${nearestNpcLabel}`);
    }

    this.text.setText(lines);
  }
}
