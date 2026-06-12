package com.citi.governance.web;

import com.citi.governance.model.AppUser;
import com.citi.governance.model.Candidate;
import com.citi.governance.model.OnboardingStage;
import com.citi.governance.model.Role;
import com.citi.governance.repo.AppUserRepository;
import com.citi.governance.repo.CandidateRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final AppUserRepository users;
    private final CandidateRepository candidates;

    public UserController(AppUserRepository users, CandidateRepository candidates) {
        this.users = users;
        this.candidates = candidates;
    }

    /** Managers eligible to be a reporting manager (onboarded only) - the choices when re-mapping a developer. */
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
}
