package com.citi.governance.web;

import com.citi.governance.auth.AuthService;
import com.citi.governance.model.Candidate;
import com.citi.governance.model.Metric;
import com.citi.governance.repo.CandidateRepository;
import com.citi.governance.repo.MetricRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/** Monthly delivery metrics (GitHub commits, Jira stories/points, work highlights). */
@RestController
@RequestMapping("/api/metrics")
public class MetricController {

    private final MetricRepository metrics;
    private final CandidateRepository candidates;
    private final AuthService auth;

    public MetricController(MetricRepository metrics, CandidateRepository candidates, AuthService auth) {
        this.metrics = metrics;
        this.candidates = candidates;
        this.auth = auth;
    }

    @GetMapping
    public List<Metric> list(@RequestParam(required = false) String month,
                             @RequestParam(required = false) Long candidateId) {
        if (candidateId != null && month != null) {
            return metrics.findByCandidateIdAndMonth(candidateId, month).map(List::of).orElse(List.of());
        }
        if (candidateId != null) {
            return metrics.findByCandidateIdOrderByMonthAsc(candidateId);
        }
        if (month != null) {
            return metrics.findByMonth(month);
        }
        return metrics.findAll();
    }

    /** Upsert: one row per person per month. Everyone fills in their own metrics and highlights. */
    @PostMapping
    public Metric save(@RequestBody Map<String, Object> body, HttpServletRequest req) {
        Long candidateId = ((Number) body.get("candidateId")).longValue();
        // You record only your own metrics.
        auth.requireSelf(req, candidateId);
        String month = (String) body.get("month");
        if (month == null || !month.matches("\\d{4}-\\d{2}")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "month must be yyyy-MM");
        }
        Candidate c = candidates.findById(candidateId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Candidate not found"));

        Metric m = metrics.findByCandidateIdAndMonth(candidateId, month).orElseGet(() -> {
            Metric nm = new Metric();
            nm.setCandidate(c);
            nm.setMonth(month);
            return nm;
        });
        m.setGithubCommits(count(body.get("githubCommits")));
        m.setStoriesAssigned(count(body.get("storiesAssigned")));
        m.setStoriesCompleted(count(body.get("storiesCompleted")));
        m.setStoryPointsAssigned(count(body.get("storyPointsAssigned")));
        m.setStoryPointsCompleted(count(body.get("storyPointsCompleted")));
        Object hl = body.get("highlights");
        m.setHighlights(hl == null ? null : hl.toString().trim());
        m.setUpdatedAt(LocalDateTime.now());
        return metrics.save(m);
    }

    private Integer count(Object o) {
        if (o == null) return 0;
        int v = ((Number) o).intValue();
        if (v < 0 || v > 100000) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "values must be between 0 and 100000");
        }
        return v;
    }
}
