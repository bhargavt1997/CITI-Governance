package com.citi.governance.repo;

import com.citi.governance.model.Timesheet;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TimesheetRepository extends JpaRepository<Timesheet, Long> {
    Optional<Timesheet> findByCandidateIdAndMonth(Long candidateId, String month);
    List<Timesheet> findByMonth(String month);
    List<Timesheet> findByCandidateIdOrderByMonthAsc(Long candidateId);
}
