"""
Icon generator for OpenWebTTS browser extension
Converts SVG icons to PNG format
"""

from PIL import Image, ImageDraw, ImageFont
import os

def create_icon(size, output_path):
    """Create a simple icon with gradient background and speaker emoji"""
    
    # Create image with gradient
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Draw gradient background (purple gradient)
    for y in range(size):
        # Interpolate between two colors
        ratio = y / size
        r = int(102 + (118 - 102) * ratio)
        g = int(126 + (75 - 126) * ratio)
        b = int(234 + (162 - 234) * ratio)
        draw.rectangle([(0, y), (size, y + 1)], fill=(r, g, b, 255))
    
    # Add rounded corners
    corner_radius = max(3, size // 8)
    mask = Image.new('L', (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle([(0, 0), (size, size)], corner_radius, fill=255)
    
    # Apply mask
    img.putalpha(mask)
    
    # Add speaker icon (simple geometric shape)
    # Draw speaker cone
    speaker_size = size // 2
    left = size // 4
    top = size // 4
    
    # Speaker body (rectangle)
    draw.rectangle(
        [(left, top + speaker_size // 3), 
         (left + speaker_size // 3, top + 2 * speaker_size // 3)],
        fill=(255, 255, 255, 255)
    )
    
    # Speaker cone (polygon)
    points = [
        (left + speaker_size // 3, top + speaker_size // 4),
        (left + 2 * speaker_size // 3, top),
        (left + 2 * speaker_size // 3, top + speaker_size),
        (left + speaker_size // 3, top + 3 * speaker_size // 4)
    ]
    draw.polygon(points, fill=(255, 255, 255, 255))
    
    # Sound waves
    if size >= 48:
        wave_start_x = left + 2 * speaker_size // 3 + 5
        mid_y = top + speaker_size // 2
        
        # Small wave
        draw.arc(
            [(wave_start_x, mid_y - 8), (wave_start_x + 16, mid_y + 8)],
            -30, 30, fill=(255, 255, 255, 200), width=2
        )
        
        # Medium wave
        if size >= 128:
            draw.arc(
                [(wave_start_x + 5, mid_y - 14), (wave_start_x + 26, mid_y + 14)],
                -30, 30, fill=(255, 255, 255, 150), width=2
            )
    
    # Save
    img.save(output_path, 'PNG')
    print(f"✅ Created {output_path} ({size}x{size})")

def main():
    """Generate all icon sizes"""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    icons_dir = os.path.join(script_dir, 'icons')
    
    # Create icons directory if it doesn't exist
    os.makedirs(icons_dir, exist_ok=True)
    
    # Generate icons
    sizes = [16, 48, 128]
    
    for size in sizes:
        output_path = os.path.join(icons_dir, f'icon{size}.png')
        create_icon(size, output_path)
    
    print("\n✨ All icons generated successfully!")
    print("📁 Location: browser-extension/icons/")

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f"❌ Error generating icons: {e}")
        print("\n💡 If PIL is not installed, run: pip install pillow")
        print("Or use the provided SVG icons directly - modern browsers support them!")
