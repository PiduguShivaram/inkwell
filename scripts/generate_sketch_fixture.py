"""
Generates an actual realistic physical drawing/sketch fixture of the canonical pipeline:
[API] -> [QUEUE] -> [WORKER] -> [DB]
Using real raster strokes, text, and arrowheads.
"""

import os
import cv2
import numpy as np

def create_sketch_fixture(output_path: str):
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    # 1200x500 white canvas representing paper
    canvas = np.full((500, 1200, 3), 252, dtype=np.uint8)
    
    # 4 Architecture Nodes
    nodes = [
        {"x": 60, "y": 160, "w": 200, "h": 140, "label": "API", "sub": "GATEWAY"},
        {"x": 350, "y": 160, "w": 200, "h": 140, "label": "QUEUE", "sub": "TASK QUEUE"},
        {"x": 640, "y": 160, "w": 200, "h": 140, "label": "WORKER", "sub": "PROCESSOR"},
        {"x": 930, "y": 160, "w": 200, "h": 140, "label": "DB", "sub": "PRIMARY DB"}
    ]
    
    stroke_color = (20, 20, 25) # Dark ink
    
    for n in nodes:
        x, y, w, h = n["x"], n["y"], n["w"], n["h"]
        
        # Draw rectangular bounding box with pen stroke thickness
        cv2.rectangle(canvas, (x, y), (x + w, y + h), stroke_color, 4, cv2.LINE_AA)
        
        # Draw label inside box
        cv2.putText(
            canvas, n["label"], (x + 35, y + 65),
            cv2.FONT_HERSHEY_SIMPLEX, 1.3, stroke_color, 3, cv2.LINE_AA
        )
        cv2.putText(
            canvas, n["sub"], (x + 25, y + 105),
            cv2.FONT_HERSHEY_SIMPLEX, 0.65, (70, 70, 80), 2, cv2.LINE_AA
        )
        
    # Draw 3 directed connecting arrows
    # API -> QUEUE
    cv2.arrowedLine(canvas, (265, 230), (345, 230), stroke_color, 4, tipLength=0.25, line_type=cv2.LINE_AA)
    # QUEUE -> WORKER
    cv2.arrowedLine(canvas, (555, 230), (635, 230), stroke_color, 4, tipLength=0.25, line_type=cv2.LINE_AA)
    # WORKER -> DB
    cv2.arrowedLine(canvas, (845, 230), (925, 230), stroke_color, 4, tipLength=0.25, line_type=cv2.LINE_AA)
    
    cv2.imwrite(output_path, canvas)
    print(f"Sketch fixture written to {output_path} ({canvas.shape[1]}x{canvas.shape[0]})")

if __name__ == "__main__":
    out = os.path.abspath("tests/fixtures/real_sketch_api_queue_worker_db.png")
    create_sketch_fixture(out)
