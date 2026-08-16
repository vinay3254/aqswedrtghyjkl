import sys
import json
from ddgs import DDGS

BLACKLIST = {
    "top", "best", "list", "directory", "rank", "find", "choose", "reviews", 
    "insurance", "cghs", "bajaj", "finserv", "practo", "justdial", "lybrate", 
    "1mg", "apollo247", "indiamart", "yellowpages", "packages", "policybazaar",
    "dial", "compare", "ratings", "treatment-doctors", "hospitals-in-", "hospitals-near-",
    "network-hospital", "en.wikipedia.org", "en.m.wikipedia.org"
}

def is_valid_hospital(r):
    title = r.get("title", "").lower()
    href = r.get("href", "").lower()
    body = r.get("body", "").lower()
    
    # Check blacklist keywords in title and URL
    for word in BLACKLIST:
        if word in title or word in href:
            return False
            
    # Check if the title looks like an article or directory list
    if "top 10" in title or "top 5" in title or "list of" in title or "best hospital" in title or "top hospital" in title:
        return False
        
    return True

def search_hospitals(city, disease=""):
    queries = []
    if disease:
        queries.append(f"hospital {city} {disease}")
        queries.append(f"multi speciality hospital {city} {disease}")
    queries.append(f"multi speciality hospital {city}")
    queries.append(f"medical center {city}")
    
    hospitals = []
    seen_hrefs = set()
    
    with DDGS() as ddgs:
        for query in queries:
            try:
                results = list(ddgs.text(query, max_results=10))
                for r in results:
                    href = r.get("href", "")
                    if href in seen_hrefs:
                        continue
                    if is_valid_hospital(r):
                        seen_hrefs.add(href)
                        hospitals.append({
                            "title": r.get("title", ""),
                            "href": href,
                            "body": r.get("body", "")
                        })
                        if len(hospitals) >= 5:
                            return hospitals
            except Exception as e:
                continue
                
    return hospitals

if __name__ == "__main__":
    city = sys.argv[1] if len(sys.argv) > 1 else "Bengaluru"
    disease = sys.argv[2] if len(sys.argv) > 2 else ""
    hospitals = search_hospitals(city, disease)
    print(json.dumps(hospitals))
