# Archived procedural hand emoji

Nine original procedural clay hand and arm reaction props, archived on 2026-10-25 and
moved out of the live `assets/props/shapes/` set:

thumbs_up, thumbs_down, wave_hand, raised_hand, ok_hand, victory, fist_bump, pray, muscle_arm

They were superseded by the custom Kamiji hand rig, which now provides hand emoji.
The files are kept, not deleted. Each entry in `index.json` carries `"archivedFrom": "shapes"`.
They use only the tintable neutral "Clay" material.

To rebuild them (builders live in `model/props_shapes.py` behind the `ARCHIVED_HANDS` list,
skipped by the default build):

    /Applications/Blender.app/Contents/MacOS/Blender -b -P model/props_shapes.py -- assets/props/_archive/procedural-hands --archived
