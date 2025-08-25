# gen_embeddings.py
import csv, json, math
from sentence_transformers import SentenceTransformer

CSV_PATH = "public/data.csv"
OUT_PATH = "public/embeddings.json"

model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

rows = []
with open(CSV_PATH, newline="", encoding="utf-8") as f:
  reader = csv.DictReader(f)
  years = [h for h in reader.fieldnames if h.isdigit()]
  for r in reader:
    name = r.get("Country Name","").strip()
    code = r.get("Country Code","").strip()

    # sample a few years to keep text short
    picks = [y for y in ("1960","1980","2000","2010","2020") if y in years]
    nums = []
    for y in picks:
      v = r.get(y,"")
      try:
        nums.append(float(v))
      except:
        nums.append(float("nan"))
    parts = [f"{y}:{('NA' if math.isnan(v) else int(v))}" for y,v in zip(picks, nums)]
    text = f"{name} ({code}) GDP " + ", ".join(parts)
    rows.append(text)

emb = model.encode(rows, normalize_embeddings=True).tolist()
with open(OUT_PATH,"w",encoding="utf-8") as f:
  json.dump(emb, f)
print(f"Saved {len(emb)} embeddings to {OUT_PATH}")
