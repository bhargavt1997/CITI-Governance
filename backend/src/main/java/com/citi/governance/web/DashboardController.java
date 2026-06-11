package com.citi.governance.web;

import com.citi.governance.model.Candidate;
import com.citi.governance.model.OnboardingStage;
import com.citi.governance.model.StageHistory;
import com.citi.governance.model.Timesheet;
import com.citi.governance.repo.CandidateRepository;
import com.citi.governance.repo.StageHistoryRepository;
import com.citi.governance.repo.TimesheetRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.format.DateTimeFormatter;
import java.util.*;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    private static final DateTimeFormatter MONTH = DateTimeFormatter.ofPattern("yyyy-MM");

    private final CandidateRepository candidates;
    private final StageHistoryRepository history;
    private final TimesheetRepository timesheets;

    public DashboardController(CandidateRepository candidates, StageHistoryRepository history,
                               TimesheetRepository timesheets) {
        this.candidates = candidates;
        this.history = history;
        this.timesheets = timesheets;
    }

    @GetMapping("/summary")
    public Map<String, Object> summary() {
        List<Candidate> all = candidates.findAll();

        long total = all.size();
        long caratCleared = all.stream()
                .filter(c -> c.getCurrentStage().ordinal() >= OnboardingStage.CLIENT_INTERVIEW.ordinal()).count();
        long selected = all.stream()
                .filter(c -> c.getCurrentStage().ordinal() >= OnboardingStage.FINAL_SELECTION.ordinal()).count();
        long onboarded = all.stream()
                .filter(c -> c.getCurrentStage() == OnboardingStage.ONBOARDED).count();
        long nominated = all.stream()
                .filter(c -> c.getCurrentStage() == OnboardingStage.NOMINATED).count();
        long inPipeline = total - onboarded;

        Map<String, Long> stageBreakdown = new LinkedHashMap<>();
        for (OnboardingStage s : OnboardingStage.values()) {
            stageBreakdown.put(s.getLabel(),
                    all.stream().filter(c -> c.getCurrentStage() == s).count());
        }

        // Monthly trend: nominations and onboardings per month from the audit trail
        Map<String, long[]> trendByMonth = new TreeMap<>();
        for (StageHistory h : history.findAllByOrderByCompletedAtAsc()) {
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

        // PTS hours per month
        Map<String, Double> ptsByMonthMap = new TreeMap<>();
        for (Timesheet t : timesheets.findAll()) {
            ptsByMonthMap.merge(t.getMonth(), t.getTotal() == null ? 0.0 : t.getTotal(), Double::sum);
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
        out.put("stageBreakdown", stageBreakdown);
        out.put("monthlyTrends", monthlyTrends);
        out.put("ptsByMonth", ptsByMonth);
        return out;
    }
}
