import sys
sys.path.insert(0, '.')
import json
import pandas as pd

with open('../frontend/src/data/sample_patients.json') as f:
    data = json.load(f)

df = pd.DataFrame(data)
print('Loaded', len(df), 'patients')

from preprocessing.pipeline import preprocess
cleaned_df, X_scaled, pca_coords, feature_names, scaler = preprocess(df)
print('After preprocessing:', len(cleaned_df), 'rows,', len(feature_names), 'features')
print('PCA shape:', pca_coords.shape)

from clustering.kmeans import run_kmeans
res = run_kmeans(X_scaled, k=4)
print('KMeans labels unique:', sorted(set(res["labels"].tolist())))
print('Inertia:', round(res["inertia"], 2))

from evaluation.metrics import compute_metrics
m = compute_metrics(X_scaled, res['labels'])
print('Metrics:', {k: round(v, 4) if v else None for k, v in m.items()})

from utils.risk_labeler import label_risk_tiers
risk = label_risk_tiers(res['labels'], res['centroids'], feature_names, scaler)
print('Risk map:', risk)
print('ALL OK')
