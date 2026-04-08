extends Machine


signal water_plants(coord: Vector2i)

func setup(pos: Vector2i, level: Node2D, parent: Node2D):
	super.setup(pos, level, parent)
	connect("water_plants", level.water_plants)


func _on_timer_timeout() -> void:
	$AnimatedSprite2D.play("action")
	$GPUParticles2D.emitting = true
	await $AnimatedSprite2D.animation_finished
	$AnimatedSprite2D.play("default")
	water_plants.emit(coord)
