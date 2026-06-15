#!/usr/bin/env python3
import os

from extract_swords import read_png, write_png


def trim_cell(pixels, padding=6, bottom_ratio=0.82):
    height = len(pixels)
    width = len(pixels[0])
    left = padding
    right = width - padding
    top = padding
    bottom = int(height * bottom_ratio)
    return [row[left:right] for row in pixels[top:bottom]]


def extract_monsters(source, output_dir, bottom_ratio=0.82):
    width, height, pixels = read_png(source)
    columns = 5
    rows = 2
    os.makedirs(output_dir, exist_ok=True)

    for index in range(10):
        column = index % columns
        row = index // columns
        left = round(column * width / columns)
        right = round((column + 1) * width / columns)
        top = round(row * height / rows)
        bottom = round((row + 1) * height / rows)
        cell = [source_row[left:right] for source_row in pixels[top:bottom]]
        output = trim_cell(cell, bottom_ratio=bottom_ratio)

        out_height = len(output)
        out_width = len(output[0])
        out_path = os.path.join(output_dir, f"monster-{index + 1:02d}.png")
        write_png(out_path, out_width, out_height, output)
        print(out_path)


if __name__ == "__main__":
    extract_monsters("assets/monsters/generated-monster-sheet.png", "assets/monsters", bottom_ratio=1)
