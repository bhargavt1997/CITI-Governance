package com.citi.governance.web;

import com.citi.governance.auth.AuthService;
import com.citi.governance.model.AppUser;
import com.citi.governance.model.Bands;
import com.citi.governance.model.Candidate;
import com.citi.governance.model.Metric;
import com.citi.governance.model.OnboardingStage;
import com.citi.governance.model.Role;
import com.citi.governance.model.StageHistory;
import com.citi.governance.model.Timesheet;
import com.citi.governance.model.TimesheetStatus;
import com.citi.governance.repo.CandidateRepository;
import com.citi.governance.repo.MetricRepository;
import com.citi.governance.repo.StageHistoryRepository;
import com.citi.governance.repo.TimesheetRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    private static final DateTimeFormatter MONTH = DateTimeFormatter.ofPattern("yyyy-MM");

    private final CandidateRepository candidates;
    private final StageHistoryRepository history;
    private final TimesheetRepository timesheets;
    private final MetricRepository metrics;
    private final AuthService auth;

    public DashboardController(CandidateRepository candidates, StageHistoryRepository history,
                               TimesheetRepository timesheets, MetricRepository metrics, AuthService auth) {
        this.candidates = candidates;
        this.history = history;
        this.timesheets = timesheets;
        this.metrics = metrics;
        this.auth = auth;
    }

    @GetMapping("/summary")
    public Map<String, Object> summary(HttpServletRequest request) {
        AppUser user = auth.current(request);
        List<Candidate> everyone = candidates.findAll();
        // Scope the dashboard to what this user manages so the numbers match Onboarding/Approvals:
        //  - managers/senior managers see everyone who reports to them (including manager reportees)
        //  - developers see only themselves
        List<Candidate> all;
        if (user.getRole() == Role.MANAGER) {
            all = everyone.stream()
                    .filter(c -> user.getName().equalsIgnoreCase(c.getReportingManager()))
                    .toList();
        } else {
            all = everyone.stream()
                    .filter(c -> c.getId().equals(user.getCandidateId()))
                    .toList();
        }
        Set<Long> candidateIds = all.stream().map(Candidate::getId).collect(Collectors.toSet());

        long total = all.size();
        long caratCleared = all.stream()
                .filter(c -> c.getCurrentStage().ordinal() >= OnboardingStage.CLIENT_INTERVIEW.ordinal()).count();
        long selected = all.stream()
                .filter(c -> c.getCurrentStage().ordinal() >= OnboardingStage.FINAL_SELECTION.ordinal()).count();
        long onboarded = all.stream()
                .filter(c -> c.getCurrentStage() == OnboardingStage.ONBOARDED).count();
        long nominated = all.stream()
                .filter(c -> c.getCurrentStage() == OnboardingStage.NOMINATED).count();
        long karatFailed = all.stream()
                .filter(c -> c.getCurrentStage() == OnboardingStage.KARAT_FAILED).count();
        long inPipeline = total - onboarded;

        Map<String, Long> stageBreakdown = new LinkedHashMap<>();
        for (OnboardingStage s : OnboardingStage.values()) {
            stageBreakdown.put(s.getLabel(),
                    all.stream().filter(c -> c.getCurrentStage() == s).count());
        }

        // Monthly trend: nominations and onboardings per month from the audit trail
        Map<String, long[]> trendByMonth = new TreeMap<>();
        for (StageHistory h : history.findAllByOrderByCompletedAtAsc()) {
            if (h.getCandidate() == null || !candidateIds.contains(h.getCandidate().getId())) continue;
            String m = h.getCompletedAt().format(MONTH);
            long[] row = trendByMonth.computeIfAbsent(m, k -> new long[2]);
            if (h.getStage() == OnboardingStage.NOMINATED) row[0]++;
            if (h.getStage() == OnboardingStage.ONBOARDED) row[1]++;
        }
        List<Map<String, Object>> monthlyTrends = new ArrayList<>();
        trendByMonth.forEach((m, row) -> {
            Map<String, Object> e = new LinkedHashMap<>();
            e.put("month", m);
            e.put("nominated", row[0]);
            e.put("onboarded", row[1]);
            monthlyTrends.add(e);
        });

        // PTS hours for the current year (all 12 months) + pending approvals - scoped to the same
        // candidates as the funnel, so the numbers match the Approvals tab.
        int year = java.time.LocalDate.now().getYear();
        Map<String, Double> ptsByMonthMap = new LinkedHashMap<>();
        for (int mo = 1; mo <= 12; mo++) {
            ptsByMonthMap.put(String.format("%d-%02d", year, mo), 0.0);
        }
        Long ownId = user.getCandidateId();
        long pendingApprovals = 0;
        for (Timesheet t : timesheets.findAll()) {
            Long cid = t.getCandidate() == null ? null : t.getCandidate().getId();
            if (cid == null) continue;
            // Approvals you owe - your direct reports' submitted timesheets.
            if (candidateIds.contains(cid) && (t.getStatus() == null || t.getStatus() == TimesheetStatus.SUBMITTED)) {
                pendingApprovals++;
            }
            // PTS hours chart - your own monthly hours.
            if (ownId != null && ownId.equals(cid) && t.getMonth() != null && ptsByMonthMap.containsKey(t.getMonth())) {
                ptsByMonthMap.merge(t.getMonth(), t.getTotal() == null ? 0.0 : t.getTotal(), Double::sum);
            }
        }
        List<Map<String, Object>> ptsByMonth = new ArrayList<>();
        ptsByMonthMap.forEach((m, hours) -> {
            Map<String, Object> e = new LinkedHashMap<>();
            e.put("month", m);
            e.put("hours", hours);
            ptsByMonth.add(e);
        });

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("totalCandidates", total);
        out.put("nominated", nominated);
        out.put("caratCleared", caratCleared);
        out.put("totalSelected", selected);
        out.put("onboarded", onboarded);
        out.put("inPipeline", inPipeline);
        out.put("karatFailed", karatFailed);
        out.put("pendingApprovals", pendingApprovals);
        out.put("stageBreakdown", stageBreakdown);
        out.put("monthlyTrends", monthlyTrends);
        out.put("ptsByMonth", ptsByMonth);
        return out;
    }

    private static final int LOW_GT_THRESHOLD = 20;
    private static final int LOW_GT_MONTHS = 3;

    /**
     * Risk view for top-level leadership (band B4L+). Returns the Deloitte reporting chain rooted at
     * the signed-in leader (the CEO sees the whole org), with risk rolled up over each manager's
     * entire team so leaders can drill in to find where the risk is. CITI leadership (Gonzalo /
     * Joshua) is carried on every node as a separate dimension, plus a compact per-CITI summary.
     */
    @GetMapping("/risk")
    public Map<String, Object> risk(HttpServletRequest request) {
        AppUser user = auth.current(request);
        Candidate self = user.getCandidateId() == null ? null
                : candidates.findById(user.getCandidateId()).orElse(null);
        if (self == null || !Bands.isLeadershipBand(self.getBand())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Leadership access only");
        }

        Set<Long> lowGtIds = lowGtCandidateIds();

        // Direct reports indexed by the (case-insensitive) manager name.
        Map<String, List<Candidate>> reportsByManager = new HashMap<>();
        for (Candidate c : candidates.findAll()) {
            String mgr = c.getReportingManager();
            if (mgr != null && !mgr.isBlank()) {
                reportsByManager.computeIfAbsent(mgr.trim().toLowerCase(), k -> new ArrayList<>()).add(c);
            }
        }

        // Build the tree rooted at the signed-in leader. `subtree` collects everyone in their org.
        List<Candidate> subtree = new ArrayList<>();
        Map<String, Object> root = buildNode(self, reportsByManager, lowGtIds, new HashSet<>(), subtree);

        // Headline numbers + stage breakdown, scoped to the leader's org (the subtree).
        Map<String, Object> org = new LinkedHashMap<>();
        org.put("total", subtree.size());
        org.put("onboarded", countStage(subtree, OnboardingStage.ONBOARDED));
        org.put("inPipeline", subtree.stream().filter(c -> isInPipeline(c.getCurrentStage())).count());
        org.put("karatFailed", countStage(subtree, OnboardingStage.KARAT_FAILED));
        org.put("offboarding", subtree.stream().filter(c -> isOffboarding(c.getCurrentStage())).count());
        org.put("lowGt", subtree.stream().filter(c -> lowGtIds.contains(c.getId())).count());

        Map<String, Long> stageBreakdown = new LinkedHashMap<>();
        for (OnboardingStage s : OnboardingStage.values()) {
            long n = subtree.stream().filter(c -> c.getCurrentStage() == s).count();
            if (n > 0) stageBreakdown.put(s.getLabel(), n);
        }

        // Compact CITI leadership comparison over the same subtree.
        Map<String, List<Candidate>> byCiti = subtree.stream()
                .collect(Collectors.groupingBy(c -> orUnassigned(c.getCitiLeadership()),
                        LinkedHashMap::new, Collectors.toList()));
        List<Map<String, Object>> citiSummary = new ArrayList<>();
        byCiti.forEach((leader, people) -> {
            Map<String, Object> m = riskCounts(people, lowGtIds);
            m.put("name", leader);
            m.put("people", people.size());
            citiSummary.add(m);
        });
        citiSummary.sort((a, b) -> Integer.compare((int) b.get("riskScore"), (int) a.get("riskScore")));

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("org", org);
        out.put("stageBreakdown", stageBreakdown);
        out.put("citiSummary", citiSummary);
        out.put("root", root);
        return out;
    }

    /**
     * Recursively build a risk-tree node for a person. Counts roll up over {self + all descendants}.
     * `visited` guards against cycles in the (ring-linked) manager reporting lines; `collected`
     * accumulates every candidate in this subtree for the caller's org-wide totals.
     */
    private Map<String, Object> buildNode(Candidate c, Map<String, List<Candidate>> reportsByManager,
                                          Set<Long> lowGtIds, Set<Long> visited, List<Candidate> collected) {
        visited.add(c.getId());
        collected.add(c);

        List<Map<String, Object>> reports = new ArrayList<>();
        List<Candidate> directs = reportsByManager.getOrDefault(c.getName().trim().toLowerCase(), List.of());
        // Roll up risk over the whole subtree: start with this person, add each child's rollup.
        int karatFailed = c.getCurrentStage() == OnboardingStage.KARAT_FAILED ? 1 : 0;
        int offboarding = isOffboarding(c.getCurrentStage()) ? 1 : 0;
        int lowGt = lowGtIds.contains(c.getId()) ? 1 : 0;
        int teamSize = 1;

        for (Candidate child : directs) {
            if (visited.contains(child.getId())) continue; // break cycles
            Map<String, Object> childNode = buildNode(child, reportsByManager, lowGtIds, visited, collected);
            reports.add(childNode);
            karatFailed += (int) childNode.get("karatFailed");
            offboarding += (int) childNode.get("offboarding");
            lowGt += (int) childNode.get("lowGt");
            teamSize += (int) childNode.get("teamSize");
        }
        // Riskiest reports first.
        reports.sort((a, b) -> Integer.compare((int) b.get("riskScore"), (int) a.get("riskScore")));

        int riskScore = karatFailed + offboarding + lowGt;

        Map<String, Object> node = new LinkedHashMap<>();
        node.put("candidateId", c.getId());
        node.put("name", c.getName());
        node.put("band", c.getBand());
        node.put("role", c.getRole() == null ? null : c.getRole().name());
        node.put("stage", c.getCurrentStage() == null ? null : c.getCurrentStage().name());
        node.put("reportingManager", c.getReportingManager());
        node.put("citiLeadership", c.getCitiLeadership());
        node.put("teamSize", teamSize);
        node.put("directReports", directs.size());
        node.put("karatFailed", karatFailed);
        node.put("offboarding", offboarding);
        node.put("lowGt", lowGt);
        node.put("riskScore", riskScore);
        node.put("riskLevel", riskLevel(riskScore));
        node.put("reports", reports);
        return node;
    }

    /** Equal-weight risk counts + level for a flat set of people (used for the CITI summary). */
    private Map<String, Object> riskCounts(List<Candidate> people, Set<Long> lowGtIds) {
        int karatFailed = (int) countStage(people, OnboardingStage.KARAT_FAILED);
        int offboarding = (int) people.stream().filter(c -> isOffboarding(c.getCurrentStage())).count();
        int lowGt = (int) people.stream().filter(c -> lowGtIds.contains(c.getId())).count();
        int riskScore = karatFailed + offboarding + lowGt;
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("karatFailed", karatFailed);
        m.put("offboarding", offboarding);
        m.put("lowGt", lowGt);
        m.put("riskScore", riskScore);
        m.put("riskLevel", riskLevel(riskScore));
        return m;
    }

    /** Equal-weight risk = count of at-risk people; level scales with the headcount at risk. */
    private static String riskLevel(int riskScore) {
        return riskScore == 0 ? "Low" : riskScore <= 2 ? "Medium" : "High";
    }

    private static boolean isOffboarding(OnboardingStage s) {
        return s == OnboardingStage.OFFBOARDING || s == OnboardingStage.OFFBOARDED;
    }

    /** Candidate ids whose GitHub commits were below the threshold for the last N consecutive months. */
    private Set<Long> lowGtCandidateIds() {
        List<String> recentMonths = new ArrayList<>();
        LocalDate now = LocalDate.now();
        for (int off = 0; off < LOW_GT_MONTHS; off++) recentMonths.add(now.minusMonths(off).format(MONTH));

        Set<Long> ids = new HashSet<>();
        for (Candidate c : candidates.findByCurrentStage(OnboardingStage.ONBOARDED)) {
            Map<String, Integer> commitsByMonth = new HashMap<>();
            for (Metric m : metrics.findByCandidateIdOrderByMonthAsc(c.getId())) {
                commitsByMonth.put(m.getMonth(), m.getGithubCommits() == null ? 0 : m.getGithubCommits());
            }
            boolean lowAllMonths = true;
            for (String month : recentMonths) {
                Integer commits = commitsByMonth.get(month);
                if (commits == null || commits >= LOW_GT_THRESHOLD) { lowAllMonths = false; break; }
            }
            if (lowAllMonths) ids.add(c.getId());
        }
        return ids;
    }

    private static long countStage(List<Candidate> people, OnboardingStage stage) {
        return people.stream().filter(c -> c.getCurrentStage() == stage).count();
    }

    private static boolean isInPipeline(OnboardingStage s) {
        return s != OnboardingStage.ONBOARDED
                && s != OnboardingStage.OFFBOARDING && s != OnboardingStage.OFFBOARDED;
    }

    private static String orUnassigned(String s) {
        return (s == null || s.isBlank()) ? "Unassigned" : s;
    }
}
