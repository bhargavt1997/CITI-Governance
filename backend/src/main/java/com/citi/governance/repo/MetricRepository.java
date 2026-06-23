package com.citi.governance.repo;

import com.citi.governance.model.Metric;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface MetricRepository extends JpaRepository<Metric, Long> {
    Optional<Metric> findByCandidateIdAndMonth(Long candidateId, String month);
    List<Metric> findByMonth(String month);
    List<Metric> findByCandidateIdOrderByMonthAsc(Long candidateId);

    @Query("SELECT DISTINCT m.month FROM Metric m WHERE m.candidate.reportingManager = :managerName ORDER BY m.month ASC")
    List<String> findDistinctMonthsByManagerName(@Param("managerName") String managerName);
}
