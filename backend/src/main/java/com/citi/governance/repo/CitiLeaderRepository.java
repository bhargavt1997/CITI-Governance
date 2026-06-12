package com.citi.governance.repo;

import com.citi.governance.model.CitiLeader;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CitiLeaderRepository extends JpaRepository<CitiLeader, Long> {
    boolean existsByNameIgnoreCase(String name);
}
