extends TextureRect

var item_type: Enum.Item

func setup(new_item_type: Enum.Item, new_texture: Texture2D):
	item_type = new_item_type
	texture = new_texture
	update()

func update():
	$Label.text = str(Data.items[item_type])
