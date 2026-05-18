from app.ml.model_loader import ModelLoader
loader = ModelLoader("app/ml/random_forest_fraud_model.pkl")

loaded = loader.load_if_available()

print(loaded)