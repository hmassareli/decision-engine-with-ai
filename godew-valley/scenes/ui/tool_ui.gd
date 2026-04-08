extends Control

const TOOL_TEXTURES = {
	Enum.Tool.AXE: preload("res://graphics/icons/axe.png"),
	Enum.Tool.HOE: preload("res://graphics/icons/hoe.png"),
	Enum.Tool.WATER: preload("res://graphics/icons/water.png"),
	Enum.Tool.SWORD: preload("res://graphics/icons/sword.png"),
	Enum.Tool.FISH: preload("res://graphics/icons/fish.png"),
	Enum.Tool.SEED: preload("res://graphics/icons/wheat.png"),}
const SEED_TEXTURES = {
	Enum.Seed.CORN: preload("res://graphics/icons/corn.png"),
	Enum.Seed.PUMPKIN: preload("res://graphics/icons/pumpkin.png"),
	Enum.Seed.TOMATO: preload("res://graphics/icons/tomato.png"),
	Enum.Seed.WHEAT: preload("res://graphics/icons/wheat.png")}
var tool_texture_scene = preload("res://scenes/ui/tool_ui_texture.tscn")

func _ready() -> void:
	for container in [$ToolContainer, $SeedContainer]:
		container.hide()
	texture_setup(Enum.Tool.values(), TOOL_TEXTURES, $ToolContainer)
	texture_setup(Enum.Seed.values(), SEED_TEXTURES, $SeedContainer)
	

func texture_setup(enum_list: Array, textures: Dictionary, container: HBoxContainer):
	for enum_id in enum_list:
		var tool_texture = tool_texture_scene.instantiate()
		tool_texture.setup(enum_id, textures[enum_id])
		container.add_child(tool_texture)


func reveal(tool: bool):
	$HideTimer.start()
	var current_container = $ToolContainer if tool else $SeedContainer
	var target = get_parent().current_tool if tool else get_parent().current_seed
	for container in [$ToolContainer, $SeedContainer]:
		container.hide()
	current_container.show()
	
	for texture in current_container.get_children():
		texture.highlight(target == texture.tool_enum)


func _on_hide_timer_timeout() -> void:
	for container in [$ToolContainer, $SeedContainer]:
		container.hide()
