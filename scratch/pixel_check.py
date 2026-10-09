from PIL import Image
import numpy as np

img = Image.open('scratch/live_view.png')
arr = np.array(img)
# find pixels that are exactly black or near-black
# Image is (800, 1280, 4)
# Let's inspect rows around y=200
print("Image shape:", arr.shape)

# Let's find columns where pixels around y=250 are dark
row_250 = arr[250, :, :3]
# check which x coordinates have pure black or near black
black_xs = [x for x in range(1280) if np.all(row_250[x] < 20)]
print(f"Row 250 black pixels from x={min(black_xs)} to x={max(black_xs)} (count={len(black_xs)})")

# Let's inspect column 640 (center) from y=0 to y=800
col_640 = arr[:, 640, :3]
for y in range(0, 800, 20):
    print(f"y={y}: rgb={col_640[y]}")
