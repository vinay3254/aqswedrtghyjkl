#!/usr/bin/env python3
"""Filter the 42 candidate papers to ~30 most relevant for MediCluster
(Patient Health Risk Segregation) and re-number them in IEEE format.
"""
import xml.etree.ElementTree as ET
import re
from pathlib import Path

NS = {'a': 'http://www.w3.org/2005/Atom', 'arxiv': 'http://arxiv.org/schemas/atom'}
PAPERS_DIR = Path(r"C:/Users/Admin/Desktop/Patient Health Risk Segregation/docs/ieee_papers")

# Hand-curated selection of arXiv IDs most relevant to the project
# (excludes astrophysics noise, portfolio risk, and tangential knowledge-graph work)
KEEP_IDS = [
    # Core clustering algorithms used in MediCluster
    '2511.17823',  # [3] Novel k-means with two distance measures
    '2006.15666',  # [25] Breathing K-Means
    '1706.02949',  # [32] K+ Means enhancement
    '1304.0725',   # [38] Renovated K-Means
    '2208.04537',  # [19] Automating DBSCAN via Deep RL
    '1406.4751',   # [35] Incremental K-means vs DBSCAN
    '1404.6059',   # [36] Fuzzy vs hard clustering
    'cs/0608049',  # [41] Multidendrograms (hierarchical)
    '1401.5814',   # [37] Random projection hierarchical
    '1806.08245',  # [29] Reductive clustering
    '2410.09491',  # [10] Deep clustering w/ unknown K
    '2401.05502',  # [11] Diversity-aware clustering
    '2605.07130',  # [2]  KNN outlier detection for robust clustering

    # Clustering evaluation / metrics
    '2606.27061',  # [1]  Evaluating clustering with ground truth
    '2207.01294',  # [20] New index based on density estimation

    # Dimensionality reduction for visualization
    '2508.07773',  # [5]  PCA-guided autoencoding
    '2504.17601',  # [8]  Interpretable non-linear dim. reduction
    '1801.09390',  # [30] Nonlinear dim. reduction on graphs

    # Patient risk stratification & disease prediction
    '2511.04971',  # [4]  CVD risk prediction for diabetic patients
    '1812.02852',  # [27] ML explanations for Type 2 diabetes risk
    '2304.02191',  # [15] Predictive models of healthcare costs

    # EHR / clinical data + ML
    '2507.20993',  # [6]  Multimodal EHR treatment policies
    '1811.11400',  # [28] FADL: Federated EHR learning
    '1112.1668',   # [39] Data mining on EHRs
    '2302.04725',  # [17] Lightweight clinical NLP transformers
    '2309.13184',  # [13] Document understanding for healthcare referrals

    # Healthcare ML infrastructure
    '2312.05530',  # [12] Smart healthcare: IoT + ML
    '2303.15563',  # [16] Privacy-preserving ML for healthcare
    '2211.07893',  # [18] Federated learning for healthcare
    '2505.01206',  # [7]  Digital twin in clinical patient care
]
print(f"Selecting {len(KEEP_IDS)} papers")

def fetch_all_entries():
    """Build {arxiv_id_clean: entry} from every XML file in the directory."""
    out = {}
    for p in sorted(PAPERS_DIR.glob('arxiv_*.xml')):
        tree = ET.parse(p)
        for entry in tree.getroot().findall('a:entry', NS):
            raw = entry.find('a:id', NS).text.strip()
            aid = raw.split('/abs/')[-1]
            aid_clean = re.sub(r'v\d+$', '', aid)
            if aid_clean not in out:
                out[aid_clean] = entry
    return out

entries = fetch_all_entries()
print(f"Available: {len(entries)} unique papers in cache")

# Look up each keep-id
selected = []
missing = []
for aid in KEEP_IDS:
    if aid in entries:
        selected.append((aid, entries[aid]))
    else:
        missing.append(aid)
print(f"Found {len(selected)} / {len(KEEP_IDS)}")
if missing:
    print(f"Missing IDs: {missing}")

# Sort by date, newest first
def get_date(e):
    return e.find('a:published', NS).text
selected.sort(key=lambda kv: get_date(kv[1]), reverse=True)

def get_author_names(entry):
    out = []
    for a in entry.findall('a:author', NS):
        ne = a.find('a:name', NS)
        if ne is None or not ne.text:
            continue
        n = ne.text.strip()
        if n:
            out.append(n)
    return out

def format_authors_ieee(names):
    formatted = []
    for name in names:
        parts = name.split()
        if len(parts) == 0:
            continue
        if len(parts) == 1:
            formatted.append(name)
        else:
            initials = ' '.join(p[0] + '.' for p in parts[:-1])
            formatted.append(f"{initials} {parts[-1]}")
    if not formatted:
        return 'Anonymous'
    if len(formatted) == 1:
        return formatted[0]
    if len(formatted) == 2:
        return f"{formatted[0]} and {formatted[1]}"
    return ', '.join(formatted[:-1]) + f", and {formatted[-1]}"

def entry_to_ieee(idx, entry):
    title = entry.find('a:title', NS).text.strip().replace('\n', ' ')
    title = re.sub(r'\s+', ' ', title)
    arxiv_id = entry.find('a:id', NS).text.strip().split('/abs/')[-1]
    arxiv_id_clean = re.sub(r'v\d+$', '', arxiv_id)
    published = entry.find('a:published', NS).text
    year = published[:4]
    month = published[5:7]
    authors = format_authors_ieee(get_author_names(entry))
    months = {'01':'Jan','02':'Feb','03':'Mar','04':'Apr','05':'May','06':'Jun',
              '07':'Jul','08':'Aug','09':'Sep','10':'Oct','11':'Nov','12':'Dec'}
    return (
        f"[{idx}] {authors}, \"{title},\" "
        f"arXiv preprint arXiv:{arxiv_id_clean}, "
        f"{months.get(month,'')} {year}. [Online]. Available: https://arxiv.org/abs/{arxiv_id_clean}"
    )

# Write filtered IEEE bibliography
out = PAPERS_DIR / 'ieee_references.bib.txt'
with open(out, 'w', encoding='utf-8') as f:
    f.write("="*78 + "\n")
    f.write("IEEE-FORMAT REFERENCES — Patient Health Risk Segregation (MediCluster)\n")
    f.write(f"Total papers: {len(selected)}\n")
    f.write("="*78 + "\n\n")
    for i, (aid, entry) in enumerate(selected, 1):
        f.write(entry_to_ieee(i, entry) + "\n\n")

# Grouped sections for the project
def category_of(aid):
    if aid in ('2511.17823','2006.15666','1706.02949','1304.0725','2208.04537',
               '1406.4751','1404.6059','cs/0608049','1401.5814','1806.08245',
               '2410.09491','2401.05502','2605.07130'):
        return 'A. Clustering Algorithms'
    if aid in ('2606.27061','2207.01294'):
        return 'B. Clustering Evaluation & Metrics'
    if aid in ('2508.07773','2504.17601','1801.09390'):
        return 'C. Dimensionality Reduction & Visualization'
    if aid in ('2511.04971','1812.02852','2304.02191'):
        return 'D. Patient Risk Stratification & Disease Prediction'
    if aid in ('2507.20993','1811.11400','1112.1668','2302.04725','2309.13184'):
        return 'E. EHR / Clinical Data Analytics'
    if aid in ('2312.05530','2303.15563','2211.07893','2505.01206'):
        return 'F. Healthcare ML Infrastructure & Privacy'
    return 'Z. Other'

# Write grouped version
out2 = PAPERS_DIR / 'ieee_references_grouped.bib.txt'
from collections import defaultdict
groups = defaultdict(list)
for i, (aid, entry) in enumerate(selected, 1):
    groups[category_of(aid)].append((i, aid, entry))

with open(out2, 'w', encoding='utf-8') as f:
    f.write("="*78 + "\n")
    f.write("IEEE-FORMAT REFERENCES (grouped) — MediCluster\n")
    f.write(f"Total: {len(selected)} papers across {len(groups)} sections\n")
    f.write("="*78 + "\n\n")
    for cat in sorted(groups.keys()):
        f.write(f"\n--- {cat} ---\n\n")
        for idx, aid, entry in groups[cat]:
            f.write(entry_to_ieee(idx, entry) + "\n\n")

# Write abstracts grouped as well
out3 = PAPERS_DIR / 'papers_with_abstracts_grouped.txt'
with open(out3, 'w', encoding='utf-8') as f:
    f.write("="*78 + "\n")
    f.write("PAPER SUMMARIES (grouped) — for citation context\n")
    f.write("="*78 + "\n")
    for cat in sorted(groups.keys()):
        f.write(f"\n\n--- {cat} ---\n")
        for idx, aid, entry in groups[cat]:
            title = entry.find('a:title', NS).text.strip().replace('\n', ' ')
            arxiv_id = entry.find('a:id', NS).text.strip().split('/abs/')[-1]
            arxiv_id_clean = re.sub(r'v\d+$', '', arxiv_id)
            published = entry.find('a:published', NS).text[:10]
            authors = ', '.join(get_author_names(entry))[:200]
            cats = ', '.join(c.get('term') for c in entry.findall('a:category', NS))
            summary = entry.find('a:summary', NS).text.strip().replace('\n', ' ')
            summary = re.sub(r'\s+', ' ', summary)
            f.write(f"\n[{idx}] {title}\n")
            f.write(f"    arXiv:{arxiv_id_clean} | {published} | {cats}\n")
            f.write(f"    Authors: {authors}\n")
            f.write(f"    Abstract: {summary}...\n")
            f.write(f"    URL: https://arxiv.org/abs/{arxiv_id_clean}\n")

print(f"\nWrote {out}")
print(f"Wrote {out2}")
print(f"Wrote {out3}")
