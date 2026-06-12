package com.citi.governance.web;

import com.citi.governance.auth.AuthService;
import com.citi.governance.model.AppUser;
import com.citi.governance.model.Bands;
import com.citi.governance.model.Candidate;
import com.citi.governance.model.CitiLeader;
import com.citi.governance.repo.CandidateRepository;
import com.citi.governance.repo.CitiLeaderRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

/**
 * CITI (client-side) leadership owners. Readable by anyone (so the register form can offer them);
 * only senior management (B5L and above) may add a new one.
 */
@RestController
@RequestMapping("/api/citi-leaders")
public class CitiLeaderController {

    private final CitiLeaderRepository leaders;
    private final CandidateRepository candidates;
    private final AuthService auth;

    public CitiLeaderController(CitiLeaderRepository leaders, CandidateRepository candidates, AuthService auth) {
        this.leaders = leaders;
        this.candidates = candidates;
        this.auth = auth;
    }

    @GetMapping
    public List<CitiLeader> list() {
        return leaders.findAll();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CitiLeader create(@RequestBody Map<String, String> body, HttpServletRequest req) {
        AppUser user = auth.current(req);
        String band = user.getCandidateId() == null ? null
                : candidates.findById(user.getCandidateId()).map(Candidate::getBand).orElse(null);
        if (!Bands.isSeniorBand(band)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only senior management can add CITI leaders");
        }
        String name = body.getOrDefault("name", "").trim();
        if (name.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Name is required");
        }
        if (leaders.existsByNameIgnoreCase(name)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This CITI leader already exists");
        }
        CitiLeader l = new CitiLeader();
        l.setName(name);
        return leaders.save(l);
    }
}
