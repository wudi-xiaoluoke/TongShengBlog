"""把白底变透明 + 缩放像素图。"""
import sys
from PIL import Image

def whiten_to_alpha(img, threshold=240):
    """把接近纯白的像素变透明。"""
    img = img.convert("RGBA")
    data = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = data[x, y]
            if r >= threshold and g >= threshold and b >= threshold:
                data[x, y] = (255, 255, 255, 0)
    return img

def process(src, dst, target, crop_right_px=0, crop_bottom_px=0, whiten=False):
    img = Image.open(src)
    if whiten:
        img = whiten_to_alpha(img)
    w, h = img.size
    if crop_right_px or crop_bottom_px:
        img = img.crop((0, 0, w - crop_right_px, h - crop_bottom_px))
    if img.size != target:
        img = img.resize(target, Image.NEAREST)
    img.save(dst, "PNG", optimize=True)
    print(f"processed {src} -> {dst} {img.size} mode={img.mode}")

if __name__ == "__main__":
    src, dst = sys.argv[1], sys.argv[2]
    target = (int(sys.argv[3]), int(sys.argv[4]))
    crop_right = int(sys.argv[5]) if len(sys.argv) > 5 else 0
    crop_bottom = int(sys.argv[6]) if len(sys.argv) > 6 else 0
    whiten = (len(sys.argv) > 7 and sys.argv[7] == "whiten")
    process(src, dst, target, crop_right, crop_bottom, whiten)
