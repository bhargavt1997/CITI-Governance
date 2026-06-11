package com.citi.governance.web;

import com.citi.governance.model.Candidate;
import com.citi.governance.model.Timesheet;
import com.citi.governance.repo.CandidateRepository;
import com.citi.governance.repo.TimesheetRepository;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/timesheets")
public class TimesheetController {

    private final TimesheetRepository timesheets;
    private final CandidateRepository candidates;

    public TimesheetController(TimesheetRepository timesheets, CandidateRepository candidates) {
        this.timesheets = timesheets;
        this.candidates = candidates;
    }

    @GetMapping
    public List<Timesheet> list(@RequestParam(required = false) String month,
                                @RequestParam(required = false) Long candidateId) {
        if (candidateId != null && month != null) {
            return timesheets.findByCandidateIdAndMonth(candidateId, month).map(List::of).orElse(List.of());
        }
        if (candidateId != null) {
            return timesheets.findByCandidateIdOrderByMonthAsc(candidateId);
        }
        if (month != null) {
            return timesheets.findByMonth(month);
        }
        return timesheets.findAll();
    }

    /** Upsert: one row per candidate per month. Total is always recalculated server-side. */
    @PostMapping
    public Timesheet save(@RequestBody Map<String, Object> body) {
        Long candidateId = ((Number) body.get("candidateId")).longValue();
        String month = (String) body.get("month");
        if (month == null || !month.matches("\\d{4}-\\d{2}")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "month must be yyyy-MM");
        }
        Candidate c = candidates.findById(candidateId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Candidate not found"));

        Timesheet t = timesheets.findByCandidateIdAndMonth(candidateId, month).orElseGet(() -> {
            Timesheet nt = new Timesheet();
            nt.setCandidate(c);
            nt.setMonth(month);
            return nt;
        });
        t.setWeek1(num(body.get("week1")));
        t.setWeek2(num(body.get("week2")));
        t.setWeek3(num(body.get("week3")));
        t.setWeek4(num(body.get("week4")));
        t.setWeek5(num(body.get("week5")));
        t.recalcTotal();
        t.setUpdatedAt(LocalDateTime.now());
        return timesheets.save(t);
    }

    private Double num(Object o) {
        if (o == null) return 0.0;
        double v = ((Number) o).doubleValue();
        if (v < 0 || v > 168) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "weekly hours must be between 0 and 168");
        }
        return v;
    }
}
