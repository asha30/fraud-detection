import joblib

model = joblib.load("app/ml/random_forest_fraud_model 1.pkl")

print(model)

print("Number of trees:", len(model.estimators_))