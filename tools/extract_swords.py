#!/usr/bin/env python3
import os
import struct
import zlib
from collections import deque


PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def read_png(path):
    with open(path, "rb") as file:
        data = file.read()

    if not data.startswith(PNG_SIGNATURE):
        raise ValueError("Not a PNG file")

    offset = len(PNG_SIGNATURE)
    width = height = color_type = bit_depth = None
    idat = bytearray()

    while offset < len(data):
        length = struct.unpack(">I", data[offset : offset + 4])[0]
        chunk_type = data[offset + 4 : offset + 8]
        chunk_data = data[offset + 8 : offset + 8 + length]
        offset += 12 + length

        if chunk_type == b"IHDR":
            width, height, bit_depth, color_type, _, _, _ = struct.unpack(">IIBBBBB", chunk_data)
        elif chunk_type == b"IDAT":
            idat.extend(chunk_data)
        elif chunk_type == b"IEND":
            break

    if bit_depth != 8 or color_type not in (2, 6):
        raise ValueError("Only 8-bit RGB/RGBA PNG files are supported")

    channels = 4 if color_type == 6 else 3
    raw = zlib.decompress(bytes(idat))
    stride = width * channels
    rows = []
    pos = 0
    prev = [0] * stride

    for _ in range(height):
        filter_type = raw[pos]
        pos += 1
        scanline = list(raw[pos : pos + stride])
        pos += stride
        recon = [0] * stride

        for i, value in enumerate(scanline):
            left = recon[i - channels] if i >= channels else 0
            up = prev[i]
            up_left = prev[i - channels] if i >= channels else 0

            if filter_type == 0:
                recon[i] = value
            elif filter_type == 1:
                recon[i] = (value + left) & 255
            elif filter_type == 2:
                recon[i] = (value + up) & 255
            elif filter_type == 3:
                recon[i] = (value + ((left + up) // 2)) & 255
            elif filter_type == 4:
                p = left + up - up_left
                pa = abs(p - left)
                pb = abs(p - up)
                pc = abs(p - up_left)
                predictor = left if pa <= pb and pa <= pc else up if pb <= pc else up_left
                recon[i] = (value + predictor) & 255
            else:
                raise ValueError("Unsupported PNG filter")

        rows.append(recon)
        prev = recon

    pixels = []
    for row in rows:
        pixel_row = []
        for x in range(width):
            base = x * channels
            if channels == 4:
                pixel_row.append(row[base : base + 4])
            else:
                pixel_row.append(row[base : base + 3] + [255])
        pixels.append(pixel_row)

    return width, height, pixels


def write_png(path, width, height, pixels):
    raw = bytearray()
    for y in range(height):
        raw.append(0)
        for x in range(width):
            raw.extend(bytes(pixels[y][x]))

    def chunk(name, payload):
        return (
            struct.pack(">I", len(payload))
            + name
            + payload
            + struct.pack(">I", zlib.crc32(name + payload) & 0xFFFFFFFF)
        )

    png = bytearray(PNG_SIGNATURE)
    png.extend(chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)))
    png.extend(chunk(b"IDAT", zlib.compress(bytes(raw), 9)))
    png.extend(chunk(b"IEND", b""))

    with open(path, "wb") as file:
        file.write(png)


def is_subject(pixel, x, y, width, height):
    r, g, b, _ = pixel
    max_c = max(r, g, b)
    min_c = min(r, g, b)
    chroma = max_c - min_c
    bright = (r + g + b) / 3

    # Drop the numeric labels at the bottom of each PDF cell.
    if y > height * 0.89:
        return False

    # Drop cell grid lines.
    if x < 3 or y < 3 or x > width - 4 or y > height - 4:
        return False

    # Keep metal highlights, blue magic, gold trim, and dark handle pixels.
    if bright > 70 and chroma > 12:
        return True
    if bright > 105:
        return True
    if b > 80 and b > r * 1.12:
        return True
    if r > 95 and g > 70 and b < 80:
        return True
    return False


def largest_center_component(mask):
    height = len(mask)
    width = len(mask[0])
    seen = [[False] * width for _ in range(height)]
    components = []

    for y in range(height):
        for x in range(width):
            if seen[y][x] or not mask[y][x]:
                continue

            queue = deque([(x, y)])
            seen[y][x] = True
            points = []

            while queue:
                px, py = queue.popleft()
                points.append((px, py))
                for nx, ny in ((px + 1, py), (px - 1, py), (px, py + 1), (px, py - 1)):
                    if 0 <= nx < width and 0 <= ny < height and not seen[ny][nx] and mask[ny][nx]:
                        seen[ny][nx] = True
                        queue.append((nx, ny))

            if len(points) > 35:
                xs = [p[0] for p in points]
                ys = [p[1] for p in points]
                center_x = (min(xs) + max(xs)) / 2
                center_bias = 1 - min(0.75, abs(center_x - width / 2) / (width / 2))
                score = len(points) * (0.55 + center_bias)
                components.append((score, points))

    if not components:
        return mask

    components.sort(reverse=True, key=lambda item: item[0])
    keep = [[False] * width for _ in range(height)]
    for _, points in components[:5]:
        for x, y in points:
            keep[y][x] = True
    return keep


def grow_mask(mask, radius=2):
    height = len(mask)
    width = len(mask[0])
    grown = [[False] * width for _ in range(height)]

    for y in range(height):
        for x in range(width):
            if not mask[y][x]:
                continue
            for dy in range(-radius, radius + 1):
                for dx in range(-radius, radius + 1):
                    nx = x + dx
                    ny = y + dy
                    if 0 <= nx < width and 0 <= ny < height and dx * dx + dy * dy <= radius * radius:
                        grown[ny][nx] = True
    return grown


def trim_transparent(pixels, padding=16):
    height = len(pixels)
    width = len(pixels[0])
    xs = []
    ys = []

    for y in range(height):
        for x in range(width):
            if pixels[y][x][3] > 0:
                xs.append(x)
                ys.append(y)

    if not xs:
        return pixels

    left = max(0, min(xs) - padding)
    right = min(width - 1, max(xs) + padding)
    top = max(0, min(ys) - padding)
    bottom = min(height - 1, max(ys) + padding)

    return [row[left : right + 1] for row in pixels[top : bottom + 1]]


def extract_swords(source, output_dir):
    width, height, pixels = read_png(source)
    columns = 4
    rows = 5
    os.makedirs(output_dir, exist_ok=True)

    for index in range(20):
        column = index % columns
        row = index // columns
        left = round(column * width / columns)
        right = round((column + 1) * width / columns)
        top = round(row * height / rows)
        bottom = round((row + 1) * height / rows)

        cell = [source_row[left:right] for source_row in pixels[top:bottom]]
        cell_height = len(cell)
        cell_width = len(cell[0])

        mask = [
            [is_subject(cell[y][x], x, y, cell_width, cell_height) for x in range(cell_width)]
            for y in range(cell_height)
        ]
        mask = largest_center_component(mask)
        mask = grow_mask(mask, 1)

        output = []
        for y in range(cell_height):
            out_row = []
            for x in range(cell_width):
                r, g, b, _ = cell[y][x]
                alpha = 255 if mask[y][x] else 0
                out_row.append([r, g, b, alpha])
            output.append(out_row)

        output = trim_transparent(output)
        out_height = len(output)
        out_width = len(output[0])
        out_path = os.path.join(output_dir, f"sword-{index + 1:02d}.png")
        write_png(out_path, out_width, out_height, output)
        print(out_path)


if __name__ == "__main__":
    extract_swords("assets/swords/sword-evolution-1-20.png", "assets/swords/cutouts")
