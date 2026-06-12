package com.citi.governance.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/** A CITI (client-side) leadership owner, e.g. Gonzalo or Joshua. Created by senior management. */
@Entity
@Table(name = "citi_leaders")
public class CitiLeader {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String name;

    private LocalDateTime createdAt = LocalDateTime.now();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
