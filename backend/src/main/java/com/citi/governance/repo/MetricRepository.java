package com.citi.governance.repo;

import com.citi.governance.model.Metric;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MetricRepository extends JpaRepository<Metric, Long> {
    Optional<Metric> findByCandidateIdAndMonth(Long candidateId, String month);
    List<Metric> findByMonth(String month);
    List<Metric> findByCandidateIdOrderByMonthAsc(Long candidateId);
}
