"""Early Completion Warning System (EWS) - rule-based prototype.

Pipeline: student records -> 3 pacing/engagement signals -> student risk
category -> cohort (batch) and partner (institute) alert -> recommended action.

Run `python ews.py` to print a summary, run the self-check and write
EWS_output.xlsx (the "model file").
"""
from pathlib import Path

import numpy as np
import pandas as pd

DATA = Path(__file__).parent / "Case Assignment - Sr Associate - Philippines - data.xlsx"

# ---- Thresholds (all in one place; review quarterly) -----------------------
FAST_RATIO = 0.5        # finished in < 50% of planned duration
COMPRESSED_DAYS = 2     # all assessments submitted on <= 2 distinct days
LOW_LESSON_PCT = 0.5    # < 50% of lessons logged as completed
COHORT_RED = 0.30       # >= 30% of completers High Risk -> Red
COHORT_AMBER = 0.15     # >= 15% -> Amber
MIN_COMPLETERS = 10     # fewer completers -> "Too small to rate"

ACTIONS = {
    "High Risk": "Hold graduate status -> verify records & re-assess sample -> review with partner",
    "Watch": "Count as graduate -> spot-check 10% -> monitor next cycle",
    "On track": "No action",
}
COHORT_ACTIONS = {
    "Red": "Partner review call within 5 working days; hold graduate reporting for High-Risk students; proctored re-assessment of a sample",
    "Amber": "Programme manager checks batch schedule & facilitation with faculty; monitor next run",
    "Green": "No action",
    "Too small": "Review flagged students individually; judge at partner level",
}


def load(path=DATA):
    df = pd.read_excel(path)
    # Scope: Philippines only (2 India records are a different course).
    df = df[df.country_name == "Philippines"].copy()
    subs = df.filter(regex=r"^Competency_quiz_submit_\d+$").apply(pd.to_datetime)

    df["last_assessment"] = subs.max(axis=1)
    df["assessment_days"] = subs.apply(lambda r: r.dropna().nunique(), axis=1)
    # Inclusive days: joined and finished same day = 1 day.
    df["days_to_complete"] = (df.last_assessment - df.batch_joined_date).dt.days + 1
    # Planned pace: learning hours / planned hours per week (both from the LMS).
    df["planned_days"] = (df["course_duration_hours.1"] / df.hours_week * 7).round(1)
    df["pace_ratio"] = (df.days_to_complete / df.planned_days).round(2)
    df["lesson_pct"] = (df.total_lessons_completed_in_course / df.total_lessons_in_course).round(2)
    df["completed"] = df.student_status_inbatch == "COMPLETED"
    return classify(df)


def classify(df):
    df["flag_fast"] = df.completed & (df.pace_ratio < FAST_RATIO)
    df["flag_compressed"] = df.completed & (df.assessment_days <= COMPRESSED_DAYS)
    df["flag_low_lessons"] = df.completed & (df.lesson_pct < LOW_LESSON_PCT)
    n = df[["flag_fast", "flag_compressed", "flag_low_lessons"]].sum(axis=1)
    df["risk"] = np.select([~df.completed, n >= 2, n == 1],
                           ["Not completed", "High Risk", "Watch"], "On track")
    names = {"flag_fast": "Fast", "flag_compressed": "Compressed assessments",
             "flag_low_lessons": "Low lesson coverage"}
    df["signals"] = df[list(names)].apply(
        lambda r: ", ".join(v for k, v in names.items() if r[k]), axis=1)
    # Fast but fully engaged = the plausible "genuine fast learner" pattern.
    df.loc[df.signals == "Fast", "signals"] = "Fast only (likely genuine fast learner)"
    df["action"] = df.risk.map(ACTIONS).fillna("")
    return df


def rollup(df, by):
    c = df[df.completed]
    g = c.groupby(by).agg(
        completers=("student_id", "size"),
        high_risk=("risk", lambda s: (s == "High Risk").sum()),
        watch=("risk", lambda s: (s == "Watch").sum()),
        median_days=("days_to_complete", "median"),
        planned_days=("planned_days", "median"),
        pct_fast=("flag_fast", "mean"),
        pct_compressed=("flag_compressed", "mean"),
        pct_low_lessons=("flag_low_lessons", "mean"),
        avg_score=("average_quiz_score", "mean"),
    )
    enrolled = df.groupby(by).student_id.size().rename("enrolled")
    g = g.join(enrolled, how="right").fillna({"completers": 0, "high_risk": 0, "watch": 0})
    g["pct_high_risk"] = (g.high_risk / g.completers).where(g.completers > 0)
    g["alert"] = np.select(
        [g.completers < MIN_COMPLETERS, g.pct_high_risk >= COHORT_RED, g.pct_high_risk >= COHORT_AMBER],
        ["Too small", "Red", "Amber"], "Green")
    g["action"] = g.alert.map(COHORT_ACTIONS)
    return g.reset_index().sort_values("pct_high_risk", ascending=False)


def cohorts(df):
    out = rollup(df, ["institute_name", "batch_id", "batch_name"])
    win = df.groupby("batch_id").apply(lambda b: (b.batch_end_date.iloc[0] - b.batch_start_date.iloc[0]).days,
                                       include_groups=False)
    out["scheduled_window_days"] = out.batch_id.map(win)
    return out


def partners(df):
    return rollup(df, "institute_name")


def self_check():
    t = pd.DataFrame({
        "completed": [True, True, True, True, False],
        "pace_ratio": [0.9, 0.3, 0.3, 1.0, 0.1],
        "assessment_days": [6, 5, 1, 1, 1],
        "lesson_pct": [1.0, 1.0, 0.1, 0.1, 0.0],
    })
    r = classify(t)
    assert list(r.risk) == ["On track", "Watch", "High Risk", "High Risk", "Not completed"], list(r.risk)
    assert r.signals[1].startswith("Fast only")


if __name__ == "__main__":
    self_check()
    df = load()
    c, p = cohorts(df), partners(df)
    print(df[df.completed].risk.value_counts(), "\n")
    print(p[["institute_name", "completers", "pct_high_risk", "alert"]].round(2).to_string(index=False), "\n")
    print(c.alert.value_counts())
    with pd.ExcelWriter(Path(__file__).parent / "EWS_output.xlsx") as xw:
        p.to_excel(xw, sheet_name="Partners", index=False)
        c.to_excel(xw, sheet_name="Cohorts", index=False)
        cols = ["institute_name", "batch_name", "student_id", "risk", "signals", "days_to_complete",
                "planned_days", "pace_ratio", "assessment_days", "lesson_pct", "average_quiz_score", "action"]
        df[df.completed][cols].sort_values(["risk", "institute_name"]).to_excel(xw, sheet_name="Students", index=False)
    print("Wrote EWS_output.xlsx")
