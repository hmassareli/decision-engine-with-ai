extends Node2D

var plant_scene = preload("res://scenes/objects/plant.tscn")
var plant_info_scene = preload("res://scenes/ui/plant_info.tscn")
var projectile_scene = preload("res://scenes/machines/projectile.tscn")
var blob_scene = preload("res://scenes/objects/blob.tscn")
var machine_scenes = {
	Enum.Machine.SPRINKLER: preload("res://scenes/machines/sprinkler.tscn"),
	Enum.Machine.SCARECROW: preload("res://scenes/machines/scare_crow.tscn"),
	Enum.Machine.FISHER: preload("res://scenes/machines/fisher.tscn")}
var used_cells: Array[Vector2i]
var raining: bool:
	set(value):
		raining = value
		$Layers/RainFloorParticles.emitting = value
		$Overlay/RainDropsParticles.emitting = value
		$Music/Rain.playing = value
@onready var player = $Objects/Player
@onready var day_transition_material = $Overlay/CanvasLayer/DayTransitionLayer.material
@export var daytime_color: Gradient
@export var rain_color: Color
@export var volume_curve: Curve

const MACHINE_PREVIEW_TEXTURES = {
	Enum.Machine.SPRINKLER: {'texture':preload("res://graphics/icons/sprinkler.png"), 'offset': Vector2i(0,0)},
	Enum.Machine.FISHER: {'texture':preload("res://graphics/icons/fisher.png"), 'offset': Vector2i(0,-4)},
	Enum.Machine.SCARECROW: {'texture':preload("res://graphics/icons/scarecrow.png"), 'offset': Vector2i(0,-4)},
	Enum.Machine.DELETE: {'texture':preload("res://graphics/icons/delete.png"), 'offset': Vector2i(0,0)}}


func _on_player_tool_use(tool: Enum.Tool, pos: Vector2) -> void:
	var grid_coord: Vector2i = Vector2i(int(pos.x / Data.TILE_SIZE),int(pos.y / Data.TILE_SIZE))
	grid_coord.x += -1 if pos.x < 0 else 0
	grid_coord.y += -1 if pos.y < 0 else 0
	var has_soil = grid_coord in $Layers/SoilLayer.get_used_cells()
	match tool:
		Enum.Tool.HOE:
			var cell = $Layers/GrassLayer.get_cell_tile_data(grid_coord) as TileData
			if cell and cell.get_custom_data('farmable'):
				$Layers/SoilLayer.set_cells_terrain_connect([grid_coord], 0, 0)
			if raining:
				$Layers/SoilWaterLayer.set_cell(grid_coord, 0, Vector2i(randi_range(0,2),0))
		Enum.Tool.WATER:
			if has_soil:
				$Layers/SoilWaterLayer.set_cell(grid_coord, 0, Vector2i(randi_range(0,2),0))
		Enum.Tool.FISH:
			if not grid_coord in $Layers/GrassLayer.get_used_cells():
				$Objects/Player.start_fishing()
		Enum.Tool.SEED:
			if has_soil and grid_coord not in used_cells:
				var selected_item = {
					Enum.Seed.TOMATO: Enum.Item.TOMATO,
					Enum.Seed.WHEAT: Enum.Item.WHEAT,
					Enum.Seed.CORN: Enum.Item.CORN,
					Enum.Seed.PUMPKIN: Enum.Item.PUMPKIN,
				}[player.current_seed]
				
				if Data.items[selected_item] > 0:
					#Data.change_item(selected_item, -1)
					var plant_res = PlantResource.new()
					plant_res.setup($Objects/Player.current_seed, selected_item)
					var plant = plant_scene.instantiate()
					plant.setup(grid_coord, $Objects, plant_res, plant_death)
					used_cells.append(grid_coord)
					
					var plant_info = plant_info_scene.instantiate()
					plant_info.setup(plant_res)
					$Overlay/CanvasLayer/PlantInfoContainer.add(plant_info)
				
		Enum.Tool.AXE, Enum.Tool.SWORD:
			for object in get_tree().get_nodes_in_group('Objects'):
				if object.position.distance_to(pos) < 20:
					object.hit(tool)


func _on_player_diagnose() -> void:
	$Overlay/CanvasLayer/PlantInfoContainer.visible = not $Overlay/CanvasLayer/PlantInfoContainer.visible


func _on_player_day_change() -> void:
	day_restart()


func _on_player_build(current_machine: int) -> void:
	if current_machine != Enum.Machine.DELETE:
		var machine = machine_scenes[current_machine].instantiate()
		machine.setup(player.get_machine_coord(), self, $Objects)
	else:
		for machine in get_tree().get_nodes_in_group('Machines'):
			machine.delete(player.get_machine_coord() / 16)


func _on_player_machine_change(current_machine: int) -> void:
	$Overlay/MachinePreviewSprite.texture = MACHINE_PREVIEW_TEXTURES[current_machine]['texture']


func _on_player_close_shop() -> void:
	$Overlay/CanvasLayer/ShopUI.hide()
	player.current_state = Enum.State.DEFAULT


func _ready() -> void:
	Data.forecast_rain = [true, false].pick_random()
	for character in get_tree().get_nodes_in_group('Characters'):
		character.connect('open_shop', open_shop)


func _process(_delta: float) -> void:
	var daytime_point = 1 - ($Timers/DayTimer.time_left / $Timers/DayTimer.wait_time)
	var color = daytime_color.sample(daytime_point).lerp(rain_color, 0.5 if raining else 0.0)
	$Music/BGMusic.volume_db = volume_curve.sample(daytime_point)
	$Overlay/DayTimeColor.color = color
	
	# machine preview 
	$Overlay/MachinePreviewSprite.visible = player.current_state == Enum.State.BUILDING
	$Overlay/MachinePreviewSprite.position = player.get_machine_coord() + MACHINE_PREVIEW_TEXTURES[player.current_machine]['offset']

func day_restart():
	var tween = create_tween()
	tween.tween_property(day_transition_material, "shader_parameter/progress", 1.0, 1.0)
	tween.tween_interval(0.5)
	tween.tween_callback(level_reset)
	tween.tween_property(day_transition_material, "shader_parameter/progress", 0.0, 1.0)


func level_reset():
	for plant in get_tree().get_nodes_in_group('Plants'):
		plant.grow(plant.coord in $Layers/SoilWaterLayer.get_used_cells())
	$Layers/SoilWaterLayer.clear()
	$Overlay/CanvasLayer/PlantInfoContainer.update_all()
	
	$Timers/DayTimer.start()
	for object in get_tree().get_nodes_in_group('Objects'):
		if 'reset' in object:
			object.reset()

	raining = Data.forecast_rain
	Data.forecast_rain = [true, false].pick_random()
	
	if raining:
		for cell in $Layers/SoilLayer.get_used_cells():
			$Layers/SoilWaterLayer.set_cell(cell, 0, Vector2i(randi_range(0,2),0))


func plant_death(coord: Vector2i):
	used_cells.erase(coord)


func create_projectile(start_pos: Vector2, dir: Vector2):
	var projectile = projectile_scene.instantiate()
	projectile.setup(start_pos, dir)
	$Objects.add_child(projectile)


func water_plants(coord: Vector2i):
	const SOIL_DIRECTIONS = [
		Vector2i(-1, -1), Vector2i(0, -1), Vector2i(1, -1),
		Vector2i(-1,  0),Vector2i(1,0), Vector2i(-1,  1), 
		Vector2i(0,  1), Vector2i(1,  1)]
	for dir in SOIL_DIRECTIONS:
		var cell = coord + dir
		if cell in $Layers/SoilLayer.get_used_cells():
			$Layers/SoilWaterLayer.set_cell(cell, 0, Vector2i(randi_range(0,2),0))


func _on_blob_timer_timeout() -> void:
	var plants = get_tree().get_nodes_in_group('Plants')
	if plants:
		var blob = blob_scene.instantiate()
		var pos = $BlobSpawnPositions.get_children().pick_random().position
		blob.setup(pos, plants.pick_random(), $Objects)


func open_shop(shop_type: Enum.Shop):
	$Overlay/CanvasLayer/ShopUI.reveal(shop_type)
	player.current_state = Enum.State.SHOP
