extends Control

var resource_texture_scene = preload("res://scenes/ui/resource_texture.tscn")
const TEXTURES = {
	Enum.Item.WOOD: preload("res://graphics/icons/wood.png"),
	Enum.Item.APPLE: preload("res://graphics/icons/apple.png"),
	Enum.Item.FISH: preload("res://graphics/icons/goldfish.png"),
	Enum.Item.CORN: preload("res://graphics/icons/corn.png"),
	Enum.Item.TOMATO: preload("res://graphics/icons/tomato.png"),
	Enum.Item.PUMPKIN: preload("res://graphics/icons/pumpkin.png"),
	Enum.Item.WHEAT: preload("res://graphics/icons/wheat.png")}
	
func _ready() -> void:
	hide()
	for i: Enum.Item in Data.items.keys():
		var resource_texture = resource_texture_scene.instantiate()
		resource_texture.setup(i, TEXTURES[i])
		$HBoxContainer.add_child(resource_texture)


func reveal(auto_hide: bool = true):
	for i in $HBoxContainer.get_children():
		i.update()
	show()
	if auto_hide:
		$HideTimer.start()
