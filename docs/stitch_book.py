#!/usr/bin/env python3
"""Stitch all chapter PDFs into the final book."""
import os
from pypdf import PdfReader, PdfWriter

docs_dir = os.path.dirname(os.path.abspath(__file__))

chapters = [
    "ch01.pdf",
    "ch02.pdf",
    "ch03.pdf",
    "ch04.pdf",
    "ch05.pdf",
    "ch06.pdf",
    "ch07.pdf",
    "ch08.pdf",
    "ch09.pdf",
]

writer = PdfWriter()
total_pages = 0

for ch in chapters:
    path = os.path.join(docs_dir, ch)
    if os.path.exists(path):
        reader = PdfReader(path)
        pages = len(reader.pages)
        for page in reader.pages:
            writer.add_page(page)
        total_pages += pages
        print(f"  {ch}: {pages} pages")
    else:
        print(f"  WARNING: {ch} not found, skipping")

output_path = os.path.join(docs_dir, "..", "game-studio-book.pdf")
with open(output_path, "wb") as f:
    writer.write(f)

print(f"\nBook generated: game-studio-book.pdf ({total_pages} pages)")
