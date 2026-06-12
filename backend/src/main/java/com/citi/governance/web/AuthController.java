package com.citi.governance.web;

import com.citi.governance.auth.AuthService;
import com.citi.governance.model.AppUser;
import com.citi.governance.model.AuthToken;
import com.citi.governance.model.Bands;
import com.citi.governance.model.Candidate;
import com.citi.governance.model.OnboardingStage;
import com.citi.governance.model.Role;
import com.citi.governance.model.StageHistory;
import com.citi.governance.repo.AppUserRepository;
import com.citi.governance.repo.CandidateRepository;
import com.citi.governance.repo.StageHistoryRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService auth;
    private final AppUserRepository users;
    private final CandidateRepository candidates;
    private final StageHistoryRepository history;
    private final com.citi.governance.repo.PodRepository pods;

    public AuthController(AuthService auth, AppUserRepository users,
                          CandidateRepository candidates, StageHistoryRepository history,
                          com.citi.governance.repo.PodRepository pods) {
        this.auth = auth;
        this.users = users;
        this.candidates = candidates;
        this.history = history;
        this.pods = pods;
    }

    @PostMapping("/login")
    public Map<String, Object> login(@RequestBody Map<String, String> body) {
        String email = body.getOrDefault("email", "");
        String password = body.getOrDefault("password", "");
        AppUser user = auth.authenticate(email, password)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password"));
        return tokenResponse(user);
    }

    /** Public list of managers eligible to be a reporting manager (onboarded only). */
    @GetMapping("/managers")
    public List<Map<String, Object>> managers() {
        return users.findAll().stream()
                .filter(u -> u.getRole() == Role.MANAGER)
                .filter(this::isOnboarded)
                .map(u -> {
                    String band = u.getCandidateId() == null ? ""
                            : candidates.findById(u.getCandidateId()).map(Candidate::getBand).orElse("");
                    return Map.<String, Object>of("id", u.getId(), "name", u.getName(),
                            "email", u.getEmail(), "band", band == null ? "" : band);
                })
                .toList();
    }

    /** A person can only have reportees once they are onboarded. */
    private boolean isOnboarded(AppUser u) {
        return u.getCandidateId() != null
                && candidates.findById(u.getCandidateId())
                        .map(c -> c.getCurrentStage() == OnboardingStage.ONBOARDED)
                        .orElse(false);
    }

    /**
     * Self-service registration. Creates a login plus a linked candidate record (so the user can fill PTS and
     * has a profile). Works for both roles; a reporting manager can be mapped for anyone - including managers.
     */
    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> register(@RequestBody Map<String, String> body) {
        String name = body.getOrDefault("name", "").trim();
        String email = body.getOrDefault("email", "").trim().toLowerCase();
        String password = body.getOrDefault("password", "");
        String reportingManager = trimToNull(body.get("reportingManager"));
        String band = trimToNull(body.get("band"));
        String pod = trimToNull(body.get("pod"));
        String citiLeadership = trimToNull(body.get("citiLeadership"));
        String wave = trimToNull(body.get("wave"));
        String location = trimToNull(body.get("location"));

        if (name.isBlank() || email.isBlank() || password.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Name, email and password are required");
        }
        if (password.length() < 6) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password must be at least 6 characters");
        }
        // The band alone determines the role: B6H and above manage, B6L and below build.
        if (band == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Band is required");
        }
        if (!Bands.isValid(band)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown band");
        }
        // Everyone is tied to a project (stored in pod).
        if (pod == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Project is required");
        }
        Role role = Bands.isManagerBand(band) ? Role.MANAGER : Role.DEVELOPER;
        if (users.findByEmailIgnoreCase(email).isPresent() || candidates.findByEmail(email).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "An account with this email already exists");
        }
        if (reportingManager != null) {
            AppUser mgr = users.findAll().stream()
                    .filter(u -> u.getRole() == Role.MANAGER && u.getName().equalsIgnoreCase(reportingManager))
                    .filter(this::isOnboarded)
                    .findFirst().orElse(null);
            if (mgr == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Reporting manager must be an onboarded manager");
            }
            // A manager must sit at a more senior band than the person reporting to them.
            String mgrBand = mgr.getCandidateId() == null ? null
                    : candidates.findById(mgr.getCandidateId()).map(Candidate::getBand).orElse(null);
            if (mgrBand == null || Bands.rank(mgrBand) <= Bands.rank(band)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Your reporting manager must be a more senior band than you");
            }
        }

        Candidate c = new Candidate();
        c.setName(name);
        c.setEmail(email);
        c.setRole(role);
        c.setReportingManager(reportingManager);
        c.setBand(band);
        c.setPod(pod);
        // CITI leadership is derived from the chosen project's CITI owner (falls back to any provided value).
        String podCiti = pods.findByNameIgnoreCase(pod).map(p -> p.getCitiLeader()).orElse(null);
        c.setCitiLeadership(podCiti != null && !podCiti.isBlank() ? podCiti : citiLeadership);
        c.setWave(wave);
        c.setLocation(location);
        // New registrations start in the NOMINATED stage by default.
        c.setCurrentStage(OnboardingStage.NOMINATED);
        Candidate saved = candidates.save(c);

        StageHistory h = new StageHistory();
        h.setCandidate(saved);
        h.setStage(saved.getCurrentStage());
        h.setCompletedBy(name);
        h.setNotes("Self-registered");
        history.save(h);

        AppUser u = new AppUser();
        u.setName(name);
        u.setEmail(email);
        u.setPasswordHash(auth.hash(password));
        u.setRole(role);
        u.setCandidateId(saved.getId());
        users.save(u);

        return tokenResponse(u);
    }

    @GetMapping("/me")
    public AppUser me(HttpServletRequest request) {
        return withBand(auth.current(request));
    }

    /** Populate the transient band + onboarding stage from the linked candidate so the client can gate features. */
    private AppUser withBand(AppUser u) {
        if (u.getCandidateId() != null) {
            candidates.findById(u.getCandidateId()).ifPresent((c) -> {
                u.setBand(c.getBand());
                u.setCurrentStage(c.getCurrentStage() == null ? null : c.getCurrentStage().name());
            });
        }
        return u;
    }

    @PostMapping("/logout")
    public Map<String, String> logout(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            auth.revoke(header.substring(7));
        }
        return Map.of("message", "Logged out");
    }

    private Map<String, Object> tokenResponse(AppUser user) {
        AuthToken token = auth.issueToken(user);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("token", token.getToken());
        out.put("user", withBand(user));
        return out;
    }

    private static String trimToNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }
}
