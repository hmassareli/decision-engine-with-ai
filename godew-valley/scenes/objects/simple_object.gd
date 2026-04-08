@tool
extends StaticBody2D

@export_range(0,3,1) var size: int:
	set(value):
		size = value
		$Sprite2D.frame_coords = Vector2i(size, style)
@export_enum('Bush', 'Rock') var style: int:
	set(value):
		style = value
		$Sprite2D.frame_coords = Vector2i(size, style)
@export var random: bool
@export_tool_button('Randomize', "Callable") var randomizer = randomize


func _ready() -> void:
	if random:
		size = randi_range(0, $Sprite2D.hframes - 1)
		style = [0,1].pick_random()
	$Sprite2D.frame_coords = Vector2i(size, style)
	$CollisionShape2D.disabled = size < 2
	z_index = -1 if size < 2 else 0

#
func randomize():
	size = randi_range(0, $Sprite2D.hframes - 1)
	style = [0,1].pick_random()
	$Sprite2D.frame_coords = Vector2i(size, style)
