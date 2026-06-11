package com.citi.governance.repo;

import com.citi.governance.model.StageHistory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface StageHistoryRepository extends JpaRepository<StageHistory, Long> {
    List<StageHistory> findByCandidateIdOrderByCompletedAtAsc(Long candidateId);
    List<StageHistory> findAllByOrderByCompletedAtAsc();
}
