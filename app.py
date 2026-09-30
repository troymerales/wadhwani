"""EWS dashboard. Run: streamlit run app.py"""
import plotly.express as px
import streamlit as st

import ews

st.set_page_config(page_title="Early Completion EWS - UDFI Philippines", layout="wide")

RISK_COLORS = {"On track": "#0ca30c", "Watch": "#fab219", "High Risk": "#d03b3b"}
ALERT_COLORS = {"Green": "#0ca30c", "Amber": "#fab219", "Red": "#d03b3b", "Too small": "#a3a29d"}
ALERT_ICON = {"Red": "🔴", "Amber": "🟠", "Green": "🟢", "Too small": "⚪"}
RISK_ORDER = ["High Risk", "Watch", "On track"]


@st.cache_data
def data():
    df = ews.load()
    return df, ews.cohorts(df), ews.partners(df)


df, cohorts, partners = data()


def tile(col, label, value, sub=""):
    col.metric(label, value, border=True)
    col.caption(sub)


d = df
done = d[d.completed]
coh = cohorts

st.title("Early Completion Warning System")
st.caption("UDFI Philippines · Employability Skills course · prototype on supplied LMS extract (Feb–May 2025)")

with st.expander("What does a flag mean? (method in 30 seconds)", expanded=False):
    st.markdown(f"""
Each **completer** is checked against three simple signals:

| Signal | Rule | Why it matters |
|---|---|---|
| **Fast** | Finished in < {ews.FAST_RATIO:.0%} of planned time (planned = course hours ÷ planned hours/week; ≈25 days for the 109-hour course) | Too little time for the content |
| **Compressed assessments** | All module assessments submitted on ≤ {ews.COMPRESSED_DAYS} days | Modules done in one sitting |
| **Low lesson coverage** | < {ews.LOW_LESSON_PCT:.0%} of lessons logged complete | Passed assessments without the content |

**On track** = 0 signals · **Watch** = 1 signal · **High Risk** = 2 or more.
A *Fast only* student who did the lessons and spread the assessments out is treated as a likely genuine fast learner (Watch, not High Risk).

**Cohort alert** = share of completers who are High Risk: 🔴 Red ≥ {ews.COHORT_RED:.0%} · 🟠 Amber ≥ {ews.COHORT_AMBER:.0%} · 🟢 Green below that ·
⚪ fewer than {ews.MIN_COMPLETERS} completers = too small to rate (students still reviewed individually).
A flag is a prompt to verify, **not** proof of misconduct.
""")

# ---- 1. Executive summary ---------------------------------------------------
rated = coh[coh.alert != "Too small"]
k = st.columns(5)
tile(k[0], "Completers assessed", f"{len(done):,}", f"of {len(d):,} enrolled")
tile(k[1], "High Risk completers", f"{(done.risk == 'High Risk').mean():.0%}", f"{(done.risk == 'High Risk').sum()} students")
tile(k[2], "Red cohorts", f"{(rated.alert == 'Red').sum()}", f"of {len(rated)} rated cohorts")
tile(k[3], "Median days to complete", f"{done.days_to_complete.median():.0f}", f"planned ≈ {done.planned_days.median():.0f}")
tile(k[4], "Completed < half planned time", f"{done.flag_fast.mean():.0%}", "Fast signal")

# ---- 2. Risk overview -------------------------------------------------------
st.subheader("Risk overview")
c1, c2 = st.columns(2)
rc = done.risk.value_counts().reindex(RISK_ORDER).fillna(0).reset_index()
fig = px.bar(rc, x="count", y="risk", orientation="h", color="risk", color_discrete_map=RISK_COLORS,
             text="count", title="Completers by risk category")
fig.update_layout(showlegend=False, yaxis_title=None, xaxis_title="Students", height=260, margin=dict(t=40, b=10))
c1.plotly_chart(fig, width="stretch")

sig = done[done.signals != ""].signals.value_counts().reset_index()
sig.columns = ["Signal combination", "Students"]
c2.markdown("**What triggered the flags**")
c2.dataframe(sig, hide_index=True, width="stretch", height=250)

# ---- 3. Partner / cohort view -----------------------------------------------
st.subheader("Partner & cohort view")
p = partners.copy()
p.insert(0, " ", p.alert.map(ALERT_ICON))
st.dataframe(
    p[[" ", "institute_name", "enrolled", "completers", "pct_high_risk", "pct_fast", "pct_compressed",
       "pct_low_lessons", "median_days", "avg_score", "alert"]],
    hide_index=True, width="stretch",
    column_config={
        "institute_name": "Partner", "enrolled": "Enrolled", "completers": st.column_config.NumberColumn("Completers", format="%d"),
        "pct_high_risk": st.column_config.ProgressColumn("% High Risk", format="percent", min_value=0, max_value=1),
        "pct_fast": st.column_config.NumberColumn("% Fast", format="percent"),
        "pct_compressed": st.column_config.NumberColumn("% Compressed", format="percent"),
        "pct_low_lessons": st.column_config.NumberColumn("% Low lessons", format="percent"),
        "median_days": st.column_config.NumberColumn("Median days", format="%.0f"),
        "avg_score": st.column_config.NumberColumn("Avg quiz score", format="%.0f"),
        "alert": "Alert",
    })

rated_sorted = rated.sort_values("pct_high_risk")
fig = px.bar(rated_sorted, x="pct_high_risk", y="batch_name", color="alert", orientation="h",
             color_discrete_map=ALERT_COLORS, hover_data={"institute_name": True, "completers": True, "median_days": True},
             title=f"% of completers High Risk, by cohort (cohorts with ≥ {ews.MIN_COMPLETERS} completers)",
             category_orders={"alert": ["Red", "Amber", "Green"]})
fig.add_vline(x=ews.COHORT_RED, line_dash="dot", line_color="#d03b3b", annotation_text="Red 30%")
fig.add_vline(x=ews.COHORT_AMBER, line_dash="dot", line_color="#c98500", annotation_text="Amber 15%")
fig.update_layout(height=max(400, 18 * len(rated_sorted)), xaxis_tickformat=".0%", yaxis_title=None,
                  xaxis_title="% High Risk", legend_title="Alert", margin=dict(t=50))
st.plotly_chart(fig, width="stretch")

# ---- 4. Pacing -------------------------------------------------------------
st.subheader("Completion pacing")
c1, c2 = st.columns(2)
fig = px.histogram(done[done.days_to_complete <= 60], x="days_to_complete", color="risk", nbins=60,
                   color_discrete_map=RISK_COLORS, category_orders={"risk": RISK_ORDER},
                   title="Days from joining to final assessment (completers)")
planned = done.planned_days.median()
fig.add_vline(x=planned, line_dash="dash", annotation_text=f"Planned ≈ {planned:.0f} days")
fig.add_vline(x=planned * ews.FAST_RATIO, line_dash="dot", line_color="#d03b3b", annotation_text="Fast threshold")
fig.update_layout(bargap=0.1, xaxis_title="Days", yaxis_title="Students", legend_title=None, height=380)
c1.plotly_chart(fig, width="stretch")

fig = px.box(done, x="risk", y="average_quiz_score", color="risk", color_discrete_map=RISK_COLORS,
             category_orders={"risk": RISK_ORDER}, points=False,
             title="Quiz scores do not separate rushed from engaged learners")
fig.update_layout(showlegend=False, xaxis_title=None, yaxis_title="Average quiz score", height=380)
c2.plotly_chart(fig, width="stretch")
st.caption("High Risk students score as high as (or higher than) On-track students, so passing the quiz is not, on its own, "
           "evidence of learning. Assessment design and proctoring should be reviewed alongside the EWS.")

# ---- 5. Drill-down ---------------------------------------------------------
st.subheader("Cohort drill-down")
opts = coh.assign(_o=coh.alert.map({"Red": 0, "Amber": 1, "Green": 2, "Too small": 3})).sort_values(
    ["_o", "pct_high_risk"], ascending=[True, False])
labels = {r.batch_id: f"{ALERT_ICON[r.alert]} {r.batch_name} — {r.institute_name}" for r in opts.itertuples()}
bid = st.selectbox("Select cohort (sorted by risk)", list(labels), format_func=labels.get)
row = opts[opts.batch_id == bid].iloc[0]
m = st.columns(5)
tile(m[0], "Alert", f"{ALERT_ICON[row.alert]} {row.alert}")
tile(m[1], "Completers", f"{row.completers:.0f} / {row.enrolled:.0f}")
tile(m[2], "% High Risk", "–" if row.completers == 0 else f"{row.pct_high_risk:.0%}")
tile(m[3], "Median days", "–" if row.completers == 0 else f"{row.median_days:.0f}")
tile(m[4], "Scheduled batch window", f"{row.scheduled_window_days:.0f} days")
st.info(f"**Recommended action:** {row.action}")

show = d[(d.batch_id == bid) & d.completed].sort_values(["risk", "days_to_complete"])
only_flagged = st.toggle("Show flagged students only", value=True)
if only_flagged:
    show = show[show.risk != "On track"]
st.dataframe(
    show[["student_id", "risk", "signals", "days_to_complete", "assessment_days", "lesson_pct", "average_quiz_score", "action"]],
    hide_index=True, width="stretch",
    column_config={"student_id": "Student ID", "risk": "Risk", "signals": "Signals", "days_to_complete": "Days",
                   "assessment_days": "Assessment days", "lesson_pct": st.column_config.NumberColumn("Lessons done", format="percent"),
                   "average_quiz_score": "Avg score", "action": "Action"})

# ---- 6. Actions -----------------------------------------------
st.subheader("Recommended actions (per SOP)")
a1, a2 = st.columns(2)
a1.markdown("**Student level**\n\n" + "\n".join(f"- **{k}** → {v}" for k, v in ews.ACTIONS.items()))
a2.markdown("**Cohort level**\n\n" + "\n".join(f"- {ALERT_ICON[k]} **{k}** → {v}" for k, v in ews.COHORT_ACTIONS.items()))
