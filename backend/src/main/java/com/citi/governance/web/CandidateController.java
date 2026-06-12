package com.citi.governance.web;

import com.citi.governance.auth.AuthService;
import com.citi.governance.model.*;
import com.citi.governance.repo.AppUserRepository;
import com.citi.governance.repo.CandidateRepository;
import com.citi.governance.repo.StageHistoryRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/candidates")
public class CandidateController {

    /** Bulk-imported people log in with this default password (same as seeded accounts). */
    private static final String DEFAULT_PASSWORD = "Citi@123";

    private final CandidateRepository candidates;
    private final StageHistoryRepository history;
    private final AppUserRepository users;
    private final AuthService auth;

    public CandidateController(CandidateRepository candidates, StageHistoryRepository history,
                               AppUserRepository users, AuthService auth) {
        this.candidates = candidates;
        this.history = history;
        this.users = users;
        this.auth = auth;
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
    public Candidate create(@RequestBody Candidate c, HttpServletRequest req) {
        AppUser manager = auth.requireManager(req);
        c.setId(null);
        if (c.getCurrentStage() == null) {
            c.setCurrentStage(OnboardingStage.NOMINATED);
        }
        Candidate saved = candidates.save(c);
        StageHistory h = new StageHistory();
        h.setCandidate(saved);
        h.setStage(OnboardingStage.NOMINATED);
        h.setCompletedBy(manager.getName());
        h.setNotes("Candidate nominated");
        history.save(h);
        return saved;
    }

    /**
     * Bulk-import people from an uploaded sheet (CSV/Excel parsed on the client). Each row creates a
     * Candidate (starting NOMINATED) plus a linked login (default password). The band determines the
     * role. Rows are validated independently - one bad row never aborts the others; the response
     * summarises what was created, skipped (already exists) and which rows errored.
     */
    @PostMapping("/bulk")
    public Map<String, Object> bulkImport(@RequestBody Map<String, Object> body, HttpServletRequest req) {
        AppUser manager = auth.requireManager(req);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> people = (List<Map<String, Object>>) body.getOrDefault("people", List.of());

        int created = 0;
        List<Map<String, Object>> errors = new ArrayList<>();
        List<String> skipped = new ArrayList<>();

        for (int i = 0; i < people.size(); i++) {
            Map<String, Object> row = people.get(i);
            int rowNum = i + 2; // header is row 1 in the sheet
            try {
                String name = str(row.get("name"));
                String email = str(row.get("email")).toLowerCase();
                String band = str(row.get("band")).toLowerCase();

                if (name.isBlank() || email.isBlank() || band.isBlank()) {
                    throw new IllegalArgumentException("Name, Email and Band are required");
                }
                if (!Bands.isValid(band)) {
                    throw new IllegalArgumentException("Unknown band '" + band + "'");
                }
                if (users.findByEmailIgnoreCase(email).isPresent() || candidates.findByEmail(email).isPresent()) {
                    skipped.add(name + " (" + email + ") - already exists");
                    continue;
                }

                Role role = Bands.isManagerBand(band) ? Role.MANAGER : Role.DEVELOPER;
                Candidate c = new Candidate();
                c.setName(name);
                c.setEmail(email);
                c.setBand(band);
                c.setRole(role);
                c.setCurrentStage(OnboardingStage.NOMINATED);
                // Reporting manager is given by email (unique, typo-proof) and resolved to a real manager.
                String mgrEmail = strOrNull(row.get("reportingManagerEmail"));
                if (mgrEmail != null) {
                    Candidate mgr = candidates.findByEmail(mgrEmail.toLowerCase()).orElse(null);
                    if (mgr == null || mgr.getRole() != Role.MANAGER) {
                        throw new IllegalArgumentException(
                                "Reporting manager email '" + mgrEmail + "' is not a known manager");
                    }
                    c.setReportingManager(mgr.getName());
                }
                c.setCitiLeadership(strOrNull(row.get("citiLeadership")));
                c.setWave(strOrNull(row.get("wave")));
                c.setPod(role == Role.MANAGER && str(row.get("pod")).isBlank() ? "Leadership" : strOrNull(row.get("pod")));
                c.setLocation(strOrNull(row.get("location")));
                String joinDate = str(row.get("joinDate"));
                if (!joinDate.isBlank()) {
                    try { c.setJoinDate(LocalDate.parse(joinDate)); }
                    catch (Exception ex) { throw new IllegalArgumentException("Join Date must be YYYY-MM-DD"); }
                }
                String soeid = str(row.get("soeid"));
                if (!soeid.isBlank()) c.setSoeid(soeid.trim().toUpperCase());
                Candidate saved = candidates.save(c);

                StageHistory h = new StageHistory();
                h.setCandidate(saved);
                h.setStage(OnboardingStage.NOMINATED);
                h.setCompletedBy(manager.getName());
                h.setNotes("Bulk import");
                history.save(h);

                AppUser u = new AppUser();
                u.setName(name);
                u.setEmail(email);
                u.setPasswordHash(auth.hash(DEFAULT_PASSWORD));
                u.setRole(role);
                u.setCandidateId(saved.getId());
                users.save(u);

                created++;
            } catch (Exception ex) {
                Map<String, Object> e = new LinkedHashMap<>();
                e.put("row", rowNum);
                e.put("name", str(row.get("name")));
                e.put("message", ex.getMessage());
                errors.add(e);
            }
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("created", created);
        out.put("skipped", skipped);
        out.put("errors", errors);
        return out;
    }

    private static String str(Object o) { return o == null ? "" : o.toString().trim(); }
    private static String strOrNull(Object o) { String s = str(o); return s.isBlank() ? null : s; }

    @PutMapping("/{id}")
    public Candidate update(@PathVariable Long id, @RequestBody Candidate in, HttpServletRequest req) {
        auth.requireManagerOrSelf(req, id);
        Candidate c = get(id);
        if (in.getName() != null) c.setName(in.getName());
        if (in.getEmployeeId() != null) c.setEmployeeId(in.getEmployeeId());
        if (in.getBand() != null) c.setBand(in.getBand());
        if (in.getWave() != null) c.setWave(in.getWave());
        if (in.getPod() != null) c.setPod(in.getPod());
        if (in.getLocation() != null) c.setLocation(in.getLocation());
        if (in.getJoinDate() != null) c.setJoinDate(in.getJoinDate());
        if (in.getReportingManager() != null) c.setReportingManager(in.getReportingManager());
        if (in.getCitiLeadership() != null) c.setCitiLeadership(in.getCitiLeadership());
        if (in.getOffboardingReason() != null) c.setOffboardingReason(in.getOffboardingReason());
        if (in.getSkillGaps() != null) c.setSkillGaps(in.getSkillGaps());
        if (in.getAllocations() != null) c.setAllocations(in.getAllocations());
        if (in.getActivities() != null) c.setActivities(in.getActivities());
        if (in.getTrainingNotes() != null) c.setTrainingNotes(in.getTrainingNotes());
        return candidates.save(c);
    }

    /** A SOEID may be assigned/edited by the candidate's manager, but only once onboarding has started. */
    @PostMapping("/{id}/soeid")
    public Candidate setSoeid(@PathVariable Long id, @RequestBody Map<String, String> body, HttpServletRequest req) {
        auth.requireManager(req);
        Candidate c = get(id);
        if (c.getCurrentStage().ordinal() < OnboardingStage.ONBOARDING_INITIATED.ordinal()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "A SOEID can be assigned only once onboarding has started.");
        }
        String soeid = body.get("soeid");
        if (soeid == null || soeid.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A SOEID is required.");
        }
        c.setSoeid(soeid.trim().toUpperCase());
        return candidates.save(c);
    }

    @PutMapping("/{id}/skills")
    public Candidate updateSkills(@PathVariable Long id, @RequestBody Map<String, Integer> body, HttpServletRequest req) {
        auth.requireManagerOrSelf(req, id);
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

    /** Advance the candidate to the next onboarding stage and record it in the audit trail. Leads only. */
    @PostMapping("/{id}/advance-stage")
    public Candidate advanceStage(@PathVariable Long id, @RequestBody(required = false) Map<String, String> body,
                                  HttpServletRequest req) {
        AppUser manager = auth.requireManager(req);
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
        h.setCompletedBy(manager.getName());
        h.setNotes(body != null ? body.get("notes") : null);
        history.save(h);
        return c;
    }

    /** Set the candidate to any onboarding stage and record it in the audit trail. Managers only. */
    @PostMapping("/{id}/stage")
    public Candidate setStage(@PathVariable Long id, @RequestBody Map<String, String> body, HttpServletRequest req) {
        AppUser manager = auth.requireManager(req);
        Candidate c = get(id);
        String raw = body.get("stage");
        if (raw == null || raw.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "stage is required");
        }
        OnboardingStage target;
        try {
            target = OnboardingStage.valueOf(raw);
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown stage: " + raw);
        }
        OnboardingStage current = c.getCurrentStage();
        if (current == target) {
            return c; // no change
        }
        // A candidate must have a SOEID before they can be onboarded.
        if (target == OnboardingStage.ONBOARDED && (c.getSoeid() == null || c.getSoeid().isBlank())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Cannot move to Onboarded until a SOEID is assigned to " + c.getName() + ".");
        }
        // Offboarding may only begin for someone who is onboarded or has failed KARAT.
        if (target == OnboardingStage.OFFBOARDING
                && current != OnboardingStage.ONBOARDED && current != OnboardingStage.KARAT_FAILED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Only onboarded or KARAT-failed people can be offboarded.");
        }
        // Being fully offboarded only follows from an in-progress offboarding.
        if (target == OnboardingStage.OFFBOARDED && current != OnboardingStage.OFFBOARDING) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "A person must be in Offboarding before they can be marked Offboarded.");
        }
        c.setCurrentStage(target);
        // Capture the offboarding reason (shown on hover on the pipeline) when offboarding starts.
        if (target == OnboardingStage.OFFBOARDING) {
            String reason = body.get("offboardingReason");
            if (reason != null && !reason.isBlank()) c.setOffboardingReason(reason.trim());
        }
        // Joining date is the day the candidate is onboarded.
        if (target == OnboardingStage.ONBOARDED) {
            c.setJoinDate(java.time.LocalDate.now());
        }
        candidates.save(c);

        StageHistory h = new StageHistory();
        h.setCandidate(c);
        h.setStage(target);
        h.setCompletedBy(manager.getName());
        h.setNotes(body.get("notes"));
        history.save(h);
        return c;
    }

    @GetMapping("/{id}/stage-history")
    public List<StageHistory> stageHistory(@PathVariable Long id) {
        return history.findByCandidateIdOrderByCompletedAtAsc(id);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id, HttpServletRequest req) {
        auth.requireManager(req);
        candidates.deleteById(id);
    }
}
