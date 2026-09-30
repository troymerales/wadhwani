# Early Completion Risk & Outcome Integrity — UDFI Philippines

**Files:** `ews.py` (all rules and thresholds, ~130 lines of pandas) · `app.py` (Streamlit dashboard) · `EWS_output.xlsx` (model file: Partners / Cohorts / Students sheets)
**Run:** `python ews.py` (self-check + Excel export), then `streamlit run app.py`

Legend used throughout: **[Data]** = shown by the supplied extract · **[Assumption]** = my interpretation, to confirm · **[Rec]** = recommendation

---

## 1. Data understanding

- 2,381 rows, one row per student-course enrolment (no duplicate students). 129 columns.
- **Structure:** 6 institutes (partners) → 80 batches (cohorts) → students. Each row has up to 14 module assessments, and each has a submit date and a score.
- **Scope used:** 2,379 Philippine records, 5 partners, 78 batches. I excluded 2 records from Rooman Technologies (India, different course).
- **Concentration [Data]:** Citi Global College SHS makes up 86% of records (2,053). TRIMEX SHS has 167, Trimex Colleges 70, NU Dasmariñas 60, MSEUF 29.
- **Courses:** "Employability Skills – Job Ready" (109 learning hours, 14 assessments, 109 lessons) covers 96%. "JobReady – Employability Skills" (75 h, 11 assessments) runs at NU and MSEUF.
- **Completion fields:**
  - `student_status_inbatch` = COMPLETED for 1,866 students (78%).
  - Every completer has all assessments submitted.
  - `student_journey` separates "Completed with ≥70 score" (1,821) from "Completed" (55).
- **Fields I used for pacing:** `batch_joined_date`, the 14 assessment submit dates, `course_duration_hours.1`, `hours_week`, and lessons completed out of total lessons.

## 2. Key data-quality observations

| Observation | Effect on the EWS |
|---|---|
| Dates are **day-level only** (no timestamps) | Speed is measured in days. We can't see minutes per quiz. A same-day finish counts as 1 day. |
| `batch_duration` = 2.5 for nearly every batch, but actual batch windows run **15–41 days** (Citi) | `batch_duration` is unreliable, so I didn't use it. |
| Citi's partner-set batch windows of 15–16 days would need ~7 h/day to cover 109 h | The schedule itself creates pressure to rush. I report it as a cohort-level design issue. |
| 30% of completers logged < 50% of lessons, yet all passed | This is the strongest integrity signal. **[Assumption]** Lessons are consumed in the LMS. Offline teaching would look like "low coverage". |
| Quiz scores are high whether or not lessons were done (median ~92–95) | The score doesn't show whether learning happened (see §4). |
| 193 completers submitted the summative before a module assessment; 615 finished after the batch end date | Noted. Not used as flags, because the LMS evidently allows both. |
| `number_of_active_students` always equals `total_number_student_enrolled` | Not informative, so ignored. |
| Test/placeholder batches ("Sample Batch for CGC SHS", "NEW BATCH CODE", "LAST BATCH CODE") | Kept, but most fall under "too small to rate". |
| Employment fields ~96% empty; placement date and salary 100% empty; `is_eligible_for_placement` = 0 for everyone; some employment start dates come *before* the course | **Outcomes can't be linked in this extract.** This matters for Phase 2. |
| Names and emails are blank (anonymised). Some graduation dates are implausible (2005, 2030). | No effect on the EWS. Flag it to the data owner. |

## 3. Recommended EWS methodology

**What counts as "early completion" risk.** A student is marked COMPLETED, but the record suggests the content could not realistically have been covered. The signal is not speed alone. It is **speed combined with missing evidence of engagement.**

**Pacing model (baseline).** Planned duration = course learning hours ÷ planned hours per week. For the main course that's 109 h ÷ 30 h/week ≈ **25 days**. Both inputs come from the LMS. **[Assumption]** They reflect the intended schedule. The baseline is **absolute (the programme's own plan), not relative to peers**. If a whole partner rushes, a peer-relative baseline would treat rushing as normal.

**Three signals per completer:**

| Signal | Rule | Plain meaning |
|---|---|---|
| Fast | Joined to final assessment in < 50% of planned time (< ~13 days) | Implies more than 2× the planned weekly study load |
| Compressed | All module assessments submitted on ≤ 2 distinct days | Modules done in a sitting or two |
| Low lesson coverage | < 50% of lessons logged complete | Passed without the content |

**Student category:** 0 signals = **On track**; 1 signal = **Watch**; 2 or more = **High Risk**.

- **Genuine fast learner vs problematic pattern.** A fast learner still does the lessons and spreads the assessments out. So "Fast only" stays in Watch. Two signals together are much harder to explain innocently.
- **Why compressed alone is only Watch.** Assessments done on one day can simply be an in-class test day.

**Cohort (batch) alert.** Based on the share of completers who are High Risk:

- 🔴 **Red** ≥ 30%
- 🟠 **Amber** 15–29%
- 🟢 **Green** < 15%

These are fixed thresholds that a partner manager can remember. I set them so that Red captures roughly the worst sixth of cohorts on this data. Recalibrate after two cycles.

- **Partner level:** the same rule, applied to all of the partner's completers.

**Small cohorts.** Under 10 completers = ⚪ **Too small to rate**. The cohort still appears, its flagged students are still listed, and it rolls up into the partner rating. One rushed student in a 4-person batch shouldn't trigger a Red partner call.

**Missing or suspicious data.** Only completers are rated.

- A completer with missing assessment dates would be excluded from pacing and sent to a data-quality list. None exist in this extract.
- Fields that contradict each other (`batch_duration`) are not used.
- Every threshold sits in one block at the top of `ews.py`.

**Why not ML, anomaly detection, or clustering.** There's no labelled "did not learn" outcome to train on. Three rules can be explained to a partner in one sentence each and audited in Excel. They already separate the problem cohorts clearly (see §4).

## 4. EWS results on the supplied data

**Students (1,866 completers) [Data]:**

| Category | Students | Share |
|---|---|---|
| On track | 1,163 | 62% |
| Watch | 364 | 20% |
| High Risk | 339 | 18% |

- Median completion was 24 days, against 25 planned. **Most students are not fast.**
- 10% finished in under half the planned time.
- 21% did all assessments on ≤ 2 days.
- 30% logged < 50% of lessons.
- Only **30 students (1.6%) are "Fast only"**, the likely genuine fast learners. **Genuine fast learning is rare. Most speed comes with skipped content.**

**Partners [Data]:**

| Partner | Completers | % High Risk | Alert |
|---|---|---|---|
| TRIMEX Colleges – SHS | 117 | **88%** | 🔴 Red |
| Trimex Colleges | 43 | **58%** | 🔴 Red |
| Citi Global College SHS | 1,691 | 12% | 🟢 Green (but has Red cohorts inside) |
| NU Dasmariñas | 15 | 7% | 🟢 Green |
| MSEUF | 0 | – | ⚪ No completers yet |

**Cohorts:** 58 rated. 🔴 10 · 🟠 12 · 🟢 36. Another 20 are too small to rate.

**Examples of flagged groups:**

- **TRIMEX SHS, all 4 rated sections are Red (84–100%).**
  - Median assessment span of 1 day.
  - About 4% of lessons logged.
  - Average score 95%.
  - This is the clearest case. It is either assessment-only completion, or content delivered offline and not tracked. Verification decides which.
- **TRIMEX SHS "G12 ABM B – JACINTO" is 100% High Risk, but its median completion time is a normal 22 days.**
  - Students joined, went quiet, then did every assessment in 1–2 days without the lessons.
  - This is why speed alone would have missed it.
- **Citi "LATE ENROLLEES" (77%) and "LATE ENROLLEESS" (60%) are Red.**
  - Both had 15-day batch windows.
  - Late joiners were squeezed into a short window.
- **Citi schedule effect [Data, descriptive only]:**
  - Rated cohorts with windows of ≤ 20 days: median 24% High Risk.
  - Rated cohorts with windows of 30–60 days: median 7%.
  - This is correlation, not proof. It still justifies checking batch schedules at setup.
- **Quiz scores:** High Risk median 95, On track median 92.
  - **Assessments currently can't tell a rushed learner from an engaged one.** That is a finding in its own right.

**What the data cannot tell us:** whether students actually learned (no independent assessment), why lessons are missing (skipping or offline delivery), or any employment outcome.

---

## 5. Logic explanation (½ page)

**Method.** A rule-based EWS on LMS data that already exists. It takes each completer's pacing and engagement record, turns it into a risk category, rolls that up to cohort and partner alerts, and links each alert to an action.

**Pacing model.** Expected duration = course learning hours ÷ planned weekly hours (109 h ÷ 30 h ≈ 25 days). This is the programme's own plan, so it's defensible with partners, and it doesn't move when a whole cohort rushes.

**Thresholds.**

- **Student signals:**
  - Fast: < 50% of planned time.
  - Compressed: all assessments on ≤ 2 days.
  - Low lesson coverage: < 50% of lessons.
- **Student categories:** 1 signal = Watch, 2 or more = High Risk.
- **Cohort and partner alerts** (% of completers High Risk): Red ≥ 30%, Amber ≥ 15%.
- **Minimum size:** 10 completers to rate a cohort.
- **Why these values:** they are round, memorable cut-offs, not optimised values. On this data they separate a small group of clearly problematic cohorts (TRIMEX, the late-enrollee batches) from a large clean base.

**Assumptions.**

1. `course_duration_hours.1` and `hours_week` reflect the intended learning load and schedule.
2. Lessons are meant to be completed in the LMS, so logged lessons are a fair proxy for engagement.
3. Day-level dates are accurate.
4. COMPLETED status is how graduates are counted today.

**Why this approach fits.** It uses fields the LMS already produces, and a programme officer can reproduce it in Excel. Each flag can be explained to a partner in one sentence. It separates *speed* (which can be legitimate) from *missing evidence of learning* (the real concern). The rule is transparent, and a flag leads to verification, never to automatic penalties. So it's safe to act on even where the underlying assumptions turn out to be imperfect.

---

## 6. SOP — Early Completion EWS (½ page)

**Frequency.**

- Run **every two weeks** while batches are live. Most batches run 2–6 weeks, so this catches a batch before it closes.
- Run a **final check at batch close**, before completions are reported upward.
- Run a quarterly review of the thresholds themselves.

**Owner.** The Impact Measurement Sr. Associate runs the EWS and publishes the dashboard and Excel output.

**Alert rules, recipients, and actions:**

| Alert | Recipient | Action | Timeline |
|---|---|---|---|
| 🔴 **Red cohort / partner** | Programme Manager for the partner + Impact Measurement lead; partner coordinator in copy | 1) Check the data (LMS extract, offline delivery?) 2) Review call with partner & faculty 3) Proctored re-assessment of a random sample (~10 students or 20%) 4) **Hold** graduate reporting for its High-Risk students until verified | Call within 5 working days; verification closed within 3 weeks |
| 🟠 **Amber cohort** | Programme Manager | Check batch schedule (window vs planned hours) and facilitation with faculty; nudge flagged students to complete lessons | Before next run |
| 🟢 **Green** | – | No action; included in regular reporting | – |
| ⚪ **Too small** | Programme Manager | Review flagged students individually; judged within partner roll-up | Next run |
| **High-Risk student** (any cohort) | Faculty via Programme Manager | Counted as "completed – pending verification", not as graduate, until they pass verification or finish the missing lessons | Within cohort cycle |
| **Watch student** | – | Counted as graduate; included in 10% random spot-check pool | – |

**Escalation.**

- A partner Red for **2 consecutive batches**, or one that refuses verification, goes to the Country Head.
- Until that's resolved, the partner's completions are reported separately and marked "unverified".
- A remediation plan is agreed: batch windows no shorter than planned duration, lesson gating, supervised assessment.

**After an alert.**

- Every Red alert is logged: date, cohort, finding (rushed / offline delivery / data error), action, outcome.
- If verification shows the students did learn (for example, offline teaching), mark it as a false positive. Fix the data source, or note the exception for that partner.
- The **false-positive rate feeds the quarterly threshold review.** Change thresholds only there, never ad hoc.

**Prevention [Rec].** At batch setup, the programme team rejects batch windows shorter than planned duration (e.g. 16 days for 109 h). It's the cheapest fix in the system.

---

## 7. Outcome linkage notes

**1. Should fast completers be counted as graduates?**

Not automatically. Speed isn't the problem, so fast completers shouldn't be excluded. Unverified completion is the problem. **[Rec]** A three-tier count:

- On track and Watch count as **graduates**.
- High Risk count as **"completed – pending verification"** until they pass a proctored summative or finish the missing lessons.
- Report both numbers.

On this data that would move ~18% of completions (339) into pending. Reporting them as graduates today would overstate learning outcomes. Excluding them outright would penalise the ~1.6% of genuine fast learners and anyone taught offline.

**2. How to ensure completion reflects genuine readiness?**

- **Gate progression:** a module assessment unlocks only after a minimum share of its lessons is done. This is an LMS setting, so no new system.
- **Make the summative mean something:**
  - Proctored or faculty-supervised.
  - Drawn from a question bank, so students can't reuse answers.
  - Includes an applied task (mock interview, CV) scored against a simple rubric.
- **Minimum duration floor:** a batch can't be closed, and a student can't be certified, before a set share of planned time has passed (e.g. 50%).
- **Validate the assessment itself:** scores are currently the same whether or not lessons were done. Check a sample of students with an independent short test or employer-style task once a year.

**3. Scalable employment verification**

- **Tiered verification:**
  - Self-report from all graduates, via SMS or Messenger survey at 3 and 6 months, reusing the existing LMS fields (employer, sector, start date).
  - Independent verification of a **random, stratified sample (~10%)**, stratified by partner and by EWS risk tier, through a call to the graduate plus proof: an employment certificate, payslip, or employer call.
  - Where the graduate consents, a check against government records (e.g. SSS/PhilHealth contribution records). This depends on data-sharing agreements.
- **Attribution rules:** an employment start date before enrolment counts as *prior employment*, not a programme outcome. Several such cases exist in this extract.
- **Partner reports:** partners report placements with evidence. The verified sample gives a **verification rate**, and each partner's claimed numbers are adjusted by it.

**4. Governance controls against inflated reporting**

- **Separate duties:** the partner reports, programme teams support, and Impact Measurement verifies and publishes. Programme targets are never self-certified.
- **Fixed definitions:** one written definition each for *graduate*, *verified graduate*, and *placed*, applied the same way to every partner.
- **Report both numbers:** reported vs verified completions and placements, side by side, for each partner.
- **Audit trail:** the EWS alert log and verification results are kept and reviewed quarterly by the Country Head.
- **Incentive check:** where partner payments or targets are tied to completions, tie them to **verified** completions.
- **Data controls:** a monthly extract, with a validation checklist for impossible dates, empty required fields, and test batches.

**5. Risks if unaddressed, and mitigation**

| Risk | Mitigation |
|---|---|
| **Inflated impact claims**: completion and placement numbers that don't reflect skills, which hurts credibility with funders and government | Verified vs reported split; sample verification |
| **Weak employability**: graduates reach employers without the skills, which damages employer trust and future placements | Lesson gating; proctored summative; applied task |
| **Perverse incentives**: partners optimise for completion counts | Tie incentives to verified outcomes; EWS escalation |
| **Unfair penalties**: genuine fast learners, or partners teaching offline, get penalised | Flags trigger verification, not sanctions; false-positive log |
| **Bad decisions from bad data**: e.g. scaling a partner that "performs" on paper | Data-quality checks; partner scorecards on verified data |

---

## 8. Senior leadership presentation (5 slides)

**Slide 1 — The problem: completions are up, but is learning?**
- In some cohorts, students finish the 109-hour course far faster than the planned ~25 days.
- The risk: we report graduates who haven't learned, which hurts credibility and employability.
- Our question: which partners and cohorts need verification before we count their completions?

**Slide 2 — What the data shows** *(visual: bar of % High Risk by partner)*
- 1,866 completers reviewed across 5 partners and 58 rated cohorts.
- **18% of completers show a high-risk pattern.** It's concentrated: TRIMEX SHS 88%, Trimex Colleges 58%, and 2 late-enrollee batches at Citi.
- 30% of completers passed while logging under half the lessons, and **their quiz scores are just as high.** Today's assessments can't tell rushing from learning.
- Genuine fast learners are rare (~2%).

**Slide 3 — The Early Warning System: three simple checks**
- Too fast (< half planned time) · all assessments crammed into ≤ 2 days · under half the lessons done.
- One check = Watch; two or more = High Risk.
- A cohort is Red if ≥ 30% of its completers are High Risk.
- It runs every two weeks on existing LMS data. No new system needed. *(visual: 3 icons → traffic light)*

**Slide 4 — What happens on an alert**
- Red → partner call within 5 days, sample re-assessment, High-Risk completions held as "pending verification".
- Amber → check the batch schedule and facilitation.
- Escalate to the Country Head after 2 Red batches in a row.
- Governance: report *verified* and *reported* graduates side by side; tie partner targets to verified numbers.

**Slide 5 — Impact & decisions needed**
- Expected result: headline numbers we can defend. Problems are caught while the batch is still running, not after reporting.
- **Decisions requested:**
  1. Adopt the three-tier graduate definition.
  2. Require batch windows no shorter than planned course duration.
  3. Turn on LMS lesson-gating and a supervised summative.
  4. Fund a 10% employment verification sample.
- Next 90 days: validate with TRIMEX (offline delivery?), run 2 cycles, recalibrate thresholds.

---

## 9. Likely interview challenges

1. **"Why 50% / 30% / 15%? Aren't those arbitrary?"** They are judgement-based round numbers, chosen to be memorable, not statistically optimised. On this data they cleanly isolate the obvious problem cohorts. The SOP recalibrates them from the false-positive log after two cycles. With no ground-truth labels, a "fitted" threshold would only look more precise.
2. **"Low lesson coverage might just be offline teaching."** Agreed. That's the main assumption, and why a flag leads to verification rather than a penalty. TRIMEX is the first thing to check.
3. **"Is 30 hours/week a realistic planned pace?"** It's the LMS value. If the true plan is lower, planned duration gets longer and more students look fast. So the current setting is conservative.
4. **"Why not a relative (peer-based) threshold?"** Because the concern is whole partners rushing. A peer baseline would treat that as normal. Peer comparison is still visible in the dashboard.
5. **"Join date isn't really start date."** True. That's why speed is only one of the three signals. The JACINTO example shows the other two catching what speed misses.
6. **"Citi is 86% of the data. Does this generalise?"** The rules are course-agnostic (hours ÷ weekly hours), but thresholds should be rechecked as partners with different courses (e.g. the 75-hour course) produce completers.
7. **"This only rates completers. What about early warning during the course?"** It runs every two weeks mid-batch, so High-Risk completions surface while the batch is live. Flagging in-progress students who are pacing too fast is a natural next step. I left it out of this prototype.
8. **"Is the schedule effect causal?"** No. It's a descriptive difference in one partner, and I've presented it that way. It's still a cheap, low-risk fix.
