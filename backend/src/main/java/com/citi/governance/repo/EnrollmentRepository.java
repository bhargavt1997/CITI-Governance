package com.citi.governance.repo;

import com.citi.governance.model.Enrollment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface EnrollmentRepository extends JpaRepository<Enrollment, Long> {
    List<Enrollment> findByTraining_Id(Long trainingId);
    List<Enrollment> findByCandidate_Id(Long candidateId);
    Optional<Enrollment> findByTraining_IdAndCandidate_Id(Long trainingId, Long candidateId);
    long countByTraining_Id(Long trainingId);
}
