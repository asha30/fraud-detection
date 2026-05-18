import joblib

model = joblib.load(
    "app/ml/random_forest_fraud_model 1.pkl"
)

print(model.feature_names_in_)
print(len(model.feature_names_in_))