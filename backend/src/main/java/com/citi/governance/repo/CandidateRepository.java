package com.citi.governance.repo;

import com.citi.governance.model.Candidate;
import com.citi.governance.model.OnboardingStage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CandidateRepository extends JpaRepository<Candidate, Long> {
    Optional<Candidate> findByEmail(String email);
    List<Candidate> findByCurrentStage(OnboardingStage stage);
    long countByCurrentStage(OnboardingStage stage);
    List<Candidate> findByNameContainingIgnoreCaseOrEmailContainingIgnoreCaseOrSoeidContainingIgnoreCase(
            String name, String email, String soeid);
}
