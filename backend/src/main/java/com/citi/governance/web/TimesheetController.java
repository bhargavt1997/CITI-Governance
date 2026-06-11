package com.citi.governance.web;

import com.citi.governance.auth.AuthService;
import com.citi.governance.model.AppUser;
import com.citi.governance.model.Candidate;
import com.citi.governance.model.Timesheet;
import com.citi.governance.model.TimesheetStatus;
import com.citi.governance.repo.CandidateRepository;
import com.citi.governance.repo.TimesheetRepository;
import jakarta.servlet.http.HttpServletRequest;
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
    private final AuthService auth;

    public TimesheetController(TimesheetRepository timesheets, CandidateRepository candidates, AuthService auth) {
        this.timesheets = timesheets;
        this.candidates = candidates;
        this.auth = auth;
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
    public Timesheet save(@RequestBody Map<String, Object> body, HttpServletRequest req) {
        Long candidateId = ((Number) body.get("candidateId")).longValue();
        auth.requireLeadOrSelf(req, candidateId);
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
        // Every save (re)submits the sheet for manager approval
        t.setStatus(TimesheetStatus.SUBMITTED);
        t.setApprovedBy(null);
        t.setApprovedAt(null);
        t.setUpdatedAt(LocalDateTime.now());
        return timesheets.save(t);
    }

    /** Manager decision on a submitted timesheet. Leads only. */
    @PostMapping("/{id}/decision")
    public Timesheet decide(@PathVariable Long id, @RequestBody Map<String, Object> body, HttpServletRequest req) {
        AppUser lead = auth.requireLead(req);
        Timesheet t = timesheets.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Timesheet not found"));
        boolean approved = Boolean.TRUE.equals(body.get("approved"));
        t.setStatus(approved ? TimesheetStatus.APPROVED : TimesheetStatus.REJECTED);
        t.setApprovedBy(lead.getName());
        t.setApprovedAt(LocalDateTime.now());
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
