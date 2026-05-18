import pandas as pd
import numpy as np
from faker import Faker
import random

fake = Faker()
random.seed(42)
np.random.seed(42)

print("Loading base dataset...")
df = pd.read_csv("Synthetic_Financial_datasets_log.csv", nrows=50000)
n = len(df)
fraud_mask = df["isFraud"].values.astype(bool)

# ── Realistic helpers: overlapping distributions, label noise ─────────────

def noisy_bool(fraud_prob, legit_prob, noise=0.06):
    """Bool feature with realistic overlap — some legit look like fraud and vice versa."""
    prob = np.where(fraud_mask, fraud_prob, legit_prob)
    # Add random noise to blur the boundary
    prob = prob + np.random.normal(0, noise, n)
    prob = np.clip(prob, 0.01, 0.99)
    return np.random.binomial(1, prob, n).astype(bool)

def noisy_float(fraud_mean, legit_mean, std, low=0.0, high=1.0):
    """Float from same std, just different means — creates overlap."""
    base = np.where(fraud_mask, fraud_mean, legit_mean)
    vals = np.random.normal(base, std, n)
    return np.clip(vals, low, high).round(4)

def noisy_int(fraud_mean, legit_mean, std, low=0, high=None):
    base = np.where(fraud_mask, fraud_mean, legit_mean)
    vals = np.round(np.random.normal(base, std, n)).astype(int)
    vals = np.clip(vals, low, high if high else 9999)
    return vals.astype(int)

def noisy_cat(fraud_probs, legit_probs, categories, noise=0.04):
    """Categorical with soft probabilities — frauds don't always pick 'fraud' category."""
    fraud_p  = np.array(fraud_probs)
    legit_p  = np.array(legit_probs)
    # Blend toward uniform to reduce separation
    uniform  = np.ones(len(categories)) / len(categories)
    fraud_p  = (1 - noise) * fraud_p + noise * uniform
    legit_p  = (1 - noise) * legit_p + noise * uniform
    choices  = np.where(
        fraud_mask,
        np.array([np.random.choice(categories, p=fraud_p) for _ in range(n)]),
        np.array([np.random.choice(categories, p=legit_p) for _ in range(n)])
    )
    return choices

# ── KYC (overlapping ranges) ──────────────────────────────────────────────
print("Generating KYC features...")
# kyc_verified: most frauds are verified too (they pass KYC) — only slightly lower
df["kyc_verified"]     = noisy_bool(fraud_prob=0.72, legit_prob=0.91, noise=0.10)
# kyc_attempts: fraud skews higher but many legit also retry
df["kyc_attempts"]     = noisy_int(fraud_mean=2.5, legit_mean=1.3, std=1.2, low=1, high=5)
# face_match_score: heavily overlapping — fraud has slightly lower scores but not perfectly split
df["face_match_score"] = noisy_float(fraud_mean=0.65, legit_mean=0.82, std=0.18, low=0.1, high=1.0)
# sanctions_hit: rare even in fraud, very rare in legit
df["sanctions_hit"]    = noisy_bool(fraud_prob=0.09, legit_prob=0.01, noise=0.03)

# ── Bureau (same scale, shifted mean) ────────────────────────────────────
print("Generating bureau features...")
# credit_score: wide std so scores overlap between 500-750
df["credit_score"]          = noisy_int(fraud_mean=560, legit_mean=680, std=120, low=300, high=900)
# bureau_enquiries_30d: fraud slightly more enquiries, but many legit shop around too
df["bureau_enquiries_30d"]  = noisy_int(fraud_mean=4.5, legit_mean=2.0, std=3.0, low=0, high=20)
# dpd_90: most frauds also have 0 dpd (first-time fraudsters with clean history)
df["dpd_90"]                = noisy_int(fraud_mean=15, legit_mean=4, std=20, low=0, high=90)
# debt_to_income_ratio: overlapping — fraud slightly higher but same range
df["debt_to_income_ratio"]  = noisy_float(fraud_mean=1.8, legit_mean=0.9, std=0.9, low=0.0, high=5.0)

# ── Device ────────────────────────────────────────────────────────────────
print("Generating device features...")
# is_rooted: many legit power users root devices; most fraudsters don't bother
df["is_rooted_jailbroken"]        = noisy_bool(fraud_prob=0.22, legit_prob=0.06, noise=0.08)
df["vpn_detected"]                = noisy_bool(fraud_prob=0.38, legit_prob=0.14, noise=0.10)
df["multiple_accounts_on_device"] = noisy_bool(fraud_prob=0.30, legit_prob=0.08, noise=0.08)
df["ip_asn_type"] = noisy_cat(
    fraud_probs=[0.38, 0.15, 0.25, 0.14, 0.08],
    legit_probs=[0.50, 0.28, 0.10, 0.08, 0.04],
    categories=["residential", "mobile", "datacenter", "vpn", "tor"],
    noise=0.10
)

# ── App Telemetry ─────────────────────────────────────────────────────────
print("Generating app telemetry features...")
# failed_logins: fraud slightly higher but most are 0-1 for both
df["failed_logins_7d"]        = noisy_int(fraud_mean=2.0, legit_mean=0.6, std=2.5, low=0, high=10)
# copy_paste: many legit users also paste passwords from managers
df["copy_paste_used"]         = noisy_bool(fraud_prob=0.52, legit_prob=0.30, noise=0.12)
df["otp_retry_count"]         = noisy_int(fraud_mean=1.5, legit_mean=0.4, std=1.2, low=0, high=5)
# time_to_submit_form_sec: bots are fast but some legit users also are fast (autofill)
df["time_to_submit_form_sec"] = noisy_int(fraud_mean=45, legit_mean=90, std=60, low=3, high=600)

# ── Social Signals ────────────────────────────────────────────────────────
print("Generating social signal features...")
df["email_domain_type"] = noisy_cat(
    fraud_probs=[0.40, 0.48, 0.12],
    legit_probs=[0.62, 0.32, 0.06],
    categories=["personal", "disposable", "corporate"],
    noise=0.10
)
# email_age_days: fraud skews newer but many fraudsters have old accounts too
df["email_age_days"]     = noisy_int(fraud_mean=180, legit_mean=900, std=500, low=0, high=5000)
df["phone_type"] = noisy_cat(
    fraud_probs=[0.55, 0.32, 0.13],
    legit_probs=[0.76, 0.17, 0.07],
    categories=["mobile", "voip", "landline"],
    noise=0.08
)
df["email_breach_count"] = noisy_int(fraud_mean=1.5, legit_mean=0.4, std=1.5, low=0, high=5)

# ── Adversarial fraud patterns: ~25% of fraudsters look perfectly legit ──
# These are "sleeper" frauds — clean credit, verified KYC, residential IP
print("Injecting adversarial (sleeper) fraud patterns...")
fraud_idx = np.where(fraud_mask)[0]
sleeper_idx = np.random.choice(fraud_idx, size=int(0.10 * len(fraud_idx)), replace=False)

df.loc[sleeper_idx, "credit_score"]          = np.random.randint(720, 850, len(sleeper_idx))
df.loc[sleeper_idx, "kyc_verified"]          = True
df.loc[sleeper_idx, "face_match_score"]      = np.round(np.random.uniform(0.88, 0.98, len(sleeper_idx)), 4)
df.loc[sleeper_idx, "sanctions_hit"]         = False
df.loc[sleeper_idx, "vpn_detected"]          = False
df.loc[sleeper_idx, "is_rooted_jailbroken"]  = False
df.loc[sleeper_idx, "ip_asn_type"]           = "residential"
df.loc[sleeper_idx, "email_domain_type"]     = "personal"
df.loc[sleeper_idx, "dpd_90"]               = 0
df.loc[sleeper_idx, "failed_logins_7d"]      = 0
df.loc[sleeper_idx, "email_age_days"]        = np.random.randint(365, 2000, len(sleeper_idx))

# ── Inject label noise (1%): flip some labels to simulate mislabelled data ─
print("Injecting label noise (1%)...")
flip_idx = np.random.choice(n, size=int(0.01 * n), replace=False)
df.loc[flip_idx, "isFraud"] = 1 - df.loc[flip_idx, "isFraud"]

# ── Save ──────────────────────────────────────────────────────────────────
out = "enriched_fraud_dataset.csv"
df.to_csv(out, index=False)
print(f"\nDone! Saved {len(df):,} rows x {len(df.columns)} columns -> {out}")
print(f"Fraud rate: {df['isFraud'].mean()*100:.2f}%")
print(f"\nSample feature means by class:")
num_feats = ["credit_score", "face_match_score", "dpd_90", "failed_logins_7d", "email_age_days"]
print(df.groupby("isFraud")[num_feats].mean().round(2))
