# Real 3D models

Drop `.glb` files in this folder and list them in `models.json`. Each one replaces
the built-in stand-in for its slot as soon as it loads; anything left empty keeps
the built-in object, and a file that fails to load falls back to it too.

```json
{
  "scrap": [
    { "file": "gear.glb" },
    { "file": "crushed-can.glb", "count": 40, "size": 0.9 }
  ],
  "metals": { "file": "scrap-bale.glb" },
  "pcb": { "file": "circuit-board.glb", "rotation": [-90, 0, 0] },
  "wires": { "file": "cable-coil.glb", "size": 6, "offset": [0, -0.5, 0] }
}
```

| Slot | Where it appears | Default size |
| --- | --- | --- |
| `scrap` (a list) | The pieces orbiting in the intro and drifting between chapters | 0.8 |
| `metals` | Centrepiece of the Metal scrap chapter, resting on the plinth | 4.2 |
| `pcb` | Centrepiece of the Circuit boards chapter | 6.4 |
| `wires` | Centrepiece of the Wire & cable chapter | 7 |

Options per model (all optional):

- `size` — longest side, in scene units. Models are centred and scaled to this automatically.
- `rotation` — `[x, y, z]` in degrees, for models that arrive lying down or facing away.
- `offset` — `[x, y, z]` nudge in scene units (centrepieces only).
- `count` — number of copies (scrap only). Left out, it is chosen from the model's detail so the page stays fast.

## What makes a good file

- **Format:** binary glTF (`.glb`) with textures embedded. Draco and Meshopt compression are supported; KTX2 textures are not.
- **Scrap pieces:** under about 5,000 triangles and 1 MB each — they are repeated many times.
- **Centrepieces:** under about 100,000 triangles and 5 MB each; textures 2048 px or smaller.
- **Licence:** only use models whose licence allows commercial use (CC0, CC BY with credit, or a purchased licence), and keep a note of where each came from.

To shrink a model: `npx @gltf-transform/cli optimize in.glb out.glb --texture-size 1024`
