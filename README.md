# 🌍 GDP RAG Playground  

**GDP RAG Playground** is an interactive Retrieval-Augmented Generation (RAG) demo built on **World Bank/OECD GDP data (1960–2020)**. Search by country, year, or query patterns like *“highest GDP 2019”*, *“GDP of Japan in 2005”*, or *“top 5 in 2020”*. The system demonstrates how **keyword search, semantic embeddings, and reciprocal rank fusion (RRF)** can be combined to power modern retrieval pipelines.  

## 🚀 Features  

- **Multiple Retrieval Modes**  
  - 🔍 **Keyword Retrieval** (BM25-style via Lunr.js)  
  - 🧠 **Semantic Retrieval** (sentence-transformers embeddings + cosine similarity)  
  - ⚖️ **Reciprocal Rank Fusion (RRF)** — combines keyword & semantic rankings  

- **RAG Context Block**  
  - Automatically builds a structured block with `title`, `description`, `published`, and `url`.  
  - Context is updated based on the retrieval mode you select in the dropdown.  

- **GDP Answer Computation**  
  - Direct answers for queries like *“GDP of Japan in 2005”* extracted from structured CSV data.  

- **Client-Side Only**  
  - All search, embedding lookup, and ranking happen fully in the browser.  
  - Works offline once data & embeddings are preloaded.  

- **Highlighting & Context Source Label**  
  - Selected retrieval mode is visibly highlighted.  
  - RAG context clearly shows which retrieval strategy it’s based on.  

## 🛠 Tech Stack  

- **Frontend**: HTML, CSS, JavaScript (no build required, deployable as static site)  
- **Search**:  
  - Keyword: Lunr.js  
  - Semantic: Precomputed embeddings (`sentence-transformers`, MiniLM)  
  - Fusion: Reciprocal Rank Fusion scoring  
- **Data**: World Bank / OECD GDP dataset (1960–2020), CSV format  
- **Deployment**: Vercel (static hosting)  

---

## 📸 Screenshots  

### Main Playground Interface  
![Main Playground](screenshots/demo1.png)  
*Search interface with query input, retrieval mode dropdown, and Top-K slider.*  

### Example Query: "GDP of Japan in 2005"  
![GDP Query Example](screenshots/demo2.png)  
*Shows direct GDP answer, keyword results, semantic results, and fused ranking.*  

### Highlighted Retrieval Mode & Context Block  
![Context Block](screenshots/demo3.png)  
*Dropdown selection highlights the active retrieval method and updates the RAG context block.*  

## 📦 Usage  

1. Clone or download the repo.  
2. Place your dataset as `public/data.csv` (already provided with GDP 1960–2020).  
3. Generate embeddings (optional, one-time):  
   ```bash
   python3 gen_embeddings.py
   ```
4. Serve locally:
   ```bash
   python3 -m http.server 3000
   ```
5. Open http://localhost:3000 to interact.

## 💡 Example Queries
  -	GDP of Japan in 2005 → Computed: $4.83T
	-	Highest GDP 2019 → USA
	-	Top 5 countries by GDP in 2020
	-	GDP of India in 1980

## 🔎 Retrieval Examples
  - **Keyword Retrieval:** Focuses on exact matches (“Japan GDP 2005”).
  - **Semantic Retrieval:** Understands context (“Japan economy 2005 output”).
  - **RF:** Combines both to balance precision & recall.

## 📊 About the Data
  - **Source:** World Bank national accounts data; OECD National Accounts data files.
  -	**GDP at purchaser’s prices:** Value of goods & services produced domestically plus taxes, minus subsidies.
	-	Data in current US dollars.
	-	**Period:** 1960–2020, annual.

## ❓ Why You Might See Slightly Different Results
  - Keyword relies on exact string overlap → may miss semantically relevant matches.
  -	Semantic uses embeddings → may include related but not exact entries.
	-	RRF balances both to give robust results.



