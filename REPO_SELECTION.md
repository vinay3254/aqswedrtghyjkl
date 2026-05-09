# Patient Health Risk Segregation

Selected repository:

https://github.com/bayesimpact/readmission-risk

Reason:

- It is the strongest patient-risk repository found for reproducible risk stratification rather than a toy clustering demo.
- It includes trained neural-network model architecture and weights for 30-day all-cause hospital readmission prediction.
- The associated PLOS ONE paper reports the model was trained/evaluated on more than 300,000 hospital stays from Sutter Health EHR data.
- Reported high-risk precision improved from 0.20 with LACE to 0.24 with the neural-network model at a 25% intervention threshold, a 20% relative improvement.
- The repository includes model files, feature definitions, and feature extraction code.

Important note:

The shell could not resolve github.com from this environment, so `git clone` failed before any repository files could be downloaded.

Command to run once GitHub DNS/network access is available:

```powershell
git clone --depth 1 https://github.com/bayesimpact/readmission-risk.git "C:\Users\Admin\Patient Health Risk Segregation\readmission-risk"
```

Secondary clustering reference:

https://github.com/bombaypranathi22/Healthcare-Patient-Clustering-Risk-Stratification

Reason:

- It is closer to the requested clustering/segregation theme.
- It applies K-Means and hierarchical clustering to MIMIC-III patient records.
- It reports 2-4 candidate clusters and chooses 4 clinically interpretable groups.
- It does not provide a conventional supervised accuracy score, because clustering is normally evaluated with metrics such as silhouette score, stability, and clinical interpretability.

Command to download the clustering reference:

```powershell
git clone --depth 1 https://github.com/bombaypranathi22/Healthcare-Patient-Clustering-Risk-Stratification.git "C:\Users\Admin\Patient Health Risk Segregation\Healthcare-Patient-Clustering-Risk-Stratification"
```
