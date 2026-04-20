"""
Clean and enhance candy images for Sugar Rush 1000 slot game.

For each candy image:
1. Remove colored backgrounds (replace with transparency)
2. Auto-crop to the candy content with padding
3. Resize to a uniform 256x256 with high-quality resampling
4. Enhance sharpness and contrast for a premium glossy look
5. Save as PNG with transparency
"""

from PIL import Image, ImageFilter, ImageEnhance, ImageOps
import os
import sys

CANDY_DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'images', 'candies')
BACKUP_DIR = os.path.join(CANDY_DIR, 'originals_backup')
OUTPUT_SIZE = 256  # Uniform square output

# Background colors to remove for each candy (sampled from corners)
# We'll use a smart approach: sample corner pixels and flood-fill remove them
def get_dominant_bg_color(img):
    """Sample corner pixels to determine background color."""
    w, h = img.size
    corners = [
        img.getpixel((2, 2)),
        img.getpixel((w - 3, 2)),
        img.getpixel((2, h - 3)),
        img.getpixel((w - 3, h - 3)),
    ]
    # Average the corner colors (use RGB only)
    r = sum(c[0] for c in corners) // 4
    g = sum(c[1] for c in corners) // 4
    b = sum(c[2] for c in corners) // 4
    return (r, g, b)


def color_distance(c1, c2):
    """Euclidean distance between two RGB tuples."""
    return ((c1[0] - c2[0]) ** 2 + (c1[1] - c2[1]) ** 2 + (c1[2] - c2[2]) ** 2) ** 0.5


def remove_background(img, tolerance=60):
    """Remove background by making pixels similar to corner color transparent."""
    img = img.convert('RGBA')
    bg_color = get_dominant_bg_color(img)
    print(f"    Detected background color: RGB{bg_color}")

    pixels = img.load()
    w, h = img.size

    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            dist = color_distance((r, g, b), bg_color)
            if dist < tolerance:
                pixels[x, y] = (r, g, b, 0)  # Fully transparent
            elif dist < tolerance + 30:
                # Semi-transparent edge for anti-aliasing
                alpha_ratio = (dist - tolerance) / 30.0
                new_alpha = int(a * alpha_ratio)
                pixels[x, y] = (r, g, b, new_alpha)

    return img


def auto_crop_with_padding(img, padding=10):
    """Crop to non-transparent content with padding."""
    bbox = img.getbbox()
    if bbox:
        left, upper, right, lower = bbox
        left = max(0, left - padding)
        upper = max(0, upper - padding)
        right = min(img.width, right + padding)
        lower = min(img.height, lower + padding)
        return img.crop((left, upper, right, lower))
    return img


def resize_uniform(img, size=OUTPUT_SIZE):
    """Resize to uniform square, keeping aspect ratio, centered on transparent background."""
    # Calculate new size maintaining aspect ratio
    w, h = img.size
    ratio = min(size / w, size / h) * 0.85  # 85% of the canvas for padding
    new_w = int(w * ratio)
    new_h = int(h * ratio)

    # High-quality resize
    resized = img.resize((new_w, new_h), Image.LANCZOS)

    # Center on transparent canvas
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    offset_x = (size - new_w) // 2
    offset_y = (size - new_h) // 2
    canvas.paste(resized, (offset_x, offset_y), resized)

    return canvas


def enhance_image(img):
    """Enhance sharpness, contrast, and color for premium glossy look."""
    # Sharpen
    enhancer = ImageEnhance.Sharpness(img)
    img = enhancer.enhance(1.4)

    # Boost color saturation slightly
    enhancer = ImageEnhance.Color(img)
    img = enhancer.enhance(1.15)

    # Slight contrast boost
    enhancer = ImageEnhance.Contrast(img)
    img = enhancer.enhance(1.1)

    # Brightness touch-up
    enhancer = ImageEnhance.Brightness(img)
    img = enhancer.enhance(1.05)

    return img


def process_candy(filepath, filename):
    """Full pipeline for one candy image."""
    print(f"\n  Processing: {filename}")

    img = Image.open(filepath)
    original_size = img.size
    print(f"    Original size: {original_size[0]}x{original_size[1]}")

    # Step 1: Remove background
    img = remove_background(img)

    # Step 2: Auto crop
    img = auto_crop_with_padding(img, padding=8)
    print(f"    After crop: {img.size[0]}x{img.size[1]}")

    # Step 3: Enhance
    img = enhance_image(img)

    # Step 4: Resize to uniform size
    img = resize_uniform(img, OUTPUT_SIZE)
    print(f"    Final size: {img.size[0]}x{img.size[1]}")

    return img


def main():
    print("=" * 60)
    print("  CANDY IMAGE CLEANUP & ENHANCEMENT")
    print("=" * 60)

    candy_dir = os.path.abspath(CANDY_DIR)
    backup_dir = os.path.abspath(BACKUP_DIR)

    # Create backup directory
    os.makedirs(backup_dir, exist_ok=True)

    candy_files = [
        'candy_0.png', 'candy_1.png', 'candy_2.png',
        'candy_3.png', 'candy_4.png', 'candy_5.png',
        'candy_6.png', 'scatter.png'
    ]

    for filename in candy_files:
        filepath = os.path.join(candy_dir, filename)
        if not os.path.exists(filepath):
            print(f"\n  SKIP: {filename} not found")
            continue

        # Backup original
        backup_path = os.path.join(backup_dir, filename)
        if not os.path.exists(backup_path):
            img_backup = Image.open(filepath)
            img_backup.save(backup_path)
            print(f"  Backed up: {filename}")

        # Process
        cleaned = process_candy(filepath, filename)

        # Save
        cleaned.save(filepath, 'PNG', optimize=True)
        final_size = os.path.getsize(filepath)
        print(f"    Saved: {filepath} ({final_size:,} bytes)")

    print("\n" + "=" * 60)
    print("  DONE! All candies cleaned and enhanced.")
    print("=" * 60)


if __name__ == '__main__':
    main()
