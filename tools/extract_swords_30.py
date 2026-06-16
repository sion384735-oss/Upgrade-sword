#!/usr/bin/env python3
import os
from collections import deque

from extract_swords import read_png, trim_transparent, write_png

UPSCALE = 2


def is_green_screen(pixel):
    r, g, b, _ = pixel
    return g > 70 and g > r * 1.02 and g > b * 1.02 and g - max(r, b) > 12


def build_sword_mask(cell):
    height = len(cell)
    width = len(cell[0])
    background = [[False] * width for _ in range(height)]
    queue = deque()

    def enqueue(x, y):
        if 0 <= x < width and 0 <= y < height and not background[y][x] and is_green_screen(cell[y][x]):
            background[y][x] = True
            queue.append((x, y))

    for x in range(width):
        enqueue(x, 0)
        enqueue(x, height - 1)
    for y in range(height):
        enqueue(0, y)
        enqueue(width - 1, y)

    while queue:
        x, y = queue.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            enqueue(nx, ny)

    mask = [[not background[y][x] for x in range(width)] for y in range(height)]
    return mask


def erode_mask(mask, radius=1):
    height = len(mask)
    width = len(mask[0])
    output = [[False] * width for _ in range(height)]

    for y in range(height):
        for x in range(width):
            keep = True
            for ny in range(max(0, y - radius), min(height, y + radius + 1)):
                for nx in range(max(0, x - radius), min(width, x + radius + 1)):
                    if not mask[ny][nx]:
                        keep = False
                        break
                if not keep:
                    break
            output[y][x] = keep

    return output


def add_transparent_padding(pixels, padding=18):
    width = len(pixels[0])
    transparent_row = [[0, 0, 0, 0] for _ in range(width + padding * 2)]
    output = [[pixel[:] for pixel in transparent_row] for _ in range(padding)]

    for row in pixels:
        output.append(
            [[0, 0, 0, 0] for _ in range(padding)]
            + [pixel[:] for pixel in row]
            + [[0, 0, 0, 0] for _ in range(padding)]
        )

    output.extend([[pixel[:] for pixel in transparent_row] for _ in range(padding)])
    return output


def resize_rgba(pixels, scale=2):
    src_height = len(pixels)
    src_width = len(pixels[0])
    dst_width = src_width * scale
    dst_height = src_height * scale

    def sample(channel, x, y):
        x = 0 if x < 0 else src_width - 1 if x >= src_width else x
        y = 0 if y < 0 else src_height - 1 if y >= src_height else y
        return pixels[y][x][channel]

    output = []
    for dy in range(dst_height):
        sy = (dy + 0.5) / scale - 0.5
        y0 = int(sy)
        y1 = y0 + 1
        wy = sy - y0

        row = []
        for dx in range(dst_width):
            sx = (dx + 0.5) / scale - 0.5
            x0 = int(sx)
            x1 = x0 + 1
            wx = sx - x0

            accum_r = accum_g = accum_b = accum_a = 0.0
            for yy, wy_weight in ((y0, 1 - wy), (y1, wy)):
                for xx, wx_weight in ((x0, 1 - wx), (x1, wx)):
                    weight = wx_weight * wy_weight
                    r, g, b, a = pixels[
                        0 if yy < 0 else src_height - 1 if yy >= src_height else yy
                    ][0 if xx < 0 else src_width - 1 if xx >= src_width else xx]
                    alpha = a / 255.0
                    accum_a += alpha * weight
                    accum_r += (r / 255.0) * alpha * weight
                    accum_g += (g / 255.0) * alpha * weight
                    accum_b += (b / 255.0) * alpha * weight

            if accum_a > 0:
                inv_alpha = 1.0 / accum_a
                r = int(round(max(0, min(1, accum_r * inv_alpha)) * 255))
                g = int(round(max(0, min(1, accum_g * inv_alpha)) * 255))
                b = int(round(max(0, min(1, accum_b * inv_alpha)) * 255))
                a = int(round(max(0, min(1, accum_a)) * 255))
            else:
                r = g = b = a = 0
            row.append([r, g, b, a])
        output.append(row)

    return output


def remove_green_fringe(pixels):
    height = len(pixels)
    width = len(pixels[0])
    output = [[pixel[:] for pixel in row] for row in pixels]

    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[y][x]
            if a == 0:
                continue
            if not (g > r + 8 and g > b + 8 and g > 70):
                continue

            touches_transparent = False
            for ny in range(max(0, y - 2), min(height, y + 3)):
                for nx in range(max(0, x - 2), min(width, x + 3)):
                    if pixels[ny][nx][3] == 0:
                        touches_transparent = True
                        break
                if touches_transparent:
                    break

            if touches_transparent:
                output[y][x] = [0, 0, 0, 0]

    return output


def extract_swords_30(source, output_dir):
    width, height, pixels = read_png(source)
    columns = 5
    rows = 6
    inset = 4
    os.makedirs(output_dir, exist_ok=True)

    for index in range(columns * rows):
        column = index % columns
        row = index // columns
        left = round(column * width / columns) + inset
        right = round((column + 1) * width / columns) - inset
        top = round(row * height / rows) + inset
        bottom = round((row + 1) * height / rows) - inset

        cell = [source_row[left:right] for source_row in pixels[top:bottom]]
        cell_height = len(cell)
        cell_width = len(cell[0])
        mask = erode_mask(build_sword_mask(cell), 1)

        output = []
        for y in range(cell_height):
            out_row = []
            for x in range(cell_width):
                r, g, b, a = cell[y][x]
                if mask[y][x]:
                    out_row.append([r, g, b, a])
                else:
                    out_row.append([0, 0, 0, 0])
            output.append(out_row)
        output = add_transparent_padding(trim_transparent(output, 12), 18)
        output = resize_rgba(output, UPSCALE)
        output = remove_green_fringe(output)

        out_path = os.path.join(output_dir, f"sword-{index + 1:02d}.png")
        write_png(out_path, len(output[0]), len(output), output)
        print(out_path)


if __name__ == "__main__":
    extract_swords_30("assets/swords/sword-evolution-1-30-generated.png", "assets/swords/cutouts")
