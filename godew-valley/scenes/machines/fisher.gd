extends Machine

const ANIMATIONS = {
	Vector2i.DOWN: 'down',
	Vector2i.LEFT: 'left',
	Vector2i.RIGHT: 'right',
	Vector2i.UP: 'up'}
var direction := Vector2i.DOWN

func setup(pos: Vector2i, level: Node2D, parent: Node2D):
	var grass_layer = level.get_node("Layers/GrassLayer") as TileMapLayer
	var adjusted_coord = pos / Data.TILE_SIZE
	adjusted_coord.x += -1 if pos.x < 0 else 0
	adjusted_coord.y += -1 if pos.y < 0 else 0
	var tile_data = grass_layer.get_cell_tile_data(adjusted_coord) as TileData
	if tile_data.get_custom_data('coast'):
		direction = tile_data.get_custom_data('coast')
		super.setup(pos, level, parent)


func _ready() -> void:
	start_fishing()


func _process(_delta: float) -> void:
	var progress = (1 - ($Timer.time_left / $Timer.wait_time)) * 100
	$Control/TextureProgressBar.value = progress


func _on_timer_timeout() -> void:
	#Data.change_item(Enum.Item.FISH)
	start_fishing()


func start_fishing():
	$AnimatedSprite2D.play(ANIMATIONS[direction])
	await $AnimatedSprite2D.animation_finished
	$AnimatedSprite2D.play(ANIMATIONS[direction]+"_idle")
	$Timer.start()
	
