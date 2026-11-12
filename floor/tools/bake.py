"""Bake lighting into textures in Blender, for the models that come later.

Run headless from the floor/ folder:

    blender -b scene.blend -P tools/bake.py -- --out baked --size 2048

What it does, in order: makes sure every mesh has a second UV map called
"bake" with a non overlapping unwrap, adds an image texture node to every
material pointed at a fresh image, bakes the combined pass with Cycles, saves
one image per object into the output folder, and writes scene_baked.glb with
those images wired into emission so three.js shows the bake with no lights at
all.

The point of baking is the stuff real time lighting cannot do cheaply: soft
shadows under a hundred chairs, bounce off a red carpet onto a white ceiling,
and the slow falloff down a column. Keep the real time lights for anything
that moves.
"""
import bpy, sys, os, argparse

def args_after_dashes():
    argv = sys.argv
    return argv[argv.index('--') + 1:] if '--' in argv else []

ap = argparse.ArgumentParser()
ap.add_argument('--out', default='baked')
ap.add_argument('--size', type=int, default=2048)
ap.add_argument('--samples', type=int, default=256)
ap.add_argument('--denoise', action='store_true', default=True)
opt = ap.parse_args(args_after_dashes())

out_dir = os.path.abspath(opt.out)
os.makedirs(out_dir, exist_ok=True)

scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = opt.samples
scene.cycles.use_denoising = opt.denoise
scene.render.bake.use_pass_direct = True
scene.render.bake.use_pass_indirect = True
scene.render.bake.margin = 8

meshes = [o for o in scene.objects if o.type == 'MESH']
print(f'baking {len(meshes)} meshes at {opt.size}px')

for ob in meshes:
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob

    # a second UV channel, laid out so nothing overlaps
    if 'bake' not in ob.data.uv_layers:
        ob.data.uv_layers.new(name='bake')
    ob.data.uv_layers.active = ob.data.uv_layers['bake']
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.02)
    bpy.ops.object.mode_set(mode='OBJECT')

    img = bpy.data.images.new(f'{ob.name}_bake', opt.size, opt.size, float_buffer=False)
    for slot in ob.material_slots:
        mat = slot.material
        if not mat or not mat.use_nodes:
            continue
        node = mat.node_tree.nodes.new('ShaderNodeTexImage')
        node.image = img
        node.select = True
        mat.node_tree.nodes.active = node

    bpy.ops.object.bake(type='COMBINED', use_clear=True, uv_layer='bake')
    path = os.path.join(out_dir, f'{ob.name}.png')
    img.filepath_raw = path
    img.file_format = 'PNG'
    img.save()
    print('  ->', path)

# rebuild every material as an unlit emission of its bake, which is what the
# page should load: no lights, no shadow maps, just the picture
for ob in meshes:
    img = bpy.data.images.get(f'{ob.name}_bake')
    if not img:
        continue
    mat = bpy.data.materials.new(f'{ob.name}_baked')
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = img
    uv = nt.nodes.new('ShaderNodeUVMap'); uv.uv_map = 'bake'
    emit = nt.nodes.new('ShaderNodeEmission')
    outn = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(uv.outputs['UV'], tex.inputs['Vector'])
    nt.links.new(tex.outputs['Color'], emit.inputs['Color'])
    nt.links.new(emit.outputs['Emission'], outn.inputs['Surface'])
    ob.data.materials.clear()
    ob.data.materials.append(mat)

glb = os.path.join(out_dir, 'scene_baked.glb')
bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', export_apply=True)
print('wrote', glb)
