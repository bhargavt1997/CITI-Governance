package com.citi.governance.repo;

import com.citi.governance.model.Pod;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PodRepository extends JpaRepository<Pod, Long> {
    Optional<Pod> findByNameIgnoreCase(String name);
    boolean existsByNameIgnoreCase(String name);
}
