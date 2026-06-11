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

    public AuthController(AuthService auth, AppUserRepository users,
                          CandidateRepository candidates, StageHistoryRepository history) {
        this.auth = auth;
        this.users = users;
        this.candidates = candidates;
        this.history = history;
    }

    @PostMapping("/login")
    public Map<String, Object> login(@RequestBody Map<String, String> body) {
        String email = body.getOrDefault("email", "");
        String password = body.getOrDefault("password", "");
        AppUser user = auth.authenticate(email, password)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password"));
        return tokenResponse(user);
    }

    /** Public list of managers, used to populate the reporting-manager dropdown on the registration screen. */
    @GetMapping("/managers")
    public List<Map<String, Object>> managers() {
        return users.findAll().stream()
                .filter(u -> u.getRole() == Role.MANAGER)
                .map(u -> Map.<String, Object>of("id", u.getId(), "name", u.getName(), "email", u.getEmail()))
                .toList();
    }

    /**
     * Self-service registration. Creates a login plus a linked candidate record (so the user can fill PTS and
     * has a profile). Works for both roles; a reporting manager can be mapped for anyone — including managers.
     */
    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> register(@RequestBody Map<String, String> body) {
        String name = body.getOrDefault("name", "").trim();
        String email = body.getOrDefault("email", "").trim().toLowerCase();
        String password = body.getOrDefault("password", "");
        String roleStr = body.getOrDefault("role", "DEVELOPER");
        String reportingManager = trimToNull(body.get("reportingManager"));
        String band = trimToNull(body.get("band"));

        if (name.isBlank() || email.isBlank() || password.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Name, email and password are required");
        }
        if (password.length() < 6) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password must be at least 6 characters");
        }
        Role role;
        try {
            role = Role.valueOf(roleStr);
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Role must be MANAGER or DEVELOPER");
        }
        // Only B6H, B5L, B5H, B4L, B4H are eligible to be a manager; developers may hold any band.
        if (role == Role.MANAGER) {
            if (band == null) band = Bands.DEFAULT_MANAGER;
            if (!Bands.isManagerBand(band)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Managers must be band B6H, B5L, B5H, B4L or B4H");
            }
        } else {
            if (band == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Band is required");
            }
            if (!Bands.isDeveloperBand(band)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Developers must be band B8, B7 or B6L");
            }
        }
        if (users.findByEmailIgnoreCase(email).isPresent() || candidates.findByEmail(email).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "An account with this email already exists");
        }
        if (reportingManager != null) {
            boolean known = users.findAll().stream()
                    .anyMatch(u -> u.getRole() == Role.MANAGER && u.getName().equalsIgnoreCase(reportingManager));
            if (!known) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown reporting manager");
            }
        }

        Candidate c = new Candidate();
        c.setName(name);
        c.setEmail(email);
        c.setRole(role);
        c.setReportingManager(reportingManager);
        c.setBand(band);
        // New registrations start in the NOMINATED stage by default.
        c.setCurrentStage(OnboardingStage.NOMINATED);
        if (role == Role.MANAGER) {
            c.setPod("Leadership");
        }
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

    /** Populate the transient band from the linked candidate so the client can gate by band. */
    private AppUser withBand(AppUser u) {
        if (u.getCandidateId() != null) {
            candidates.findById(u.getCandidateId()).ifPresent((c) -> u.setBand(c.getBand()));
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
