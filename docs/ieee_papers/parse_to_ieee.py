#!/usr/bin/env python3
"""Parse all arXiv XML results and produce an IEEE-format references list
for the MediCluster (Patient Health Risk Segregation) project.
Deduplicates across queries, then formats each paper in IEEE citation style.
"""
import xml.etree.ElementTree as ET
import os
import re
from pathlib import Path

NS = {'a': 'http://www.w3.org/2005/Atom',
      'arxiv': 'http://arxiv.org/schemas/atom'}

PAPERS_DIR = Path(r"C:/Users/Admin/Desktop/Patient Health Risk Segregation/docs/ieee_papers")

def fetch_arxiv_ids(xml_path):
    """Return dict {arxiv_id: entry_element} for deduplication."""
    if not xml_path.exists():
        return {}
    tree = ET.parse(xml_path)
    root = tree.getroot()
    out = {}
    for entry in root.findall('a:entry', NS):
        raw_id = entry.find('a:id', NS).text.strip()
        arxiv_id = raw_id.split('/abs/')[-1]
        # strip version suffix
        arxiv_id = re.sub(r'v\d+$', '', arxiv_id)
        out[arxiv_id] = entry
    return out

# Collect across all queries
queries = [
    'arxiv_risk_stratification.xml',
    'arxiv_kmeans_dbscan.xml',
    'arxiv_hierarchical.xml',
    'arxiv_gmm.xml',
    'arxiv_dimred.xml',
    'arxiv_eval.xml',
    'arxiv_disease.xml',
    'arxiv_ehr_ml.xml',
]

all_papers = {}  # arxiv_id -> entry
for fn in queries:
    p = PAPERS_DIR / fn
    print(f"Loading {fn} ...")
    papers = fetch_arxiv_ids(p)
    print(f"  -> {len(papers)} papers")
    for aid, entry in papers.items():
        if aid not in all_papers:
            all_papers[aid] = entry

print(f"\nTotal unique papers: {len(all_papers)}")

# Build IEEE-style references
def get_author_names(entry):
    """Return list of author name strings from an arXiv entry."""
    out = []
    for a in entry.findall('a:author', NS):
        name_el = a.find('a:name', NS)
        if name_el is None or not name_el.text:
            continue
        name = name_el.text.strip()
        if name:
            out.append(name)
    return out

def format_authors_ieee(names):
    """IEEE style: 'F. Lastname, F. Lastname, and F. Lastname'"""
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
    elif len(formatted) == 2:
        return f"{formatted[0]} and {formatted[1]}"
    else:
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
    cat = entry.find('arxiv:primary_category', NS)
    primary = cat.get('term') if cat is not None else 'cs.LG'
    # Convert month number to short name
    months = {'01':'Jan','02':'Feb','03':'Mar','04':'Apr','05':'May','06':'Jun',
              '07':'Jul','08':'Aug','09':'Sep','10':'Oct','11':'Nov','12':'Dec'}
    month_name = months.get(month, '')

    # IEEE format for arXiv:
    # A. Author, "Title," arXiv preprint arXiv:XXXX.XXXXX, Month Year, [Online]. Available: https://arxiv.org/abs/XXXX.XXXXX
    return (
        f"[{idx}] {authors}, \"{title},\" "
        f"arXiv preprint arXiv:{arxiv_id_clean}, "
        f"{month_name} {year}. [Online]. Available: https://arxiv.org/abs/{arxiv_id_clean}"
    )

# Write IEEE bibliography
out_path = PAPERS_DIR / 'ieee_references.bib.txt'
with open(out_path, 'w', encoding='utf-8') as f:
    f.write("="*78 + "\n")
    f.write("IEEE-FORMAT REFERENCES — Patient Health Risk Segregation (MediCluster)\n")
    f.write(f"Total unique papers: {len(all_papers)}\n")
    f.write("="*78 + "\n\n")
    for i, (aid, entry) in enumerate(sorted(all_papers.items(), key=lambda kv: kv[1].find('a:published', NS).text, reverse=True), 1):
        f.write(entry_to_ieee(i, entry) + "\n\n")

# Also write a brief abstract summary for each
abs_path = PAPERS_DIR / 'papers_with_abstracts.txt'
with open(abs_path, 'w', encoding='utf-8') as f:
    f.write("="*78 + "\n")
    f.write("PAPER SUMMARIES — for citation context\n")
    f.write("="*78 + "\n\n")
    for i, (aid, entry) in enumerate(sorted(all_papers.items(), key=lambda kv: kv[1].find('a:published', NS).text, reverse=True), 1):
        title = entry.find('a:title', NS).text.strip().replace('\n', ' ')
        arxiv_id = entry.find('a:id', NS).text.strip().split('/abs/')[-1]
        arxiv_id_clean = re.sub(r'v\d+$', '', arxiv_id)
        published = entry.find('a:published', NS).text[:10]
        authors = ', '.join(get_author_names(entry))[:200]
        cats = ', '.join(c.get('term') for c in entry.findall('a:category', NS))
        summary = entry.find('a:summary', NS).text.strip().replace('\n', ' ')
        summary = re.sub(r'\s+', ' ', summary)[:400]
        f.write(f"[{i}] {title}\n")
        f.write(f"    arXiv:{arxiv_id_clean} | {published} | {cats}\n")
        f.write(f"    Authors: {authors}\n")
        f.write(f"    Abstract: {summary}...\n")
        f.write(f"    URL: https://arxiv.org/abs/{arxiv_id_clean}\n\n")

print(f"\nWrote {out_path}")
print(f"Wrote {abs_path}")
