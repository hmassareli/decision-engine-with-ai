extends Control

func add(child: PanelContainer):
	$MarginContainer/ScrollContainer/VBoxContainer.add_child(child)


func update_all():
	for plant_info in $MarginContainer/ScrollContainer/VBoxContainer.get_children():
		plant_info.update()
