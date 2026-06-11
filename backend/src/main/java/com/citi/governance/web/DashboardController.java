package com.citi.governance.web;

import com.citi.governance.auth.AuthService;
import com.citi.governance.model.AppUser;
import com.citi.governance.model.Candidate;
import com.citi.governance.model.OnboardingStage;
import com.citi.governance.model.Role;
import com.citi.governance.model.StageHistory;
import com.citi.governance.model.Timesheet;
import com.citi.governance.model.TimesheetStatus;
import com.citi.governance.repo.CandidateRepository;
import com.citi.governance.repo.StageHistoryRepository;
import com.citi.governance.repo.TimesheetRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

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
    private final AuthService auth;

    public DashboardController(CandidateRepository candidates, StageHistoryRepository history,
                               TimesheetRepository timesheets, AuthService auth) {
        this.candidates = candidates;
        this.history = history;
        this.timesheets = timesheets;
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
}
