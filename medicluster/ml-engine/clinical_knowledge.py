"""Clinical knowledge base for torchxrayvision pathology labels."""

ALL_LABELS = [
    "Atelectasis", "Consolidation", "Infiltration", "Pneumothorax",
    "Edema", "Emphysema", "Fibrosis", "Effusion", "Pneumonia",
    "Pleural_Thickening", "Cardiomegaly", "Nodule", "Mass", "Hernia",
    "Lung Lesion", "Fracture", "Lung Opacity", "Enlarged Cardiomediastinum",
]

CLINICAL_KNOWLEDGE = {
    "Atelectasis": {
        "cause": "Partial or complete collapse of a lung or lobe, often caused by mucus blockage, post-surgical complications, or prolonged bed rest.",
        "medications": ["Bronchodilators", "Mucolytics (e.g. N-acetylcysteine)", "Antibiotics if infection present"],
        "prevention": ["Deep breathing exercises", "Early ambulation after surgery", "Incentive spirometry use"],
        "severity": "moderate",
    },
    "Consolidation": {
        "cause": "Lung tissue fills with fluid, pus, blood, or cells instead of air — typically from pneumonia or pulmonary oedema.",
        "medications": ["Antibiotics (e.g. Amoxicillin-clavulanate)", "Antifungals if fungal cause", "Diuretics if cardiac cause"],
        "prevention": ["Pneumococcal and flu vaccination", "Smoking cessation", "Prompt treatment of respiratory infections"],
        "severity": "high",
    },
    "Infiltration": {
        "cause": "Inflammatory cells, fluid, or other material accumulate in lung tissue, often from infection, allergy, or autoimmune disease.",
        "medications": ["Corticosteroids (e.g. Prednisolone)", "Antibiotics if bacterial", "Antihistamines if allergic"],
        "prevention": ["Avoid known allergens and irritants", "Annual flu vaccination", "Good hand hygiene"],
        "severity": "moderate",
    },
    "Pneumothorax": {
        "cause": "Air leaks into the space between the lung and chest wall, causing the lung to collapse. Spontaneous or from trauma/medical procedures.",
        "medications": ["Oxygen therapy", "Needle aspiration", "Chest tube insertion (for large pneumothorax)"],
        "prevention": ["Avoid smoking (primary risk factor for spontaneous type)", "Protective gear in contact sports", "Inform doctors of prior pneumothorax before procedures"],
        "severity": "high",
    },
    "Edema": {
        "cause": "Excess fluid accumulates in the lungs (pulmonary oedema), usually from heart failure, kidney disease, or acute lung injury.",
        "medications": ["Furosemide (loop diuretic)", "ACE inhibitors", "Oxygen therapy", "Morphine (in acute episodes)"],
        "prevention": ["Manage heart failure and hypertension", "Restrict salt and fluid intake", "Regular cardiac follow-up"],
        "severity": "high",
    },
    "Emphysema": {
        "cause": "Air sacs (alveoli) are progressively destroyed, reducing lung surface area. Almost exclusively caused by long-term smoking or alpha-1 antitrypsin deficiency.",
        "medications": ["Bronchodilators (e.g. Salbutamol, Tiotropium)", "Inhaled corticosteroids", "Oxygen therapy in severe cases"],
        "prevention": ["Quit smoking — most effective intervention", "Avoid occupational dust and fumes", "Alpha-1 antitrypsin replacement therapy if deficient"],
        "severity": "high",
    },
    "Fibrosis": {
        "cause": "Scar tissue replaces normal lung tissue, progressively reducing lung function. Causes include autoimmune disease, occupational exposure, or idiopathic (unknown).",
        "medications": ["Pirfenidone", "Nintedanib", "Oxygen therapy for breathlessness"],
        "prevention": ["Avoid asbestos, silica dust, and toxic fumes", "Treat autoimmune conditions early", "Avoid smoking"],
        "severity": "high",
    },
    "Effusion": {
        "cause": "Excess fluid collects in the pleural space (between lung and chest wall). Caused by heart failure, infection, cancer, or kidney disease.",
        "medications": ["Diuretics", "Antibiotics if infectious (empyema)", "Thoracentesis for drainage", "Treat underlying cause"],
        "prevention": ["Control heart failure and kidney disease", "Prompt treatment of pneumonia", "Regular follow-up for known cancer"],
        "severity": "moderate",
    },
    "Pneumonia": {
        "cause": "Bacterial, viral, or fungal infection of the lung air sacs causes inflammation and fluid build-up.",
        "medications": ["Amoxicillin (first-line bacterial)", "Azithromycin (atypical pneumonia)", "Oseltamivir (viral)", "Fluconazole (fungal)"],
        "prevention": ["Pneumococcal vaccine", "Annual influenza vaccine", "Regular handwashing", "Avoid smoking"],
        "severity": "high",
    },
    "Pleural_Thickening": {
        "cause": "Pleural lining thickens from past inflammation, infection, asbestos exposure, or haemothorax.",
        "medications": ["Anti-inflammatory drugs (e.g. NSAIDs)", "Corticosteroids if inflammatory cause", "Treat underlying condition"],
        "prevention": ["Avoid asbestos exposure", "Treat pleural infections promptly", "Occupational health monitoring"],
        "severity": "low",
    },
    "Cardiomegaly": {
        "cause": "Enlarged heart, usually due to hypertension, coronary artery disease, heart valve problems, or cardiomyopathy.",
        "medications": ["ACE inhibitors (e.g. Enalapril)", "Beta-blockers (e.g. Metoprolol)", "Diuretics", "Digoxin"],
        "prevention": ["Control blood pressure and cholesterol", "Regular aerobic exercise", "Avoid excessive alcohol", "Manage diabetes"],
        "severity": "moderate",
    },
    "Nodule": {
        "cause": "Small rounded growth (< 3 cm) in the lung. Usually benign (old infection, scar tissue) but requires follow-up to exclude early-stage cancer.",
        "medications": ["No immediate treatment for benign nodules", "Surgery or ablation if malignant"],
        "prevention": ["Quit smoking (largest risk factor for malignant nodules)", "Reduce radon exposure at home", "Annual low-dose CT screening if high risk"],
        "severity": "moderate",
    },
    "Mass": {
        "cause": "Larger lung growth (> 3 cm). Higher likelihood of malignancy than a nodule; requires urgent investigation.",
        "medications": ["Surgery (lobectomy/pneumonectomy)", "Chemotherapy", "Radiotherapy", "Immunotherapy (e.g. Pembrolizumab)"],
        "prevention": ["Smoking cessation", "Radon and asbestos avoidance", "Annual CT screening for high-risk individuals"],
        "severity": "high",
    },
    "Hernia": {
        "cause": "An organ (usually bowel or stomach) protrudes through an abnormal opening into the chest cavity — commonly hiatal or diaphragmatic hernia.",
        "medications": ["Proton pump inhibitors for hiatal hernia symptoms", "Surgical repair for symptomatic or large hernias"],
        "prevention": ["Maintain healthy weight", "Avoid heavy lifting with poor technique", "Treat chronic cough and constipation"],
        "severity": "low",
    },
    "Lung Lesion": {
        "cause": "Abnormal area of lung tissue from infection, inflammation, trauma, or tumour. Non-specific finding requiring further investigation.",
        "medications": ["Depends on cause: antibiotics, antifungals, steroids, or oncology treatment"],
        "prevention": ["Smoking cessation", "Treat respiratory infections promptly", "Avoid inhaled toxins"],
        "severity": "moderate",
    },
    "Fracture": {
        "cause": "Rib or other thoracic bone fracture visible on chest imaging — from trauma, osteoporosis, or pathological fracture from cancer.",
        "medications": ["Analgesics (NSAIDs, paracetamol)", "Intercostal nerve block for pain", "Treat osteoporosis with bisphosphonates"],
        "prevention": ["Fall prevention (exercise, home safety)", "Calcium and vitamin D supplementation", "Bone density screening after 50"],
        "severity": "moderate",
    },
    "Lung Opacity": {
        "cause": "Area of increased density in the lung on imaging — a non-specific finding covering consolidation, atelectasis, oedema, and tumour until further investigation defines it.",
        "medications": ["Depends on underlying cause"],
        "prevention": ["Prompt follow-up imaging to determine underlying cause", "Smoking cessation", "Treat respiratory infections early"],
        "severity": "moderate",
    },
    "Enlarged Cardiomediastinum": {
        "cause": "Widening of the central chest area, indicating cardiomegaly, aortic aneurysm, pericardial effusion, or mediastinal mass.",
        "medications": ["Treat underlying cause: diuretics for heart failure, surgery for aortic aneurysm, antibiotics for mediastinitis"],
        "prevention": ["Regular cardiac check-ups", "Control blood pressure", "CT aortography for at-risk patients"],
        "severity": "high",
    },
}


def get_clinical_info(label: str) -> dict:
    """Return clinical info for a pathology label, or a safe default if unknown."""
    return CLINICAL_KNOWLEDGE.get(label, {
        "cause": "Unknown",
        "medications": [],
        "prevention": [],
        "severity": "low",
    })
