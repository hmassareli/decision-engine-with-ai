extends PanelContainer

var res: PlantResource

func setup(new_res: PlantResource):
	res = new_res
	$HBoxContainer/VBoxContainer/NameLabel.text = res.name
	$HBoxContainer/IconTexture.texture = res.icon_texture
	
	# progress bars 
	$HBoxContainer/VBoxContainer/GrowthBar.max_value = res.h_frames
	$HBoxContainer/VBoxContainer/DeathBar.max_value = res.death_max
	update()
	res.connect("changed", update)


func update():
	$HBoxContainer/VBoxContainer/GrowthBar.value = res.age
	$HBoxContainer/VBoxContainer/DeathBar.value = res.death_count
	if res.death_count >= res.death_max:
		queue_free()
