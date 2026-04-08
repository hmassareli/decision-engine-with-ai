extends Machine

signal shoot_projectile(start_pos: Vector2, dir: Vector2)
@export var max_range := 150

func setup(pos: Vector2i, level: Node2D, parent: Node2D):
	super.setup(pos, level, parent)
	connect("shoot_projectile", level.create_projectile)


func _on_timer_timeout() -> void:
	var blobs = get_tree().get_nodes_in_group("Blobs")
	if blobs:
		var nearest_blob = get_nearest_blob(blobs)
		if nearest_blob.position.distance_to(position) < max_range:
			shoot_projectile.emit(position, (nearest_blob.position - position).normalized())


func get_nearest_blob(blobs: Array) -> CharacterBody2D:
	var nearest = blobs[0]
	for blob in blobs:
		if blob.position.distance_to(position) <= nearest.position.distance_to(position):
			nearest = blob
	return nearest
