package com.citi.governance.web;

import com.citi.governance.auth.AuthService;
import com.citi.governance.model.AppUser;
import com.citi.governance.model.Bands;
import com.citi.governance.model.Candidate;
import com.citi.governance.model.Pod;
import com.citi.governance.repo.CandidateRepository;
import com.citi.governance.repo.PodRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

/**
 * Delivery projects ("pods"). Anyone can read the list (so the register form can offer it); only
 * senior management (band B5L and above) may create a pod, and its lead must also be senior.
 */
@RestController
@RequestMapping("/api/pods")
public class PodController {

    private final PodRepository pods;
    private final CandidateRepository candidates;
    private final AuthService auth;

    public PodController(PodRepository pods, CandidateRepository candidates, AuthService auth) {
        this.pods = pods;
        this.candidates = candidates;
        this.auth = auth;
    }

    @GetMapping
    public List<Pod> list() {
        return pods.findAll();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Pod create(@RequestBody Map<String, String> body, HttpServletRequest req) {
        AppUser user = auth.current(req);
        String band = user.getCandidateId() == null ? null
                : candidates.findById(user.getCandidateId()).map(Candidate::getBand).orElse(null);
        if (!Bands.isSeniorBand(band)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only senior management can create projects");
        }

        String name = body.getOrDefault("name", "").trim();
        String leadEmail = body.getOrDefault("leadEmail", "").trim().toLowerCase();
        if (name.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Project name is required");
        }
        if (pods.existsByNameIgnoreCase(name)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A project with this name already exists");
        }
        if (leadEmail.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A pod lead is required");
        }
        Candidate lead = candidates.findByEmail(leadEmail).orElse(null);
        if (lead == null || !Bands.isSeniorBand(lead.getBand())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The pod lead must be a senior manager");
        }

        Pod pod = new Pod();
        pod.setName(name.toUpperCase());
        pod.setLeadName(lead.getName());
        pod.setLeadEmail(lead.getEmail());
        return pods.save(pod);
    }
}
