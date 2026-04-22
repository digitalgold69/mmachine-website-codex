# Adding your Classic Mini 3D model

Drop a file called `mini.glb` into this folder and it will appear on the
catalogue page immediately (just refresh the browser). Until you do, the page
shows a clearly-labelled procedural placeholder so the layout still looks right.

---

## Where to get a Classic Mini GLB

### Sketchfab (recommended, free tier)

1. Go to **sketchfab.com** and search for `classic mini cooper`.
2. On the left sidebar, tick **Downloadable** and pick a licence you like
   (`CC Attribution` is fine for a commercial site — you just need to credit
   the author somewhere). `CC0` needs no attribution.
3. Click into a model you like. On the model page click the **Download 3D
   Model** button (top right).
4. Choose format **glTF (.glb)** — that's the single-file, web-optimised
   version.
5. Save the file, rename it to exactly `mini.glb`, and place it here:
   ```
   C:\Users\UserPC\Downloads\mmachine-website\mmachine\public\models\mini.glb
   ```

### Paid alternatives (higher quality)

- **CGTrader.com** — £15–£50 for a detailed Classic Mini, often with
  interior + engine bay
- **TurboSquid.com** — similar price range, larger catalogue
- **Blender Market** — if you want a file you can further edit in Blender

When buying, check the file format is **GLB** or **glTF** (or the seller
offers a free conversion). Do NOT buy a model that only ships as `.fbx`,
`.obj`, or `.max` — the browser viewer uses glTF only.

### Good things to check before buying

- File size under 20 MB (ideally under 10 MB) — keeps page load fast
- Realistic wheel and headlight geometry
- Car is oriented roughly along the X axis (front pointing +X or -X)
- Car is roughly centred on (0,0,0)
- **Preferred but optional:** individual mesh parts are named (e.g.
  `bonnet`, `door_left`, `boot`, `wing_front_left`). If they are, we can
  wire up per-panel click highlighting later.

The viewer will auto-centre and auto-scale whatever you put in, so don't
worry about exact scale.

---

## Sanity test

After placing `mini.glb` here:

1. Go to your terminal window where `npm run dev` is running.
2. Nothing to do — Next.js hot-reloads automatically.
3. In the browser, refresh the Mini catalogue page.
4. The status badge in the top-left of the 3D box should change from
   `PLACEHOLDER · DROP mini.glb IN /public/models/` to
   `DRAG TO ORBIT · SCROLL TO ZOOM`.
5. Drag with the mouse to orbit. Scroll to zoom. Click the preset view
   buttons on the top-right (3/4 FRONT, SIDE, FRONT, REAR, TOP).
6. Click any section chip below the 3D view — the camera should fly to the
   angle that best shows that section.

## If it breaks

- **Model appears as a tiny dot or giant invisible thing**: probably a
  scale issue in the GLB. The auto-scale should handle most cases but
  extreme outliers may need manual tuning. Send me the model and I'll fix.
- **Model shows up as a black silhouette**: the GLB is missing its
  materials/textures. Re-download from Sketchfab, untick "embed textures"
  once, make sure you downloaded the **auto-converted GLB** (not the raw
  `.zip` source file).
- **Browser console shows `GLTFLoader: Missing DRACOLoader instance`**:
  the model is Draco-compressed. Tell me and I'll wire in the
  DRACOLoader — one extra line in Mini3DViewer.tsx.

## Model attribution

If your Sketchfab model uses `CC Attribution`, add a line to
`app/(site)/about/page.tsx` (or a `Credits` section of the footer)
like:

> Mini 3D model by **<author name>** via Sketchfab, licensed CC-BY 4.0.
