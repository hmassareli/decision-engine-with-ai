extends Node2D

@onready var y_range = $Control/NinePatchRect.custom_minimum_size.y - 10
var velocity: float
var fish_velocity: float
var progress := 30.0
var sprite_size: Vector2

func _ready() -> void:
	hide()
	sprite_size = $BarSprite.get_rect().size


func _process(delta: float) -> void:
	if visible:
		# bar 
		velocity += 20 * delta
		$BarSprite.position.y += velocity * delta
		var half_bar_height = sprite_size.y / 2 - 2
		$BarSprite.position.y = clamp($BarSprite.position.y, -y_range / 2.0 + half_bar_height, y_range / 2.0 - half_bar_height)
		
		# fish
		$FishSprite.position.y += fish_velocity * delta
		$FishSprite.position.y = clamp($FishSprite.position.y, -y_range / 2.0, y_range / 2.0)
		
		# position compare 
		var top_point = $BarSprite.position.y - sprite_size.y / 2
		var bottom_point = $BarSprite.position.y + sprite_size.y / 2
		if $FishSprite.position.y >= top_point and $FishSprite.position.y <= bottom_point:
			progress += 10 * delta
		else:
			progress -= 10 * delta
		$Control/TextureProgressBar.value = progress

func reveal():
	show()
	$FishSprite.position.y = randf_range(-y_range / 2.0, y_range / 2.0)
	fish_velocity = randf_range(-20,20)


func action():
	velocity = -25


func _on_fish_update_timer_timeout() -> void:
	fish_velocity = randf_range(-20,20)
	$FishUpdateTimer.wait_time = randf_range(1,3)


func _on_texture_progress_bar_value_changed(value: float) -> void:
	if value <= 0 or value >= 100:
		hide()
		Data.change_item(Enum.Item.FISH, 1 if value >= 100 else 0)
		get_parent().stop_fishing()
