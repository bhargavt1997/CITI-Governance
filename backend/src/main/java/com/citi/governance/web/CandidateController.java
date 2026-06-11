package com.citi.governance.web;

import com.citi.governance.model.*;
import com.citi.governance.repo.CandidateRepository;
import com.citi.governance.repo.StageHistoryRepository;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/candidates")
public class CandidateController {

    private final CandidateRepository candidates;
    private final StageHistoryRepository history;

    public CandidateController(CandidateRepository candidates, StageHistoryRepository history) {
        this.candidates = candidates;
        this.history = history;
    }

    @GetMapping
    public List<Candidate> list(@RequestParam(required = false) String q) {
        if (q != null && !q.isBlank()) {
            return candidates.findByNameContainingIgnoreCaseOrEmailContainingIgnoreCaseOrSoeidContainingIgnoreCase(q, q, q);
        }
        return candidates.findAll();
    }

    @GetMapping("/{id}")
    public Candidate get(@PathVariable Long id) {
        return candidates.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Candidate not found"));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Candidate create(@RequestBody Candidate c) {
        c.setId(null);
        if (c.getCurrentStage() == null) {
            c.setCurrentStage(OnboardingStage.NOMINATED);
        }
        Candidate saved = candidates.save(c);
        StageHistory h = new StageHistory();
        h.setCandidate(saved);
        h.setStage(OnboardingStage.NOMINATED);
        h.setCompletedBy(c.getReportingManager() != null ? c.getReportingManager() : "system");
        h.setNotes("Candidate nominated");
        history.save(h);
        return saved;
    }

    @PutMapping("/{id}")
    public Candidate update(@PathVariable Long id, @RequestBody Candidate in) {
        Candidate c = get(id);
        if (in.getName() != null) c.setName(in.getName());
        if (in.getEmployeeId() != null) c.setEmployeeId(in.getEmployeeId());
        if (in.getBand() != null) c.setBand(in.getBand());
        if (in.getWave() != null) c.setWave(in.getWave());
        if (in.getPod() != null) c.setPod(in.getPod());
        if (in.getLocation() != null) c.setLocation(in.getLocation());
        if (in.getJoinDate() != null) c.setJoinDate(in.getJoinDate());
        if (in.getReportingManager() != null) c.setReportingManager(in.getReportingManager());
        if (in.getSkillGaps() != null) c.setSkillGaps(in.getSkillGaps());
        if (in.getAllocations() != null) c.setAllocations(in.getAllocations());
        if (in.getActivities() != null) c.setActivities(in.getActivities());
        if (in.getTrainingNotes() != null) c.setTrainingNotes(in.getTrainingNotes());
        return candidates.save(c);
    }

    /** SOEID can be set once if missing at registration; afterwards it is locked. */
    @PostMapping("/{id}/soeid")
    public Candidate setSoeid(@PathVariable Long id, @RequestBody Map<String, String> body) {
        Candidate c = get(id);
        if (c.getSoeid() != null && !c.getSoeid().isBlank()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "SOEID already set and cannot be changed");
        }
        String soeid = body.get("soeid");
        if (soeid == null || soeid.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "soeid is required");
        }
        c.setSoeid(soeid.trim().toUpperCase());
        return candidates.save(c);
    }

    @PutMapping("/{id}/skills")
    public Candidate updateSkills(@PathVariable Long id, @RequestBody Map<String, Integer> body) {
        Candidate c = get(id);
        if (body.containsKey("technical")) c.setSkillTechnical(clamp(body.get("technical")));
        if (body.containsKey("functional")) c.setSkillFunctional(clamp(body.get("functional")));
        if (body.containsKey("leadership")) c.setSkillLeadership(clamp(body.get("leadership")));
        if (body.containsKey("domain")) c.setSkillDomain(clamp(body.get("domain")));
        if (body.containsKey("certifications")) c.setSkillCertifications(clamp(body.get("certifications")));
        return candidates.save(c);
    }

    private int clamp(Integer v) {
        return Math.max(0, Math.min(100, v == null ? 0 : v));
    }

    /** Advance the candidate to the next onboarding stage and record it in the audit trail. */
    @PostMapping("/{id}/advance-stage")
    public Candidate advanceStage(@PathVariable Long id, @RequestBody(required = false) Map<String, String> body) {
        Candidate c = get(id);
        OnboardingStage current = c.getCurrentStage();
        if (current == OnboardingStage.ONBOARDED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Candidate is already onboarded");
        }
        OnboardingStage next = current.next();
        c.setCurrentStage(next);
        candidates.save(c);

        StageHistory h = new StageHistory();
        h.setCandidate(c);
        h.setStage(next);
        h.setCompletedBy(body != null ? body.getOrDefault("completedBy", "system") : "system");
        h.setNotes(body != null ? body.get("notes") : null);
        history.save(h);
        return c;
    }

    @GetMapping("/{id}/stage-history")
    public List<StageHistory> stageHistory(@PathVariable Long id) {
        return history.findByCandidateIdOrderByCompletedAtAsc(id);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        candidates.deleteById(id);
    }
}
