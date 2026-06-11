package com.citi.governance.web;

import com.citi.governance.auth.AuthService;
import com.citi.governance.model.*;
import com.citi.governance.repo.CandidateRepository;
import com.citi.governance.repo.EnrollmentRepository;
import com.citi.governance.repo.TrainingRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class TrainingController {

    private final TrainingRepository trainings;
    private final EnrollmentRepository enrollments;
    private final CandidateRepository candidates;
    private final AuthService auth;

    public TrainingController(TrainingRepository trainings, EnrollmentRepository enrollments,
                              CandidateRepository candidates, AuthService auth) {
        this.trainings = trainings;
        this.enrollments = enrollments;
        this.candidates = candidates;
        this.auth = auth;
    }

    @GetMapping("/trainings")
    public List<Map<String, Object>> list() {
        return trainings.findAll().stream().map(t -> {
            Map<String, Object> m = new HashMap<>();
            m.put("training", t);
            m.put("enrolledCount", enrollments.countByTraining_Id(t.getId()));
            return m;
        }).toList();
    }

    @GetMapping("/trainings/{id}")
    public Map<String, Object> detail(@PathVariable Long id) {
        Training t = trainings.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Training not found"));
        Map<String, Object> m = new HashMap<>();
        m.put("training", t);
        m.put("enrollments", enrollments.findByTraining_Id(id));
        return m;
    }

    @PostMapping("/trainings")
    @ResponseStatus(HttpStatus.CREATED)
    public Training create(@RequestBody Training t, HttpServletRequest req) {
        AppUser manager = auth.requireManager(req);
        t.setId(null);
        t.setCreatedBy(manager.getName());
        return trainings.save(t);
    }

    @PostMapping("/trainings/{id}/enroll")
    @ResponseStatus(HttpStatus.CREATED)
    public Enrollment enroll(@PathVariable Long id, @RequestBody Map<String, Object> body, HttpServletRequest req) {
        Training t = trainings.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Training not found"));
        Long candidateId = ((Number) body.get("candidateId")).longValue();
        auth.requireManagerOrSelf(req, candidateId);
        Candidate c = candidates.findById(candidateId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Candidate not found"));
        if (enrollments.findByTraining_IdAndCandidate_Id(id, candidateId).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Already enrolled");
        }
        Enrollment e = new Enrollment();
        e.setTraining(t);
        e.setCandidate(c);
        return enrollments.save(e);
    }

    @PutMapping("/enrollments/{id}")
    public Enrollment updateEnrollment(@PathVariable Long id, @RequestBody Map<String, Object> body,
                                       HttpServletRequest req) {
        Enrollment e = enrollments.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Enrollment not found"));
        auth.requireManagerOrSelf(req, e.getCandidate().getId());
        if (body.containsKey("status")) {
            e.setStatus(EnrollmentStatus.valueOf((String) body.get("status")));
        }
        if (body.containsKey("progressPct")) {
            int pct = ((Number) body.get("progressPct")).intValue();
            e.setProgressPct(Math.max(0, Math.min(100, pct)));
        }
        if (body.containsKey("notes")) {
            e.setNotes((String) body.get("notes"));
        }
        return enrollments.save(e);
    }

    @GetMapping("/candidates/{id}/enrollments")
    public List<Enrollment> candidateEnrollments(@PathVariable Long id) {
        return enrollments.findByCandidate_Id(id);
    }
}
